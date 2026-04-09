import assert from 'node:assert/strict'
import test from 'node:test'

import { schema } from '../src/database/schema.js'
import { runAllEvaluationsWithDeps } from '../src/main/evaluations.js'
import {
	createRegistry,
	createTestDatabase,
	insertPromptVersion,
	insertProviderModel,
	insertSession,
	insertTestVersion,
} from './helpers/test-harness.js'

const baseTestsConfig = (candidateProvider: string, candidateModel: string, evaluatorProvider: string, evaluatorModel: string) => ({
	candidates: [{ provider: candidateProvider, model: candidateModel }],
	candidatesTemperature: 0.3,
	attempts: 1,
	requiredTags1: [] as string[],
	requiredTags2: [] as string[],
	prohibitedTags: [] as string[],
	evaluators: [{ provider: evaluatorProvider, model: evaluatorModel }],
	evaluatorsTemperature: 0.4,
	evaluationsPerEvaluator: 1,
	analysisQueries: undefined,
})

const createDeps = (
	{
		db,
		evaluatorProviderCode,
		evaluatorModelCode,
		candidateProviderCode,
		candidateModelCode,
		generateText,
		logModelError = () => undefined,
	}: {
		db: Awaited<ReturnType<typeof createTestDatabase>>['db']
		evaluatorProviderCode: string
		evaluatorModelCode: string
		candidateProviderCode: string
		candidateModelCode: string
		generateText: (...args: unknown[]) => Promise<unknown>
		logModelError?: (...args: unknown[]) => void
	}
) => ({
	db,
	testsConfig: baseTestsConfig(candidateProviderCode, candidateModelCode, evaluatorProviderCode, evaluatorModelCode),
	registry: createRegistry({
		provider: evaluatorProviderCode,
		providerModelCode: evaluatorModelCode,
		providerOptions: {},
		thinking: undefined,
	}),
	confirmRun: async () => true,
	getProvider: (code: string) =>
		code === evaluatorProviderCode
			? ((selectedModelCode: string) =>
					({
						specificationVersion: 'v3',
						provider: `${evaluatorProviderCode}.test`,
						modelId: selectedModelCode,
						doGenerate: async () => {
							throw new Error('generateText stub should be used instead of the model directly')
						},
						doStream: async () => {
							throw new Error('streaming is not used in these tests')
						},
					}) as never)
			: undefined,
	wrapModel: (model: unknown) => model as never,
	generateText: generateText as never,
	logModelError: logModelError as never,
	envConfig: {
		MAX_WAIT_TIME: 1000,
		MAX_EVALUATION_OUTPUT_TOKENS: 1000,
	},
	state: {
		startRun() {},
		endRun() {},
	},
})

const evaluatorPromptContent = [
	'You are grading a candidate answer.',
	'',
	'Evaluation instructions:',
	'',
	'{{_evaluationInstructions}}',
	'',
	'# 👤',
	'',
	'Candidate answer:',
	'',
	'{{_actualResponse}}',
].join('\n')

test('evaluations replace placeholders and persist trimmed feedback and pass state', async t => {
	const harness = await createTestDatabase()
	t.after(async () => {
		await harness.cleanup()
	})

	const { modelVersion: candidateModelVersion } = await insertProviderModel(harness.db, {
		providerCode: 'openai',
		providerName: 'OpenAI',
		modelCode: 'candidate-model',
		providerModelCode: 'candidate-model',
	})
	const { modelVersion: evaluatorModelVersion } = await insertProviderModel(harness.db, {
		providerCode: 'ollama',
		providerName: 'Ollama',
		modelCode: 'judge-model',
		providerModelCode: 'judge-model',
	})
	const { promptVersion: systemPromptVersion } = await insertPromptVersion(harness.db, {
		code: 'candidate-system',
		content: 'You are concise.',
	})
	const { promptVersion: evaluatorPromptVersion } = await insertPromptVersion(harness.db, {
		code: '_evaluator_default',
		content: evaluatorPromptContent,
		hash: 'evaluator-default-hash',
	})
	const { testVersion, evaluationInstructionsVersion } = await insertTestVersion(harness.db, {
		content: '# 👤\n\nWhat is 2 + 2?',
		tagNames: ['reasoning'],
		systemPromptVersionId: systemPromptVersion.id,
		evaluationInstructions: 'The answer must be exactly 4.',
		hash: 'evaluation-test',
	})
	const session = await insertSession(harness.db, {
		testVersionId: testVersion.id,
		candidateSysPromptVersionId: systemPromptVersion.id,
		modelVersionId: candidateModelVersion.id,
		answer: 'It is 5',
	})

	const calls: Array<Record<string, unknown>> = []
	await runAllEvaluationsWithDeps(
		createDeps({
			db: harness.db,
			evaluatorProviderCode: 'ollama',
			evaluatorModelCode: 'judge-model',
			candidateProviderCode: 'openai',
			candidateModelCode: 'candidate-model',
			generateText: async (args: unknown) => {
				calls.push(args as Record<string, unknown>)
				return {
					output: {
						pass: false,
						feedback: '  Expected 4, but the candidate answered 5.  ',
					},
					usage: { inputTokens: 9, outputTokens: 4 },
				}
			},
		})
	)

	const evaluations = await harness.db.select().from(schema.sessionEvaluations)
	assert.strictEqual(evaluations.length, 1)
	assert.strictEqual(evaluations[0]?.sessionId, session.id)
	assert.strictEqual(evaluations[0]?.modelVersionId, evaluatorModelVersion.id)
	assert.strictEqual(evaluations[0]?.evaluationPromptVersionId, evaluatorPromptVersion.id)
	assert.strictEqual(
		evaluations[0]?.testEvaluationInstructionsVersionId,
		evaluationInstructionsVersion?.id
	)
	assert.strictEqual(evaluations[0]?.pass, 0)
	assert.strictEqual(evaluations[0]?.feedback, 'Expected 4, but the candidate answered 5.')
	assert.strictEqual(evaluations[0]?.promptTokens, 9)
	assert.strictEqual(evaluations[0]?.completionTokens, 4)
	assert.ok((evaluations[0]?.timeTaken ?? -1) >= 0)

	const serializedMessages = JSON.stringify(calls[0]?.messages)
	assert.match(serializedMessages, /The answer must be exactly 4\./)
	assert.match(serializedMessages, /It is 5/)
})

