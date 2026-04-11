import assert from 'node:assert/strict'
import test from 'node:test'

import { schema } from '../src/database/schema.js'
import { runAllTestsWithDeps } from '../src/main/sessions.js'
import {
	createRegistry,
	createTestDatabase,
	insertPromptVersion,
	insertProviderModel,
	insertStructuredObjectVersion,
	insertTestVersion,
	insertToolVersion,
} from './helpers/test-harness.js'

const baseTestsConfig = (provider: string, model: string) => ({
	candidates: [{ provider, model }],
	candidatesTemperature: 0.3,
	attempts: 1,
	requiredTags1: [] as string[],
	requiredTags2: [] as string[],
	prohibitedTags: [] as string[],
	evaluators: [] as Array<{ provider: string; model: string }>,
	evaluatorsTemperature: 0.4,
	evaluationsPerEvaluator: 1,
	analysisQueries: undefined,
})

const createDeps = (
	{
		db,
		testsDir,
		providerCode,
		modelCode,
		registryModel = { provider: providerCode, providerModelCode: modelCode, providerOptions: {}, thinking: undefined },
		generateText,
		logModelError = () => undefined,
	}: {
		db: Awaited<ReturnType<typeof createTestDatabase>>['db']
		testsDir: string
		providerCode: string
		modelCode: string
		registryModel?: Record<string, unknown>
		generateText: (...args: unknown[]) => Promise<unknown>
		logModelError?: (...args: unknown[]) => void
	}
) => ({
	db,
	testsConfig: baseTestsConfig(providerCode, modelCode),
	registry: createRegistry(registryModel as never),
	confirmRun: async () => true,
	getProvider: (code: string) =>
		code === providerCode
			? ((selectedModelCode: string) =>
					({
						specificationVersion: 'v3',
						provider: `${providerCode}.test`,
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
		AI_TESTER_TESTS_DIR: testsDir,
		MAX_WAIT_TIME: 1000,
		MAX_TEST_OUTPUT_TOKENS: 2000,
	},
	state: {
		startRun() {},
		endRun() {},
	},
})

test('plain text sessions persist trimmed answer, reasoning, time, and token counts', async t => {
	const harness = await createTestDatabase()
	t.after(async () => {
		await harness.cleanup()
	})

	const { modelVersion } = await insertProviderModel(harness.db, {
		providerCode: 'openai',
		providerName: 'OpenAI',
		modelCode: 'gpt-test',
		providerModelCode: 'gpt-test',
	})
	const { promptVersion } = await insertPromptVersion(harness.db, {
		code: 'system-prompt',
		content: 'You are helpful.',
	})
	await insertTestVersion(harness.db, {
		content: '# 👤\n\nSay hello.',
		tagNames: ['lang_en'],
		systemPromptVersionId: promptVersion.id,
		hash: 'plain-text-test',
	})

	const calls: unknown[] = []
	await runAllTestsWithDeps(
		createDeps({
			db: harness.db,
			testsDir: harness.rootDir,
			providerCode: 'openai',
			modelCode: 'gpt-test',
			generateText: async (args: unknown) => {
				calls.push(args)
				return {
					text: '  hello there  ',
					reasoningText: '  because it is polite  ',
					usage: { inputTokens: 11, outputTokens: 7 },
				}
			},
		})
	)

	const sessions = await harness.db.select().from(schema.sessions)
	assert.strictEqual(sessions.length, 1)
	assert.strictEqual(sessions[0]?.modelVersionId, modelVersion.id)
	assert.strictEqual(sessions[0]?.answer, 'hello there')
	assert.strictEqual(sessions[0]?.reasoning, 'because it is polite')
	assert.strictEqual(sessions[0]?.promptTokens, 11)
	assert.strictEqual(sessions[0]?.completionTokens, 7)
	assert.ok((sessions[0]?.timeTaken ?? -1) >= 0)
	assert.strictEqual(calls.length, 1)
})

test('ollama tool-call sessions pass tool schemas and persist serialized tool calls', async t => {
	const harness = await createTestDatabase()
	t.after(async () => {
		await harness.cleanup()
	})

	await insertProviderModel(harness.db, {
		providerCode: 'ollama',
		providerName: 'Ollama',
		modelCode: 'llama-tool',
		providerModelCode: 'llama-tool',
	})
	const { promptVersion } = await insertPromptVersion(harness.db, {
		code: 'tool-prompt',
		content: 'Use tools when needed.',
	})
	const { toolVersion } = await insertToolVersion(harness.db, {
		code: 'city-weather',
		schemaObject: {
			name: 'cityWeather',
			description: 'Look up the weather for a city',
			parameters: {
				type: 'object',
				properties: {
					cityName: { type: 'string' },
				},
				required: ['cityName'],
				additionalProperties: false,
			},
		},
	})
	await insertTestVersion(harness.db, {
		content: '# 👤\n\nWhat is the weather in Tokyo?',
		tagNames: ['tool_use'],
		systemPromptVersionId: promptVersion.id,
		toolVersionIds: [toolVersion.id],
		hash: 'tool-call-test',
	})

	const calls: Array<Record<string, unknown>> = []
	await runAllTestsWithDeps(
		createDeps({
			db: harness.db,
			testsDir: harness.rootDir,
			providerCode: 'ollama',
			modelCode: 'llama-tool',
			generateText: async (args: unknown) => {
				calls.push(args as Record<string, unknown>)
				return {
					text: '',
					toolCalls: [{ toolName: 'cityWeather', input: { cityName: 'Tokyo' } }],
					usage: { inputTokens: 9, outputTokens: 2 },
				}
			},
		})
	)

	const sessions = await harness.db.select().from(schema.sessions)
	assert.strictEqual(sessions.length, 1)
	assert.strictEqual(
		sessions[0]?.answer,
		JSON.stringify([{ name: 'cityWeather', arguments: { cityName: 'Tokyo' } }])
	)
	assert.ok(calls[0]?.tools)
	assert.deepStrictEqual(Object.keys(calls[0]?.tools as Record<string, unknown>), ['cityWeather'])
})

test('ollama structured-output sessions persist serialized objects with reasoning text', async t => {
	const harness = await createTestDatabase()
	t.after(async () => {
		await harness.cleanup()
	})

	await insertProviderModel(harness.db, {
		providerCode: 'ollama',
		providerName: 'Ollama',
		modelCode: 'llama-structured',
		providerModelCode: 'llama-structured',
	})
	const { promptVersion } = await insertPromptVersion(harness.db, {
		code: 'structured-prompt',
		content: 'Return structured data.',
	})
	const { structuredObjectVersion } = await insertStructuredObjectVersion(harness.db, {
		code: 'invoice',
		schemaObject: {
			type: 'object',
			properties: {
				invoiceId: { type: 'string' },
			},
			required: ['invoiceId'],
			additionalProperties: false,
		},
	})
	await insertTestVersion(harness.db, {
		content: '# 👤\n\nExtract the invoice id.',
		tagNames: ['data_extraction'],
		systemPromptVersionId: promptVersion.id,
		structuredObjectVersionId: structuredObjectVersion.id,
		hash: 'structured-test',
	})

	const calls: Array<Record<string, unknown>> = []
	await runAllTestsWithDeps(
		createDeps({
			db: harness.db,
			testsDir: harness.rootDir,
			providerCode: 'ollama',
			modelCode: 'llama-structured',
			generateText: async (args: unknown) => {
				calls.push(args as Record<string, unknown>)
				return {
					output: { invoiceId: 'INV-42' },
					reasoningText: '  extracted the invoice id from the document  ',
					usage: { inputTokens: 8, outputTokens: 3 },
				}
			},
		})
	)

	const sessions = await harness.db.select().from(schema.sessions)
	assert.strictEqual(sessions.length, 1)
	assert.strictEqual(sessions[0]?.answer, JSON.stringify({ invoiceId: 'INV-42' }))
	assert.strictEqual(sessions[0]?.reasoning, 'extracted the invoice id from the document')
	assert.ok(calls[0]?.output)
})

test('sessions with invalid token usage are rejected and not persisted', async t => {
	const harness = await createTestDatabase()
	t.after(async () => {
		await harness.cleanup()
	})

	await insertProviderModel(harness.db, {
		providerCode: 'openai',
		providerName: 'OpenAI',
		modelCode: 'gpt-invalid-usage',
		providerModelCode: 'gpt-invalid-usage',
	})
	const { promptVersion } = await insertPromptVersion(harness.db, {
		code: 'invalid-usage-prompt',
		content: 'Reply briefly.',
	})
	await insertTestVersion(harness.db, {
		content: '# 👤\n\nSay something.',
		tagNames: ['lang_en'],
		systemPromptVersionId: promptVersion.id,
		hash: 'invalid-usage-test',
	})

	const loggedErrors: unknown[] = []
	await runAllTestsWithDeps(
		createDeps({
			db: harness.db,
			testsDir: harness.rootDir,
			providerCode: 'openai',
			modelCode: 'gpt-invalid-usage',
			generateText: async () => ({
				text: 'ignored',
				usage: { inputTokens: 5, outputTokens: undefined },
			}),
			logModelError: (...args: unknown[]) => {
				loggedErrors.push(args)
			},
		})
	)

	const sessions = await harness.db.select().from(schema.sessions)
	assert.strictEqual(sessions.length, 0)
	assert.strictEqual(loggedErrors.length, 1)
})
