import { and, eq, notInArray } from 'drizzle-orm'

import { db } from '../database/db.js'
import { currencies, currencyRates } from '../database/schema/costs.js'
import {
	clearFileBackedCurrencyRegistryCache,
	getFileBackedCurrencyRegistry,
	isCurrencyRegistryConfigured,
	validateCurrencyRegistryReferences,
	type CurrencyDefinition,
} from '../config/currency-registry.js'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

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

const syncCurrencyRates = async (tx: Transaction, currencyDefinition: CurrencyDefinition) => {
	const currency = await ensureCurrency(tx, currencyDefinition.code)
	const validFromDates: Date[] = []

	for (const rateDefinition of currencyDefinition.rates) {
		const validFrom = new Date(rateDefinition.validFrom)
		validFromDates.push(validFrom)

		await tx
			.insert(currencyRates)
			.values({
				currencyId: currency.id,
				rateInUSD: rateDefinition.rateInUSD,
				validFrom,
			})
			.onConflictDoUpdate({
				target: [currencyRates.currencyId, currencyRates.validFrom],
				set: {
					rateInUSD: rateDefinition.rateInUSD,
				},
			})
	}

	await tx
		.delete(currencyRates)
		.where(and(eq(currencyRates.currencyId, currency.id), notInArray(currencyRates.validFrom, validFromDates)))

	return currency.id
}

const syncRegistryToDb = async (registry: ReturnType<typeof getFileBackedCurrencyRegistry>) => {
	await db.transaction(async tx => {
		const activeCurrencyIds: number[] = []

		for (const currencyDefinition of registry.currencies) {
			activeCurrencyIds.push(await syncCurrencyRates(tx, currencyDefinition))
		}

		if (activeCurrencyIds.length > 0) {
			await tx.delete(currencyRates).where(notInArray(currencyRates.currencyId, activeCurrencyIds))
		} else {
			await tx.delete(currencyRates)
		}
	})
}

export async function updateCurrenciesInDb() {
	if (!isCurrencyRegistryConfigured()) {
		console.warn('AI_TESTER_CURRENCIES_DIR is not set in the environment. Skipping currencies update.')
		return
	}

	console.log('Updating currencies in the database...')

	try {
		clearFileBackedCurrencyRegistryCache()
		const registry = getFileBackedCurrencyRegistry()
		validateCurrencyRegistryReferences(registry)
		await syncRegistryToDb(registry)
	} finally {
		clearFileBackedCurrencyRegistryCache()
	}

	console.log('✅ Currencies updated!')
}
