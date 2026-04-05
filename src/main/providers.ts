import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'

import { db } from '../database/db.js'
import { providers } from '../database/schema/providers.js'
import { models, modelVersions } from '../database/schema/models.js'
import { currencies, modelCosts } from '../database/schema/costs.js'
import { sessionEvaluations, sessions } from '../database/schema/sessions.js'
import {
	clearFileBackedModelRegistryCache,
	loadFileBackedModelRegistry,
	type FileBackedModelRegistry,
	type ModelDefinition,
	type ProviderDefinition,
} from '../config/model-registry.js'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const getModelIdentityKey = (model: Pick<ModelDefinition, 'provider' | 'providerModelCode' | 'extraIdentifier'>) =>
	`${model.provider}:${model.providerModelCode}:${model.extraIdentifier ?? ''}`

const setActiveByIds = async (tx: Transaction, table: typeof providers | typeof models | typeof modelVersions, ids: number[]) => {
	await tx.update(table).set({ active: false })

	if (ids.length > 0) {
		await tx
			.update(table)
			.set({ active: true })
			.where(inArray(table.id, ids))
	}
}

const ensureCurrency = async (tx: Transaction, currencyCode: string) => {
	let [currency] = await tx
		.insert(currencies)
		.values({
			code: currencyCode,
		})
		.onConflictDoNothing()
		.returning()

	if (!currency) {
		const existingCurrency = await tx.query.currencies.findFirst({
			where: eq(currencies.code, currencyCode),
		})
		if (!existingCurrency) throw new Error(`Failed to upsert currency ${currencyCode}`)
		currency = existingCurrency
	}

	return currency
}

const getOldestRunTimestamp = async (tx: Transaction, modelVersionId: number) => {
	const [oldestSession] = await tx
		.select({
			createdAt: sql<number | null>`min(${sessions.createdAt})`,
		})
		.from(sessions)
		.where(eq(sessions.modelVersionId, modelVersionId))

	const [oldestEvaluation] = await tx
		.select({
			createdAt: sql<number | null>`min(${sessionEvaluations.createdAt})`,
		})
		.from(sessionEvaluations)
		.where(eq(sessionEvaluations.modelVersionId, modelVersionId))

	return [oldestSession?.createdAt, oldestEvaluation?.createdAt].reduce<number | null>((oldest, current) => {
		if (current === null || current === undefined) return oldest
		if (oldest === null) return current
		return Math.min(oldest, current)
	}, null)
}

const syncModelCostsFromYaml = async (tx: Transaction, modelVersionId: number, modelConfig: ModelDefinition) => {
	const oldestRunTimestamp = await getOldestRunTimestamp(tx, modelVersionId)

	if (oldestRunTimestamp !== null) {
		if (modelConfig.costs.length === 0) {
			throw new Error(
				`Model ${modelConfig.provider}:${modelConfig.providerModelCode} has historical runs but no YAML cost entries.`
			)
		}

		const earliestCostTimestamp = Math.min(...modelConfig.costs.map(cost => new Date(cost.validFrom).getTime() / 1000))
		if (earliestCostTimestamp > oldestRunTimestamp) {
			throw new Error(
				`Model ${modelConfig.provider}:${modelConfig.providerModelCode} has cost history starting at ${modelConfig.costs[0]?.validFrom}, but recorded runs exist before that date.`
			)
		}
	}

	const validFromDates: Date[] = []

	for (const costConfig of modelConfig.costs) {
		const currency = await ensureCurrency(tx, costConfig.currency)
		const validFrom = new Date(costConfig.validFrom)
		validFromDates.push(validFrom)

		await tx
			.insert(modelCosts)
			.values({
				modelVersionId,
				currencyId: currency.id,
				costPerCall: costConfig.costPerCall,
				costPerPromptToken: costConfig.costPerPromptToken,
				costPerCompletionToken: costConfig.costPerCompletionToken,
				costPerHour: costConfig.costPerHour,
				validFrom,
			})
			.onConflictDoUpdate({
				target: [modelCosts.modelVersionId, modelCosts.validFrom],
				set: {
					currencyId: currency.id,
					costPerCall: costConfig.costPerCall,
					costPerPromptToken: costConfig.costPerPromptToken,
					costPerCompletionToken: costConfig.costPerCompletionToken,
					costPerHour: costConfig.costPerHour,
				},
			})
	}

	if (validFromDates.length === 0) {
		await tx.delete(modelCosts).where(eq(modelCosts.modelVersionId, modelVersionId))
		return
	}

	await tx
		.delete(modelCosts)
		.where(and(eq(modelCosts.modelVersionId, modelVersionId), notInArray(modelCosts.validFrom, validFromDates)))
}

