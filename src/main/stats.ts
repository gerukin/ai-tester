import { and, or, eq, ne, inArray, sql, countDistinct, desc, aliasedTable } from 'drizzle-orm'

import { schema } from '../database/schema.js'
import { type AnalysisQuery } from '../config/index.js'
import { db } from '../database/db.js'
import { sessionEvaluations } from '../database/schema/sessions.js'

/** Locale to use for currency formatting, determined by the JS runtime */
const LOCALE = navigator.language ?? 'en-US'

/** Extra digits beyond what is considered the smallest fraction digits for a given currency */
const EXTRA_FRACTION_DIGITS = 2

export const showStats = async (query: AnalysisQuery) => {
	console.log('Checking for stats...')

	const candidateModelConfigsWithTemperature =
		query.candidates?.filter(candidate => candidate.temperature !== undefined) ?? []
	const modelConfigsWithTags =
		query.candidates?.filter(candidate => candidate.requiredTags !== undefined && candidate.requiredTags.length > 0) ??
		[]
	const modelConfigsWithProhibitedTags =
		query.candidates?.filter(
			candidate => candidate.prohibitedTags !== undefined && candidate.prohibitedTags.length > 0
		) ?? []

	const evaluatorModelConfigsWithTemperature =
		query.evaluators?.filter(evaluator => evaluator.temperature !== undefined) ?? []
	const evaluatorModelConfigsWithTags =
		query.evaluators?.filter(evaluator => evaluator.requiredTags !== undefined && evaluator.requiredTags.length > 0) ??
		[]
	const evaluatorModelConfigsWithProhibitedTags =
		query.evaluators?.filter(
			evaluator => evaluator.prohibitedTags !== undefined && evaluator.prohibitedTags.length > 0
		) ?? []

	// we query the DB to get all missing tests not yet run
	const {
		testVersions,
		testToTagRels,
		tags,
		sessions,
		modelVersions,
		providers,
		currencies,
		currencyRates,
		modelCosts,
	} = schema

	const targetCurrencyAlias = aliasedTable(currencies, 'target_currency_alias')
	const evaluatorModelVersionAlias = aliasedTable(modelVersions, 'evaluator_model_version_alias')
	const evaluatorProviderAlias = aliasedTable(providers, 'evaluator_provider_alias')

	const now = sql`strftime('%s', 'now')`
	// We want to get the currency rate closest to the current time, with a preference for past rates if available
	const getCurrencyRate = (targetCurrencyTable: typeof currencies | typeof targetCurrencyAlias) => {
		return sql<number>`
			(
				SELECT ${currencyRates.rateInUSD}
				FROM ${currencyRates}
				WHERE ${currencyRates.currencyId} = ${targetCurrencyTable.id}
				ORDER BY
					(CASE WHEN ${currencyRates.validFrom} <= ${now} THEN 0 ELSE 1 END),
					(CASE WHEN ${currencyRates.validFrom} <= ${now} THEN -1 ELSE 1 END) * ${currencyRates.validFrom}
				LIMIT 1
			)
		`
	}

	const cte = db.$with('cte').as(
		db
			.select({
				testVersionId: testVersions.id,
				modelVersionCode: modelVersions.providerModelCode,
				providerCode: providers.code,

				// Drizzle-ORM doesn't auto-alias columns, and does not support aliasing columns manually, so we have to use the raw SQL
				// (but this makes it impossible to use the column in the group by clause of the outer query - which is why we ignore the TS error)
				modelVersionId: sql<number>`${modelVersions.id}`.as('modelVersionId'),

				// for each test version and model version, we count the number of sessions, and evaluations
				// + pass rate (for the test accross all sessions and evals for this test)
				sessionsCount: countDistinct(sessions.id).as('sessionsCount'),
				evalsCount: countDistinct(sessionEvaluations.id).as('evalsCount'),
				passRate: sql<number>`SUM(${sessionEvaluations.pass}) / CAST(COUNT(${sessionEvaluations.pass}) AS REAL)`.as(
					'passRate'
				),

				// evaluations are also included (which means costs are overestimates) so we divide by the count of everything at the end
				costPerSession: sql<number>`
				   (
					   ${modelCosts.costPerCall} * COUNT(${sessions.id})
					   + ${modelCosts.costPerPromptToken} * SUM(${sessions.promptTokens})
					   + ${modelCosts.costPerCompletionToken} * SUM(${sessions.completionTokens})
					   + ${modelCosts.costPerHour} * SUM(${sessions.timeTaken}) / 1000 / 60 / CAST(60 AS REAL)
				   ) / COUNT(*) * ${getCurrencyRate(currencies)} / ${getCurrencyRate(targetCurrencyAlias)}
			   `.as('costPerSession'),
			})
			.from(sessions)
			.innerJoin(
				sessionEvaluations,
				and(
					eq(sessionEvaluations.sessionId, sessions.id),
					evaluatorModelConfigsWithTemperature.length > 0
						? sql`${sessionEvaluations.temperature} = CASE
							${sql.join(
								evaluatorModelConfigsWithTemperature.map(
									evaluator =>
										sql`WHEN
											${eq(evaluatorModelVersionAlias.providerModelCode, evaluator.model)}
											AND ${eq(evaluatorProviderAlias.code, evaluator.provider)}
											THEN ${evaluator.temperature}`
								)
							)}
							ELSE ${query.evaluatorsTemperature ?? sessionEvaluations.temperature}
						END`
						: eq(sessionEvaluations.temperature, query.evaluatorsTemperature ?? sessionEvaluations.temperature)
				)
			)
			.innerJoin(
				modelVersions,
				and(
					eq(sessions.modelVersionId, modelVersions.id),
					or(
						...(query.candidates?.map(({ provider, model }) =>
							and(eq(providers.code, provider), eq(modelVersions.providerModelCode, model))
						) ?? [])
					)
				)
			)
			.innerJoin(
				evaluatorModelVersionAlias,
				and(
					eq(sessionEvaluations.modelVersionId, evaluatorModelVersionAlias.id),
					or(
						...(query.evaluators?.map(({ provider, model }) =>
							and(eq(evaluatorProviderAlias.code, provider), eq(evaluatorModelVersionAlias.providerModelCode, model))
						) ?? [])
					)
				)
			)
			.innerJoin(providers, eq(providers.id, modelVersions.providerId))
			.innerJoin(evaluatorProviderAlias, eq(evaluatorProviderAlias.id, evaluatorModelVersionAlias.providerId))
			.innerJoin(modelCosts, eq(modelCosts.modelVersionId, modelVersions.id))
			.innerJoin(currencies, eq(currencies.id, modelCosts.currencyId))
			.innerJoin(testVersions, and(eq(testVersions.id, sessions.testVersionId), eq(testVersions.active, true)))
			.innerJoin(targetCurrencyAlias, eq(targetCurrencyAlias.code, query.currency))

			// We will need to filter by tags
			.innerJoin(testToTagRels, eq(testToTagRels.testVersionId, testVersions.id))
			.innerJoin(tags, eq(tags.id, testToTagRels.tagId))

			.where(
				and(
					candidateModelConfigsWithTemperature.length > 0
						? sql`${sessions.temperature} = CASE
							${sql.join(
								candidateModelConfigsWithTemperature.map(
									candidate =>
										sql`WHEN
											${eq(modelVersions.providerModelCode, candidate.model)}
											AND ${eq(providers.code, candidate.provider)}
											THEN ${candidate.temperature}`
								)
							)}
							ELSE ${query.candidatesTemperature ?? sessions.temperature}
						END`
						: eq(sessions.temperature, query.candidatesTemperature ?? sessions.temperature)
				)
			)

			.groupBy(modelVersions.id, testVersions.id)

			.having(() =>
				and(
					// Tag inclusions and exclusions must be done here rather than in the INNER JOIN
					// as we need to filter in/out the entire GROUP BY result if any of the grouped rows have the tag(s)
					...[
						...(query.requiredTags1 && query.requiredTags1.length > 0
							? [sql`sum(CASE WHEN ${inArray(tags.name, query.requiredTags1)} THEN 1 ELSE 0 END) > 0`]
							: []),
						...(query.requiredTags2 && query.requiredTags2.length > 0
							? [sql`sum(CASE WHEN ${inArray(tags.name, query.requiredTags2)} THEN 1 ELSE 0 END) > 0`]
							: []),
						...(query.prohibitedTags && query.prohibitedTags.length > 0
							? [sql`sum(CASE WHEN ${inArray(tags.name, query.prohibitedTags)} THEN 1 ELSE 0 END) = 0`]
							: []),

						// ensure we have all required tags for each candidate model
						...(modelConfigsWithTags.length > 0
							? modelConfigsWithTags.map(
									candidate =>
										sql`sum(CASE WHEN ${or(
											ne(modelVersions.providerModelCode, candidate.model),
											ne(providers.code, candidate.provider),
											inArray(tags.name, candidate.requiredTags!)
										)} THEN 1 ELSE 0 END) > 0`
							  )
							: []),

						// ensure we don't have any prohibited tags for each candidate model
						...(modelConfigsWithProhibitedTags.length > 0
							? modelConfigsWithProhibitedTags.map(
									candidate =>
										sql`sum(CASE WHEN ${and(
											eq(modelVersions.providerModelCode, candidate.model),
											eq(providers.code, candidate.provider),
											inArray(tags.name, candidate.prohibitedTags!)
										)} THEN 1 ELSE 0 END) = 0`
							  )
							: []),

						// ensure we have all required tags for each evaluator model
						...(evaluatorModelConfigsWithTags.length > 0
							? evaluatorModelConfigsWithTags.map(
									evaluator =>
										sql`sum(CASE WHEN ${or(
											ne(evaluatorModelVersionAlias.providerModelCode, evaluator.model),
											ne(evaluatorProviderAlias.code, evaluator.provider),
											inArray(tags.name, evaluator.requiredTags!)
										)} THEN 1 ELSE 0 END) > 0`
							  )
							: []),

						// ensure we don't have any prohibited tags for each evaluator model
						...(evaluatorModelConfigsWithProhibitedTags.length > 0
							? evaluatorModelConfigsWithProhibitedTags.map(
									evaluator =>
										sql`sum(CASE WHEN ${and(
											eq(evaluatorModelVersionAlias.providerModelCode, evaluator.model),
											eq(evaluatorProviderAlias.code, evaluator.provider),
											inArray(tags.name, evaluator.prohibitedTags!)
										)} THEN 1 ELSE 0 END) = 0`
							  )
							: []),
					]
				)
			)

			.orderBy(desc(sql`CAST(SUM(${sessionEvaluations.pass}) AS REAL) / COUNT(${sessionEvaluations.pass})`))
	)

	const passRateQuery = sql<number>`SUM(${cte.passRate}) / CAST(COUNT(*) AS REAL)`
	const costPerSessionQuery = sql<number>`SUM(${cte.costPerSession}) / COUNT(*)`
	const stats = await db
		.with(cte)
		.select({
			sessionsCount: sql<number>`SUM(${cte.sessionsCount})`,
			testsCount: countDistinct(cte.testVersionId),
			evalsCount: sql<number>`SUM(${cte.evalsCount})`,
			modelVersionCode: cte.modelVersionCode,
			providerCode: cte.providerCode,
			passRate: passRateQuery,
			costPerSession: costPerSessionQuery.as('costPerSession'),
		})
		.from(cte)

		// We group by model version (note: this column in the CTE is aliased, and Drizzle is confused by this so we need to ignore the TS error until they support it properly - there are no cleaner workarounds at this time)
		// @ts-ignore
		.groupBy(cte.modelVersionId)

		.orderBy(desc(passRateQuery), costPerSessionQuery)

	const tmpCurrency = new Intl.NumberFormat(LOCALE, {
		style: 'currency',
		currency: query.currency,
	})

	const currency = new Intl.NumberFormat(LOCALE, {
		style: 'currency',
		maximumFractionDigits: (tmpCurrency.resolvedOptions().maximumFractionDigits ?? 0) + EXTRA_FRACTION_DIGITS,
		currency: query.currency,
	})
	const currencyTot = new Intl.NumberFormat(LOCALE, {
		style: 'currency',
		currency: query.currency,
	})

	console.table(
		Object.fromEntries(
			stats.map(result => {
				return [
					result.modelVersionCode,
					{
						Provider: result.providerCode,
						'✅%': Number((result.passRate * 100).toFixed(0)),
						'sess.': result.sessionsCount,
						tests: result.testsCount,
						evals: result.evalsCount,
						'💰/💯sess.': currency.format(result.costPerSession * 100),
						'Tot.💰': currencyTot.format(result.costPerSession * result.sessionsCount),
					},
				]
			})
		)
	)
}
