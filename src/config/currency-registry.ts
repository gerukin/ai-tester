import fs from 'node:fs'
import { parse } from 'yaml'
import { z } from 'zod'

import { envConfig } from './environment.js'
import { loadFileBackedModelRegistry } from './model-registry.js'
import { listAllYamlFiles } from '../utils/files.js'

const CurrencyCodeSchema = z.preprocess(
	value => {
		if (typeof value !== 'string') return value
		return value.trim().toUpperCase()
	},
	z.string().regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO 4217 code')
)

export const CurrencyRateDefinitionSchema = z.object({
	rateInUSD: z.number().positive(),
	validFrom: z.string(),
})
export type CurrencyRateDefinition = z.infer<typeof CurrencyRateDefinitionSchema>

export const CurrencyDefinitionSchema = z.object({
	code: CurrencyCodeSchema,
	rates: z
		.array(CurrencyRateDefinitionSchema)
		.nonempty()
		.superRefine((rates, ctx) => {
			const seen = new Set<string>()
			for (const rate of rates) {
				if (Number.isNaN(new Date(rate.validFrom).valueOf())) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `Invalid validFrom date: ${rate.validFrom}`,
					})
				}

				if (seen.has(rate.validFrom)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `Duplicate rate entry for validFrom ${rate.validFrom}`,
					})
				}
				seen.add(rate.validFrom)
			}
		}),
})
export type CurrencyDefinition = z.infer<typeof CurrencyDefinitionSchema>

export type FileBackedCurrencyRegistry = {
	currencies: CurrencyDefinition[]
	currenciesByCode: Map<string, CurrencyDefinition>
}

const AnalysisQueryCurrencyConfigSchema = z.object({
	analysisQueries: z
		.array(
			z.object({
				description: z.string().optional(),
				currency: CurrencyCodeSchema,
			})
		)
		.optional(),
})

export const isCurrencyRegistryConfigured = () => Boolean(envConfig.AI_TESTER_CURRENCIES_DIR)

const getYamlFilesOrThrow = (basePath: string, label: string) => {
	if (!fs.existsSync(basePath)) {
		throw new Error(`${label} directory not found: ${basePath}`)
	}
	return listAllYamlFiles(basePath)
}

const readYamlFile = <T>(filePath: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T => {
	const content = fs.readFileSync(filePath, 'utf-8')
	return schema.parse(parse(content))
}

export const loadCurrencyDefinitions = (): CurrencyDefinition[] => {
	if (!envConfig.AI_TESTER_CURRENCIES_DIR) {
		return []
	}

	const currencies = getYamlFilesOrThrow(envConfig.AI_TESTER_CURRENCIES_DIR, 'Currency registry').map(file =>
		readYamlFile(file, CurrencyDefinitionSchema)
	)
	const seen = new Set<string>()

	for (const currency of currencies) {
		if (seen.has(currency.code)) {
			throw new Error(`Duplicate currency code found in YAML files: ${currency.code}`)
		}
		seen.add(currency.code)
	}

	return currencies
}

export const loadFileBackedCurrencyRegistry = (): FileBackedCurrencyRegistry => {
	const currencies = loadCurrencyDefinitions()
	return {
		currencies,
		currenciesByCode: new Map(currencies.map(currency => [currency.code, currency])),
	}
}

let cachedRegistry: FileBackedCurrencyRegistry | undefined

export const getFileBackedCurrencyRegistry = () => {
	cachedRegistry ??= loadFileBackedCurrencyRegistry()
	return cachedRegistry
}

export const clearFileBackedCurrencyRegistryCache = () => {
	cachedRegistry = undefined
}

const loadConfiguredAnalysisQueryCurrencies = () => {
	if (!fs.existsSync(envConfig.AI_TESTER_CONFIG_PATH)) {
		return []
	}

	const content = fs.readFileSync(envConfig.AI_TESTER_CONFIG_PATH, 'utf-8')
	const parsed = AnalysisQueryCurrencyConfigSchema.parse(parse(content))
	return parsed.analysisQueries ?? []
}

export const validateCurrencyRegistryReferences = (
	registry: FileBackedCurrencyRegistry = getFileBackedCurrencyRegistry(),
	{
		analysisQueries = [],
		includeConfiguredAnalysisQueries = true,
	}: {
		analysisQueries?: Array<{ description?: string; currency: string }>
		includeConfiguredAnalysisQueries?: boolean
	} = {}
) => {
	if (!isCurrencyRegistryConfigured()) return

	const missingSources = new Map<string, string[]>()
	const addMissingSource = (currency: string, source: string) => {
		missingSources.set(currency, [...(missingSources.get(currency) ?? []), source])
	}

	for (const model of loadFileBackedModelRegistry().models) {
		for (const cost of model.costs) {
			if (!registry.currenciesByCode.has(cost.currency)) {
				addMissingSource(cost.currency, `model ${model.provider}:${model.providerModelCode}`)
			}
		}
	}

	const configuredAnalysisQueries = includeConfiguredAnalysisQueries ? loadConfiguredAnalysisQueryCurrencies() : []
	for (const query of [...configuredAnalysisQueries, ...analysisQueries]) {
		if (!registry.currenciesByCode.has(query.currency)) {
			addMissingSource(query.currency, `analysis query "${query.description}"`)
		}
	}

	if (missingSources.size > 0) {
		const details = Array.from(missingSources.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([currency, sources]) => `${currency} (${sources.join(', ')})`)
			.join(', ')
		throw new Error(`Currency registry is missing YAML files for referenced currencies: ${details}`)
	}
}