const upsertProvider = async (tx: Transaction, providerConfig: ProviderDefinition) => {
	let [provider] = await tx
		.insert(providers)
		.values({
			code: providerConfig.code,
			name: providerConfig.name,
			active: true,
		})
		.onConflictDoUpdate({
			target: providers.code,
			set: {
				name: providerConfig.name,
				active: true,
			},
		})
		.returning()

	if (!provider) {
		const existingProvider = await tx.query.providers.findFirst({
			where: eq(providers.code, providerConfig.code),
		})
		if (!existingProvider) throw new Error(`Failed to upsert provider ${providerConfig.code}`)
		provider = existingProvider
	}

	return provider
}

const upsertModel = async (tx: Transaction, modelConfig: ModelDefinition) => {
	let [model] = await tx
		.insert(models)
		.values({
			code: modelConfig.code,
			active: true,
		})
		.onConflictDoUpdate({
			target: models.code,
			set: {
				active: true,
			},
		})
		.returning()

	if (!model) {
		const existingModel = await tx.query.models.findFirst({
			where: eq(models.code, modelConfig.code),
		})
		if (!existingModel) throw new Error(`Failed to upsert model ${modelConfig.code}`)
		model = existingModel
	}

	return model
}

const upsertModelVersion = async (
	tx: Transaction,
	providerId: number,
	modelId: number,
	modelConfig: ModelDefinition
) => {
	let modelVersion = await tx.query.modelVersions.findFirst({
		where: and(
			eq(modelVersions.providerId, providerId),
			eq(modelVersions.providerModelCode, modelConfig.providerModelCode),
			modelConfig.extraIdentifier
				? eq(modelVersions.extraIdentifier, modelConfig.extraIdentifier)
				: isNull(modelVersions.extraIdentifier)
		),
	})

	if (modelVersion) {
		if (modelVersion.modelId !== modelId || !modelVersion.active) {
			const [updated] = await tx
				.update(modelVersions)
				.set({ modelId, active: true })
				.where(eq(modelVersions.id, modelVersion.id))
				.returning()
			modelVersion = updated
		}
	} else {
		const [inserted] = await tx
			.insert(modelVersions)
			.values({
				modelId,
				providerId,
				providerModelCode: modelConfig.providerModelCode,
				extraIdentifier: modelConfig.extraIdentifier,
				active: true,
			})
			.returning()
		modelVersion = inserted
	}

	if (!modelVersion) {
		throw new Error(`Failed to upsert model version for ${modelConfig.provider}:${modelConfig.providerModelCode}`)
	}

	return modelVersion
}

const syncRegistryToDb = async (registry: FileBackedModelRegistry) => {
	await db.transaction(async tx => {
		const activeProviderIds: number[] = []
		const providersByCode = new Map<string, typeof providers.$inferSelect>()

		for (const providerConfig of registry.providers) {
			const provider = await upsertProvider(tx, providerConfig)
			activeProviderIds.push(provider.id)
			providersByCode.set(provider.code, provider)
		}

		const activeModelIds: number[] = []
		const modelsByCode = new Map<string, typeof models.$inferSelect>()

		for (const modelConfig of registry.models) {
			if (!modelsByCode.has(modelConfig.code)) {
				const model = await upsertModel(tx, modelConfig)
				activeModelIds.push(model.id)
				modelsByCode.set(model.code, model)
			}
		}

		const activeModelVersionIds = new Set<number>()
		const activeModelIdentityKeys = new Set(registry.activeModels.map(model => getModelIdentityKey(model)))
		for (const modelConfig of registry.models) {
			const provider = providersByCode.get(modelConfig.provider)
			const model = modelsByCode.get(modelConfig.code)

			if (!provider || !model) {
				throw new Error(`Failed to resolve registry entry ${modelConfig.provider}:${modelConfig.providerModelCode}`)
			}

			const modelVersion = await upsertModelVersion(tx, provider.id, model.id, modelConfig)
			if (activeModelIdentityKeys.has(getModelIdentityKey(modelConfig))) {
				activeModelVersionIds.add(modelVersion.id)
				await syncModelCostsFromYaml(tx, modelVersion.id, modelConfig)
			}
		}

		await setActiveByIds(tx, providers, activeProviderIds)
		await setActiveByIds(tx, models, activeModelIds)
		await setActiveByIds(tx, modelVersions, Array.from(activeModelVersionIds))
	})
}

export async function updateProvidersInDb() {
	console.log('Updating providers and models in the database...')

	clearFileBackedModelRegistryCache()
	const registry = loadFileBackedModelRegistry()
	await syncRegistryToDb(registry)
	clearFileBackedModelRegistryCache()

	console.log('✅ Providers and models updated!')
}
