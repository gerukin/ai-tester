import assert from 'node:assert/strict'
import test from 'node:test'

import { schema } from '../src/database/schema.js'
import {
	createSyncTestEnv,
	insertPromptVersion,
	insertProviderModel,
	insertSession,
	insertTestVersion,
} from './helpers/test-harness.js'

const expectModuleSuccess = (result: { status: number | null; stdout: string; stderr: string }) => {
	assert.strictEqual(
		result.status,
		0,
		`Expected module success.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
	)
	return JSON.parse(result.stdout) as {
		result: unknown
		logs: unknown[][]
		tables: unknown[][]
	}
}

test('showStats warns when the query has no active candidate models', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const output = expectModuleSuccess(
		env.runModule('stats:show', {
			description: 'Empty query',
			currency: 'USD',
			candidates: [],
		})
	)

	assert.deepStrictEqual(output.tables, [])
	assert.deepStrictEqual(output.logs, [
		['Checking for stats...'],
		['⚠️ Query "Empty query" has no active candidate models.'],
	])
})

test('showStats aggregates filtered sessions, evaluations, and converted costs', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const { modelVersion: candidateModelVersion } = await insertProviderModel(env.db, {
		providerCode: 'candidate-provider',
		modelCode: 'candidate-model',
		providerModelCode: 'candidate-model',
	})
	const { modelVersion: evaluatorModelVersion } = await insertProviderModel(env.db, {
		providerCode: 'evaluator-provider',
		modelCode: 'evaluator-model',
		providerModelCode: 'evaluator-model',
	})
	const { promptVersion: candidatePromptVersion } = await insertPromptVersion(env.db, {
		code: 'candidate-prompt',
		content: 'Answer briefly.',
	})
	const { promptVersion: evaluatorPromptVersion } = await insertPromptVersion(env.db, {
		code: 'evaluator-prompt',
		content: 'Judge pass/fail.',
	})
	const { testVersion: shipTestVersion, evaluationInstructionsVersion } = await insertTestVersion(env.db, {
		content: '# 👤\n\nShip it',
		tagNames: ['ship'],
		systemPromptVersionId: candidatePromptVersion.id,
		evaluationInstructions: 'Check correctness',
		hash: 'ship-test',
	})
	const { testVersion: skipTestVersion } = await insertTestVersion(env.db, {
		content: '# 👤\n\nSkip it',
		tagNames: ['skip'],
		systemPromptVersionId: candidatePromptVersion.id,
		evaluationInstructions: 'Check correctness',
		hash: 'skip-test',
	})

	const [usd] = await env.db.insert(schema.currencies).values({ code: 'USD' }).returning()
	const [jpy] = await env.db.insert(schema.currencies).values({ code: 'JPY' }).returning()
	await env.db.insert(schema.currencyRates).values([
		{ currencyId: usd.id, rateInUSD: 1, validFrom: new Date('2025-01-01T00:00:00Z') },
		{ currencyId: jpy.id, rateInUSD: 0.01, validFrom: new Date('2025-01-01T00:00:00Z') },
	])
	await env.db.insert(schema.modelCosts).values({
		modelVersionId: candidateModelVersion.id,
		currencyId: usd.id,
		costPerCall: 1,
		costPerPromptToken: 0,
		costPerCompletionToken: 0,
		costPerHour: 0,
		validFrom: new Date('2025-01-01T00:00:00Z'),
	})

	const matchingSession = await insertSession(env.db, {
		testVersionId: shipTestVersion.id,
		candidateSysPromptVersionId: candidatePromptVersion.id,
		modelVersionId: candidateModelVersion.id,
		answer: 'match',
		temperature: 0.3,
		promptTokens: 5,
		completionTokens: 7,
	})
	const wrongTempSession = await insertSession(env.db, {
		testVersionId: shipTestVersion.id,
		candidateSysPromptVersionId: candidatePromptVersion.id,
		modelVersionId: candidateModelVersion.id,
		answer: 'wrong temp',
		temperature: 0.9,
		promptTokens: 5,
		completionTokens: 7,
	})
	const skippedSession = await insertSession(env.db, {
		testVersionId: skipTestVersion.id,
		candidateSysPromptVersionId: candidatePromptVersion.id,
		modelVersionId: candidateModelVersion.id,
		answer: 'skip',
		temperature: 0.3,
		promptTokens: 5,
		completionTokens: 7,
	})

	assert.ok(evaluationInstructionsVersion)
	await env.db.insert(schema.sessionEvaluations).values([
		{
			sessionId: matchingSession.id,
			evaluationPromptVersionId: evaluatorPromptVersion.id,
			testEvaluationInstructionsVersionId: evaluationInstructionsVersion.id,
			modelVersionId: evaluatorModelVersion.id,
			temperature: 0.4,
			pass: 1,
			feedback: 'good',
			completionTokens: 2,
			promptTokens: 2,
			timeTaken: 20,
		},
		{
			sessionId: wrongTempSession.id,
			evaluationPromptVersionId: evaluatorPromptVersion.id,
			testEvaluationInstructionsVersionId: evaluationInstructionsVersion.id,
			modelVersionId: evaluatorModelVersion.id,
			temperature: 0.4,
			pass: 0,
			feedback: 'wrong candidate temperature',
			completionTokens: 2,
			promptTokens: 2,
			timeTaken: 20,
		},
		{
			sessionId: skippedSession.id,
			evaluationPromptVersionId: evaluatorPromptVersion.id,
			testEvaluationInstructionsVersionId: evaluationInstructionsVersion.id,
			modelVersionId: evaluatorModelVersion.id,
			temperature: 0.4,
			pass: 0,
			feedback: 'skip tag',
			completionTokens: 2,
			promptTokens: 2,
			timeTaken: 20,
		},
	])

	const output = expectModuleSuccess(
		env.runModule('stats:show', {
			description: 'Candidate stats',
			currency: 'JPY',
			requiredTags1: ['ship'],
			prohibitedTags: ['skip'],
			candidatesTemperature: 0.3,
			evaluatorsTemperature: 0.4,
			candidates: [
				{
					provider: 'candidate-provider',
					model: 'candidate-model',
					temperature: 0.3,
				},
			],
			evaluators: [
				{
					provider: 'evaluator-provider',
					model: 'evaluator-model',
					temperature: 0.4,
				},
			],
		})
	)

	assert.deepStrictEqual(output.logs, [['Checking for stats...']])
	assert.strictEqual(output.tables.length, 1)

	const table = output.tables[0]?.[0] as Record<string, Record<string, string | number>>
	assert.deepStrictEqual(table['candidate-model'], {
		Provider: 'candidate-provider',
		'✅%': 100,
		'sess.': 1,
		tests: 1,
		evals: 1,
		'💰/💯sess.': '¥10,000',
		'Tot.💰': '¥100',
	})
})
