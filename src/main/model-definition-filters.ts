import { and, eq, isNull, type SQL } from 'drizzle-orm'

import type { schema } from '../database/schema.js'
import {
	getModelRuntimeIdentityKeyFromParts,
	getModelRuntimeOptionsJson,
	type FileBackedModelRegistry,
	type ModelDefinition,
	type ModelRole,
} from '../config/model-registry.js'

type ConfiguredModelRef = { id: string }
type ProviderColumns = Pick<typeof schema.providers, 'code'>
type ModelVersionColumns = Pick<
	typeof schema.modelVersions,
	'providerModelCode' | 'extraIdentifier' | 'runtimeOptionsJson'
>

export type ModelVersionIdentityRow = {
	providerCode: string
	modelVersionCode: string
	modelVersionExtraIdentifier: string | null
	modelVersionRuntimeOptionsJson: string
}

export const getConfiguredModelDefinition = (
	registry: FileBackedModelRegistry,
	configuredModel: ConfiguredModelRef
) => {
	const modelDefinition = registry.modelsById.get(configuredModel.id)
	if (!modelDefinition) {
		throw new Error(`Configured model ${configuredModel.id} is not available in the active model registry.`)
	}
	return modelDefinition
}

export const getConfiguredModelDefinitions = (
	registry: FileBackedModelRegistry,
	configuredModels: ConfiguredModelRef[]
) => configuredModels.map(configuredModel => getConfiguredModelDefinition(registry, configuredModel))

export const modelVersionMatchesDefinition = (
	providerTable: ProviderColumns,
	modelVersionTable: ModelVersionColumns,
	modelDefinition: ModelDefinition,
	role: ModelRole
): SQL =>
	and(
		eq(providerTable.code, modelDefinition.provider),
		eq(modelVersionTable.providerModelCode, modelDefinition.providerModelCode),
		eq(modelVersionTable.runtimeOptionsJson, getModelRuntimeOptionsJson(modelDefinition, role)),
		modelDefinition.extraIdentifier
			? eq(modelVersionTable.extraIdentifier, modelDefinition.extraIdentifier)
			: isNull(modelVersionTable.extraIdentifier)
	) as SQL

export const getModelDefinitionForVersion = (
	registry: FileBackedModelRegistry,
	row: ModelVersionIdentityRow
) =>
	registry.modelsByRuntimeIdentity.get(
		getModelRuntimeIdentityKeyFromParts({
			provider: row.providerCode,
			providerModelCode: row.modelVersionCode,
			extraIdentifier: row.modelVersionExtraIdentifier,
			runtimeOptionsJson: row.modelVersionRuntimeOptionsJson,
		})
	)

export const getModelVersionLabel = (registry: FileBackedModelRegistry, row: ModelVersionIdentityRow) =>
	getModelDefinitionForVersion(registry, row)?.id ??
	getModelRuntimeIdentityKeyFromParts({
		provider: row.providerCode,
		providerModelCode: row.modelVersionCode,
		extraIdentifier: row.modelVersionExtraIdentifier,
		runtimeOptionsJson: row.modelVersionRuntimeOptionsJson,
	})
