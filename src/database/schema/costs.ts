import { text, integer, real, sqliteTable, unique } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

import { modelVersions } from './models.js'

export const currencies = sqliteTable('currencies', {
	id: integer('id').primaryKey(),

	/** The unique currency code in ISO 4217 */
	code: text('iso_4217_code').notNull().unique(),
})
export const currencyRelations = relations(currencies, ({ many }) => ({
	/** All model costs for this currency */
	modelCosts: many(modelCosts),

	/** All currency rates for this currency */
	currencyRates: many(currencyRates),
}))

export const currencyRates = sqliteTable(
	'currency_rates',
	{
		id: integer('id').primaryKey(),

		/** The currency id */
		currencyId: integer('currency_id').notNull(),

		/** The rate in USD from the valid from date */
		rateInUSD: real('rate_in_usd').notNull(),

		/** Date the rate is valid from */
		validFrom: integer('valid_from', { mode: 'timestamp' })
			.notNull()
			.default(sql`(strftime('%s', 'now'))`),
	},
	t => [
		unique().on(t.currencyId, t.validFrom),
	]
)
export const currencyRateRelations = relations(currencyRates, ({ one, many }) => ({
	/** The currency */
	currency: one(currencies),

	/** The model costs */
	modelCosts: many(modelCosts),
}))

export const modelCosts = sqliteTable(
	'model_costs',
	{
		id: integer('id').primaryKey(),

		/** The model version id */
		modelVersionId: integer('model_version_id').notNull(),

		/** Currency id */
		currencyId: integer('currency_id').notNull(),

		/** The cost per call */
		costPerCall: real('cost_per_call').notNull(),

		/** The cost per prompt token */
		costPerPromptToken: real('cost_per_prompt_token').notNull(),

		/** The cost per completion token */
		costPerCompletionToken: real('cost_per_completion_token').notNull(),

		/** The cost per hour */
		costPerHour: real('cost_per_hour').notNull(),

		/** Date the cost is valid from */
		validFrom: integer('valid_from', { mode: 'timestamp' })
			.notNull()
			.default(sql`(strftime('%s', 'now'))`),
	},
	t => [
		unique().on(t.modelVersionId, t.validFrom),
	]
)
export const modelCostRelations = relations(modelCosts, ({ one }) => ({
	/** The model version */
	modelVersion: one(modelVersions),

	/** The currency */
	currency: one(currencies),
}))
