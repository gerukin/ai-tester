import assert from 'node:assert/strict'
import test from 'node:test'

import { schema } from '../src/database/schema.js'
import { refreshEvaluationTokenLimitState, refreshSessionTokenLimitState } from '../src/main/token-limits.js'
import {
	createTestDatabase,
	insertPromptVersion,
	insertProviderModel,
	insertSession,
	insertTestVersion,
} from './helpers/test-harness.js'

test('token-limit refresh keeps equal-limit and non-length session rows active', async t => {
	const harness = await createTestDatabase()
	t.after(async () => {
		await harness.cleanup()
	})

	const { modelVersion } = await insertProviderModel(harness.db, {
		providerCode: 'openai',
		modelCode: 'session-token-state',
		providerModelCode: 'session-token-state',
	})
	const { promptVersion } = await insertPromptVersion(harness.db, {
		code: 'session-token-state-prompt',
		content: 'You are helpful.',
	})
	const { testVersion } = await insertTestVersion(harness.db, {
		content: '# 👤\n\nSay hello.',
		tagNames: ['lang_en'],
		systemPromptVersionId: promptVersion.id,
		hash: 'session-token-state-test',
	})

	await harness.db.insert(schema.sessions).values([
		{
			testVersionId: testVersion.id,
			candidateSysPromptVersionId: promptVersion.id,
			modelVersionId: modelVersion.id,
			temperature: 0.3,
			answer: 'equal length',
			completionTokens: 3000,
			promptTokens: 1,
			timeTaken: 1,
			finishReason: 'length',
			maxOutputTokens: 3000,
		},
		{
			testVersionId: testVersion.id,
			candidateSysPromptVersionId: promptVersion.id,
			modelVersionId: modelVersion.id,
			temperature: 0.3,
			answer: 'stop',
			completionTokens: 1000,
			promptTokens: 1,
			timeTaken: 1,
			finishReason: 'stop',
			maxOutputTokens: 1000,
		},
	])

	await refreshSessionTokenLimitState(harness.db, 3000)

	const sessions = await harness.db.select().from(schema.sessions)
	assert.strictEqual(sessions.find(session => session.answer === 'equal length')?.active, true)
	assert.strictEqual(sessions.find(session => session.answer === 'stop')?.active, true)
})

test('token-limit refresh keeps equal-limit and non-length evaluation rows active', async t => {
	const harness = await createTestDatabase()
	t.after(async () => {
		await harness.cleanup()
	})

	const { modelVersion: candidateModelVersion } = await insertProviderModel(harness.db, {
		providerCode: 'openai',
		modelCode: 'candidate-eval-token-state',
		providerModelCode: 'candidate-eval-token-state',
	})
	const { modelVersion: evaluatorModelVersion } = await insertProviderModel(harness.db, {
		providerCode: 'ollama',
		modelCode: 'evaluator-token-state',
		providerModelCode: 'evaluator-token-state',
	})
	const { promptVersion: systemPromptVersion } = await insertPromptVersion(harness.db, {
		code: 'eval-token-state-system',
		content: 'You are helpful.',
	})
	const { promptVersion: evaluatorPromptVersion } = await insertPromptVersion(harness.db, {
		code: '_evaluator_default',
		content: 'Evaluate.',
	})
	const { testVersion, evaluationInstructionsVersion } = await insertTestVersion(harness.db, {
		content: '# 👤\n\nSay hello.',
		tagNames: ['lang_en'],
		systemPromptVersionId: systemPromptVersion.id,
		evaluationInstructions: 'It should say hello.',
		hash: 'eval-token-state-test',
	})
	assert.ok(evaluationInstructionsVersion)
	const session = await insertSession(harness.db, {
		testVersionId: testVersion.id,
		candidateSysPromptVersionId: systemPromptVersion.id,
		modelVersionId: candidateModelVersion.id,
		answer: 'hello',
	})

	await harness.db.insert(schema.sessionEvaluations).values([
		{
			sessionId: session.id,
			evaluationPromptVersionId: evaluatorPromptVersion.id,
			testEvaluationInstructionsVersionId: evaluationInstructionsVersion!.id,
			modelVersionId: evaluatorModelVersion.id,
			temperature: 0.4,
			pass: 1,
			completionTokens: 3000,
			promptTokens: 1,
			timeTaken: 1,
			finishReason: 'length',
			maxOutputTokens: 3000,
		},
		{
			sessionId: session.id,
			evaluationPromptVersionId: evaluatorPromptVersion.id,
			testEvaluationInstructionsVersionId: evaluationInstructionsVersion!.id,
			modelVersionId: evaluatorModelVersion.id,
			temperature: 0.4,
			pass: 1,
			completionTokens: 1000,
			promptTokens: 1,
			timeTaken: 1,
			finishReason: 'stop',
			maxOutputTokens: 1000,
		},
	])

	await refreshEvaluationTokenLimitState(harness.db, 3000)

	const evaluations = await harness.db.select().from(schema.sessionEvaluations)
	assert.strictEqual(evaluations.find(evaluation => evaluation.completionTokens === 3000)?.active, true)
	assert.strictEqual(evaluations.find(evaluation => evaluation.finishReason === 'stop')?.active, true)
})