test('evaluations persist null feedback when feedback is absent or only whitespace', async t => {
	const harness = await createTestDatabase()
	t.after(async () => {
		await harness.cleanup()
	})

	const { modelVersion: candidateModelVersion } = await insertProviderModel(harness.db, {
		providerCode: 'openai',
		providerName: 'OpenAI',
		modelCode: 'candidate-pass',
		providerModelCode: 'candidate-pass',
	})
	await insertProviderModel(harness.db, {
		providerCode: 'openai-compatible',
		providerName: 'OpenRouter',
		modelCode: 'judge-pass',
		providerModelCode: 'judge-pass',
	})
	const { promptVersion: systemPromptVersion } = await insertPromptVersion(harness.db, {
		code: 'pass-system',
		content: 'You are helpful.',
	})
	await insertPromptVersion(harness.db, {
		code: '_evaluator_default',
		content: evaluatorPromptContent,
		hash: 'evaluator-pass-hash',
	})
	const { testVersion } = await insertTestVersion(harness.db, {
		content: '# 👤\n\nSay the correct answer.',
		tagNames: ['lang_en'],
		systemPromptVersionId: systemPromptVersion.id,
		evaluationInstructions: 'The answer must say "correct".',
		hash: 'evaluation-pass-test',
	})
	await insertSession(harness.db, {
		testVersionId: testVersion.id,
		candidateSysPromptVersionId: systemPromptVersion.id,
		modelVersionId: candidateModelVersion.id,
		answer: 'correct',
	})

	await runAllEvaluationsWithDeps(
		createDeps({
			db: harness.db,
			evaluatorProviderCode: 'openai-compatible',
			evaluatorModelCode: 'judge-pass',
			candidateProviderCode: 'openai',
			candidateModelCode: 'candidate-pass',
			generateText: async () => ({
				output: { pass: true, feedback: '   ' },
				usage: { inputTokens: 4, outputTokens: 2 },
			}),
		})
	)

	const evaluations = await harness.db.select().from(schema.sessionEvaluations)
	assert.strictEqual(evaluations.length, 1)
	assert.strictEqual(evaluations[0]?.feedback, null)
	assert.strictEqual(evaluations[0]?.pass, 1)
	assert.strictEqual(evaluations[0]?.promptTokens, 4)
	assert.strictEqual(evaluations[0]?.completionTokens, 2)
	assert.ok((evaluations[0]?.timeTaken ?? -1) >= 0)
})

test('evaluations with invalid token usage are rejected and not persisted', async t => {
	const harness = await createTestDatabase()
	t.after(async () => {
		await harness.cleanup()
	})

	const { modelVersion: candidateModelVersion } = await insertProviderModel(harness.db, {
		providerCode: 'openai',
		providerName: 'OpenAI',
		modelCode: 'candidate-invalid',
		providerModelCode: 'candidate-invalid',
	})
	await insertProviderModel(harness.db, {
		providerCode: 'ollama',
		providerName: 'Ollama',
		modelCode: 'judge-invalid',
		providerModelCode: 'judge-invalid',
	})
	const { promptVersion: systemPromptVersion } = await insertPromptVersion(harness.db, {
		code: 'invalid-system',
		content: 'You are helpful.',
	})
	await insertPromptVersion(harness.db, {
		code: '_evaluator_default',
		content: evaluatorPromptContent,
		hash: 'evaluator-invalid-hash',
	})
	const { testVersion } = await insertTestVersion(harness.db, {
		content: '# 👤\n\nCheck this answer.',
		tagNames: ['lang_en'],
		systemPromptVersionId: systemPromptVersion.id,
		evaluationInstructions: 'The answer must say ok.',
		hash: 'evaluation-invalid-test',
	})
	await insertSession(harness.db, {
		testVersionId: testVersion.id,
		candidateSysPromptVersionId: systemPromptVersion.id,
		modelVersionId: candidateModelVersion.id,
		answer: 'not ok',
	})

	const loggedErrors: unknown[] = []
	await runAllEvaluationsWithDeps(
		createDeps({
			db: harness.db,
			evaluatorProviderCode: 'ollama',
			evaluatorModelCode: 'judge-invalid',
			candidateProviderCode: 'openai',
			candidateModelCode: 'candidate-invalid',
			generateText: async () => ({
				output: { pass: false, feedback: 'bad answer' },
				usage: { inputTokens: 4, outputTokens: undefined },
			}),
			logModelError: (...args: unknown[]) => {
				loggedErrors.push(args)
			},
		})
	)

	const evaluations = await harness.db.select().from(schema.sessionEvaluations)
	assert.strictEqual(evaluations.length, 0)
	assert.strictEqual(loggedErrors.length, 1)
})
