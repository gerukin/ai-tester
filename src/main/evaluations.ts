/**
 * This module is responsible for running all session evaluations that have not been run yet.
 */

import { and, or, eq, ne, inArray, sql, lt, countDistinct, aliasedTable } from 'drizzle-orm'
import { generateObject } from 'ai'
import z from 'zod'

import { testsConfig, MAX_TOKENS, MAX_WAIT_TIME } from '../config/index.js'
import { db } from '../database/db.js'
import { schema } from '../database/schema.js'
import { askYesNo } from '../utils/menus.js'
import { providers as llmProviders } from '../llms/index.js'
import { getSectionsFromMarkdownContent, sectionsToAiMessages } from '../utils/markdown.js'

export const runAllEvaluations = async () => {
	console.log('Checking for evaluations to run...')

	// we query the DB to get all missing evaluations not yet run
	const {
		testVersions,
		prompts,
		testToTagRels,
		testEvaluationInstructionsVersions,
		testToEvaluationInstructionsRels,
		tags,
		sessions,
		modelVersions,
		providers,
		promptVersions,
		sessionEvaluations,
	} = schema

	const modelConfigsWithTemperature = testsConfig.evaluators.filter(evaluator => evaluator.temperature !== undefined)
	const modelsWithTemperatures = new Map<string, number>(
		modelConfigsWithTemperature.map(({ provider, model, temperature }) => [`${provider}:${model}`, temperature!])
	)
	const modelConfigsWithTags = testsConfig.evaluators.filter(
		candidate => candidate.requiredTags !== undefined && candidate.requiredTags.length > 0
	)
	const modelConfigsWithProhibitedTags = testsConfig.evaluators.filter(
		candidate => candidate.prohibitedTags !== undefined && candidate.prohibitedTags.length > 0
	)

	const testSysPromptAlias = aliasedTable(promptVersions, 'test_sys_prompt_alias')
	const missingEvaluations = await db
		.select({
			modelVersionId: modelVersions.id,
			modelVersionCode: modelVersions.providerModelCode,
			providerCode: providers.code,
			testVersionId: testVersions.id,
			testContent: testVersions.content,
			sessionId: sessions.id,
			sessionAnswer: sessions.answer,
			evalPromptVersionId: promptVersions.id,
			evalPromptContent: promptVersions.content,
			evalInstructionsId: testEvaluationInstructionsVersions.id,
			evalInstructionsContent: testEvaluationInstructionsVersions.content,
			evaluationsCount: countDistinct(sessionEvaluations.id),
		})
		.from(modelVersions)
		.innerJoin(
			providers,
			and(
				eq(providers.id, modelVersions.providerId),
				or(
					...testsConfig.evaluators.map(({ provider, model }) =>
						and(eq(providers.code, provider), eq(modelVersions.providerModelCode, model))
					)
				)
			)
		)

		// always true to fetch all possible session combinations (we will filter later - cross joins aren't supported in drizzle-orm as of now)
		.innerJoin(sessions, eq(sessions.id, sessions.id))

		.innerJoin(prompts, eq(prompts.code, '_evaluator_default'))
		.innerJoin(promptVersions, and(eq(promptVersions.promptId, prompts.id), eq(promptVersions.active, true)))

		// we add the evaluation prompt version to the query
		.innerJoin(
			testToEvaluationInstructionsRels,
			eq(testToEvaluationInstructionsRels.testVersionId, sessions.testVersionId)
		)
		.innerJoin(
			testEvaluationInstructionsVersions,
			and(
				eq(testEvaluationInstructionsVersions.id, testToEvaluationInstructionsRels.evaluationInstructionsVersionId),
				eq(testEvaluationInstructionsVersions.active, true)
			)
		)

		.leftJoin(
			sessionEvaluations,
			and(
				eq(sessionEvaluations.sessionId, sessions.id),
				eq(sessionEvaluations.modelVersionId, modelVersions.id),
				eq(sessionEvaluations.evaluationPromptVersionId, promptVersions.id),
				eq(sessionEvaluations.testEvaluationInstructionsVersionId, testEvaluationInstructionsVersions.id),
				modelConfigsWithTemperature.length > 0
					? sql`${sessionEvaluations.temperature} = CASE
								${sql.join(
									modelConfigsWithTemperature.map(
										evaluator =>
											sql`WHEN
												${eq(modelVersions.providerModelCode, evaluator.model)}
												AND ${eq(providers.code, evaluator.provider)}
												THEN ${evaluator.temperature}`
									)
								)}
								ELSE ${testsConfig.evaluatorsTemperature}
							END`
					: eq(sessionEvaluations.temperature, testsConfig.evaluatorsTemperature)
			)
		)

		// We will need to filter by tags
		.innerJoin(testVersions, and(eq(testVersions.id, sessions.testVersionId), eq(testVersions.active, true)))
		// we also need to ensure everything is still active there
		// .innerJoin(testToSystemPromptVersionRels, eq(testToSystemPromptVersionRels.testVersionId, testVersions.id))
		.innerJoin(
			testSysPromptAlias,
			and(eq(testSysPromptAlias.id, sessions.candidateSysPromptVersionId), eq(testSysPromptAlias.active, true))
		)
		.innerJoin(testToTagRels, eq(testToTagRels.testVersionId, testVersions.id))
		.innerJoin(tags, eq(tags.id, testToTagRels.tagId))

		.groupBy(modelVersions.id, sessions.id, promptVersions.id)

		.having(({ evaluationsCount }) =>
			and(
				// Ensure we only get tests that have not been run enough times yet
				lt(evaluationsCount, testsConfig.evaluationsPerEvaluator),

				// Tag inclusions and exclusions must be done here rather than in the INNER JOIN
				// as we need to filter in/out the entire GROUP BY result if any of the grouped rows have the tag(s)
				...[
					...(testsConfig.requiredTags1.length > 0
						? [sql`sum(CASE WHEN ${inArray(tags.name, testsConfig.requiredTags1)} THEN 1 ELSE 0 END) > 0`]
						: []),
					...(testsConfig.requiredTags2.length > 0
						? [sql`sum(CASE WHEN ${inArray(tags.name, testsConfig.requiredTags2)} THEN 1 ELSE 0 END) > 0`]
						: []),
					...(testsConfig.prohibitedTags.length > 0
						? [sql`sum(CASE WHEN ${inArray(tags.name, testsConfig.prohibitedTags)} THEN 1 ELSE 0 END) = 0`]
						: []),

					// ensure we have all required tags for each model
					...(modelConfigsWithTags.length > 0
						? modelConfigsWithTags.map(
								evaluator =>
									sql`sum(CASE WHEN ${or(
										ne(modelVersions.providerModelCode, evaluator.model),
										ne(providers.code, evaluator.provider),
										inArray(tags.name, evaluator.requiredTags!)
									)} THEN 1 ELSE 0 END) > 0`
						  )
						: []),

					// ensure we don't have any prohibited tags for each model
					...(modelConfigsWithProhibitedTags.length > 0
						? modelConfigsWithProhibitedTags.map(
								evaluator =>
									sql`sum(CASE WHEN ${and(
										eq(modelVersions.providerModelCode, evaluator.model),
										eq(providers.code, evaluator.provider),
										inArray(tags.name, evaluator.prohibitedTags!)
									)} THEN 1 ELSE 0 END) > 0`
						  )
						: []),
				]
			)
		)

		// ordering by model id is important as Ollama and other local models have some initial load time to consider
		// and switching models regularly can be slow
		.orderBy(modelVersions.id, sessions.id, promptVersions.id)

	// The total number of missing evaluations needs to account for the number of judgments
	const totalMissingEvaluations = missingEvaluations.reduce(
		(acc, evaluation) => acc + (testsConfig.evaluationsPerEvaluator - evaluation.evaluationsCount),
		0
	)

	if (totalMissingEvaluations === 0) {
		console.log('👌 No missing evaluations found.')
		return
	}

	// ask for confirmation
	if (!(await askYesNo(`Are you sure you want to run all ${totalMissingEvaluations} missing evaluations?`)))
		process.exit(0)

	console.log('Running all missing evaluations...')

	// For each missing test, we will run the test
	let i = 1
	for (const evaluation of missingEvaluations) {
		const provider = llmProviders[evaluation.providerCode as keyof typeof llmProviders]
		if (!provider) throw new Error(`Provider ${evaluation.providerCode} not found`)
		const model = provider(evaluation.modelVersionCode)

		const temperature =
			modelsWithTemperatures.get(`${evaluation.providerCode}:${evaluation.modelVersionCode}`) ??
			testsConfig.evaluatorsTemperature

		// We extract the array of messages
		const sections = getSectionsFromMarkdownContent(evaluation.evalPromptContent)
		// const testSections = parseMarkdownContent(evaluation.testContent)
		// const evaluationInstructions = extractEvalInstrFromParsedContent(testSections)
		const evaluationInstructions = evaluation.evalInstructionsContent
		if (!evaluationInstructions) throw new Error('💥 Evaluation instructions not found!')
		for (const section of sections) {
			if (section.type === 'system')
				section.content = section.content.replace('{{_evaluationInstructions}}', evaluationInstructions)
			else if (section.type === 'user')
				section.content = section.content.replace('{{_actualResponse}}', evaluation.sessionAnswer)
		}
		const messages = sectionsToAiMessages(sections, true)

		if (messages.length === 0) {
			console.log(`❌ No messages found for evaluation ${evaluation.evalPromptVersionId}`)
			break
		}

		// for each missing judgment
		for (let judgment = evaluation.evaluationsCount; judgment < testsConfig.evaluationsPerEvaluator; judgment++) {
			// run the test
			const startTime = Date.now()
			const response = await generateObject({
				model,
				schema: z.object({
					// Note: `.nullable()` is not supported by some providers (like Vertex AI) as it generates an unsupported `anyOf` schema
					feedback: z
						.string()
						.optional()
						.describe(
							'A string containing feedback for the AI candidate, based on the evaluation instructions, if the evaluation is negative. This feedback should be concise and focus on what failed to pass the evaluation.'
						),

					pass: z
						.boolean()
						.describe(
							"A boolean value indicating whether the AI candidate's response is as expected in the evaluation instructions."
						),
				}),
				messages,
				temperature,
				maxTokens: MAX_TOKENS,
				abortSignal: AbortSignal.timeout(MAX_WAIT_TIME),
			})
			const endTime = Date.now()

			// add the response to the DB as a session
			await db.insert(sessionEvaluations).values({
				sessionId: evaluation.sessionId,
				evaluationPromptVersionId: evaluation.evalPromptVersionId,
				testEvaluationInstructionsVersionId: evaluation.evalInstructionsId,
				modelVersionId: evaluation.modelVersionId,
				temperature,
				pass: response.object.pass ? 1 : 0,
				feedback: response.object.feedback ? response.object.feedback : null, // null if empty
				completionTokens: response.usage.completionTokens,
				promptTokens: response.usage.promptTokens,
				timeTaken: endTime - startTime,
			})

			console.log(
				`✅ Completed eval [${i} of ${totalMissingEvaluations}] with model ${evaluation.modelVersionCode} in ${
					// round to 2 decimal places
					((endTime - startTime) / 1000).toFixed(2)
				}s`
			)
			i++
		}
	}
}
