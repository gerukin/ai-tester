import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
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
		registryModel = {
			provider: providerCode,
			providerModelCode: modelCode,
			providerOptions: {},
			thinking: undefined,
			capabilities: {
				input: { text: true, image: true, file: true, pdf: true },
				output: { text: true, structured: true, tools: true, reasoning: true },
			},
		},
		generateText,
		logModelError = () => undefined,
		maxTestOutputTokens = 2000,
	}: {
		db: Awaited<ReturnType<typeof createTestDatabase>>['db']
		testsDir: string
		providerCode: string
		modelCode: string
		registryModel?: Record<string, unknown>
		generateText: (...args: unknown[]) => Promise<unknown>
		logModelError?: (...args: unknown[]) => void
		maxTestOutputTokens?: number
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
		MAX_TEST_OUTPUT_TOKENS: maxTestOutputTokens,
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

test('sessions skip unsupported declared model capabilities before provider calls', async t => {
	const scenarios = [
		{
			name: 'text input',
			hash: 'unsupported-text-input',
			content: '# 👤\n\nSay hello.',
			capabilities: {
				input: { text: false, image: true, file: true, pdf: true },
				output: { text: true, structured: true, tools: true, reasoning: true },
			},
		},
		{
			name: 'plain text output',
			hash: 'unsupported-text-output',
			content: '# 👤\n\nSay hello.',
			capabilities: {
				input: { text: true, image: true, file: true, pdf: true },
				output: { text: false, structured: true, tools: true, reasoning: true },
			},
		},
		{
			name: 'image input',
			hash: 'unsupported-image-input',
			content: '# 👤\n\nRead this image: `{{_file:fixtures/sample.png}}`',
			file: { path: 'fixtures/sample.png', content: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
			capabilities: {
				input: { text: true, image: false, file: true, pdf: true },
				output: { text: true, structured: true, tools: true, reasoning: true },
			},
		},
		{
			name: 'file input',
			hash: 'unsupported-file-input',
			content: '# 👤\n\nRead this file: `{{_file:fixtures/sample.txt}}`',
			file: { path: 'fixtures/sample.txt', content: 'sample text' },
			capabilities: {
				input: { text: true, image: true, file: false, pdf: true },
				output: { text: true, structured: true, tools: true, reasoning: true },
			},
		},
		{
			name: 'PDF input',
			hash: 'unsupported-pdf-input',
			content: '# 👤\n\nRead this PDF: `{{_file:fixtures/sample.pdf}}`',
			file: { path: 'fixtures/sample.pdf', content: '%PDF-1.4' },
			capabilities: {
				input: { text: true, image: true, file: true, pdf: false },
				output: { text: true, structured: true, tools: true, reasoning: true },
			},
		},
		{
			name: 'structured output',
			hash: 'unsupported-structured-output',
			content: '# 👤\n\nExtract the invoice id.',
			structured: true,
			capabilities: {
				input: { text: true, image: true, file: true, pdf: true },
				output: { text: true, structured: false, tools: true, reasoning: true },
			},
		},
		{
			name: 'tool output',
			hash: 'unsupported-tool-output',
			content: '# 👤\n\nWhat is the weather?',
			tools: true,
			capabilities: {
				input: { text: true, image: true, file: true, pdf: true },
				output: { text: true, structured: true, tools: false, reasoning: true },
			},
		},
	]

	for (const scenario of scenarios) {
		await t.test(scenario.name, async t => {
			const harness = await createTestDatabase()
			t.after(async () => {
				await harness.cleanup()
			})

			await insertProviderModel(harness.db, {
				providerCode: 'openai',
				providerName: 'OpenAI',
				modelCode: scenario.hash,
				providerModelCode: scenario.hash,
			})
			const { promptVersion } = await insertPromptVersion(harness.db, {
				code: `${scenario.hash}-prompt`,
				content: 'You are helpful.',
			})

			let structuredObjectVersionId: number | undefined
			if (scenario.structured) {
				const { structuredObjectVersion } = await insertStructuredObjectVersion(harness.db, {
					code: scenario.hash,
					schemaObject: {
						type: 'object',
						properties: { invoiceId: { type: 'string' } },
						required: ['invoiceId'],
						additionalProperties: false,
					},
				})
				structuredObjectVersionId = structuredObjectVersion.id
			}

			const toolVersionIds: number[] = []
			if (scenario.tools) {
				const { toolVersion } = await insertToolVersion(harness.db, {
					code: scenario.hash,
					schemaObject: {
						name: 'lookup',
						description: 'Lookup data',
						parameters: {
							type: 'object',
							properties: { query: { type: 'string' } },
							required: ['query'],
							additionalProperties: false,
						},
					},
				})
				toolVersionIds.push(toolVersion.id)
			}

			if (scenario.file) {
				const filePath = path.join(harness.rootDir, scenario.file.path)
				await fs.mkdir(path.dirname(filePath), { recursive: true })
				await fs.writeFile(filePath, scenario.file.content)
			}

			await insertTestVersion(harness.db, {
				content: scenario.content,
				tagNames: ['lang_en'],
				systemPromptVersionId: promptVersion.id,
				structuredObjectVersionId,
				toolVersionIds,
				hash: scenario.hash,
			})

			let calls = 0
			await runAllTestsWithDeps(
				createDeps({
					db: harness.db,
					testsDir: harness.rootDir,
					providerCode: 'openai',
					modelCode: scenario.hash,
					registryModel: {
						provider: 'openai',
						providerModelCode: scenario.hash,
						providerOptions: {},
						thinking: undefined,
						capabilities: scenario.capabilities,
					},
					generateText: async () => {
						calls += 1
						throw new Error('generateText should not be called for unsupported capabilities')
					},
				})
			)

			assert.strictEqual(calls, 0)
			assert.strictEqual((await harness.db.select().from(schema.sessions)).length, 0)
		})
	}
})

test('sessions warn and run when model capabilities are undeclared', async t => {
	const harness = await createTestDatabase()
	t.after(async () => {
		await harness.cleanup()
	})

	await insertProviderModel(harness.db, {
		providerCode: 'openai',
		providerName: 'OpenAI',
		modelCode: 'undeclared-capabilities',
		providerModelCode: 'undeclared-capabilities',
	})
	const { promptVersion } = await insertPromptVersion(harness.db, {
		code: 'undeclared-capabilities-prompt',
		content: 'You are helpful.',
	})
	await insertTestVersion(harness.db, {
		content: '# 👤\n\nSay hello.',
		tagNames: ['lang_en'],
		systemPromptVersionId: promptVersion.id,
		hash: 'undeclared-capabilities-test',
	})

	const warnings: string[] = []
	const originalWarn = console.warn
	console.warn = (message?: unknown) => {
		warnings.push(String(message))
	}
	try {
		await runAllTestsWithDeps(
			createDeps({
				db: harness.db,
				testsDir: harness.rootDir,
				providerCode: 'openai',
				modelCode: 'undeclared-capabilities',
				registryModel: {
					provider: 'openai',
					providerModelCode: 'undeclared-capabilities',
					providerOptions: {},
					thinking: undefined,
				},
				generateText: async () => ({
					text: 'hello',
					usage: { inputTokens: 3, outputTokens: 1 },
					finishReason: 'stop',
				}),
			})
		)
	} finally {
		console.warn = originalWarn
	}

	assert.strictEqual(warnings.length, 1)
	assert.match(warnings[0] ?? '', /has no capabilities declaration/)
	assert.strictEqual((await harness.db.select().from(schema.sessions)).length, 1)
})

test('sessions persist finish metadata and replace old token-limit hits when max output tokens increase', async t => {
	const harness = await createTestDatabase()
	t.after(async () => {
		await harness.cleanup()
	})

	const { modelVersion } = await insertProviderModel(harness.db, {
		providerCode: 'openai',
		providerName: 'OpenAI',
		modelCode: 'token-limit-model',
		providerModelCode: 'token-limit-model',
	})
	const { promptVersion } = await insertPromptVersion(harness.db, {
		code: 'token-limit-prompt',
		content: 'You are concise.',
	})
	const { testVersion } = await insertTestVersion(harness.db, {
		content: '# 👤\n\nSay hello.',
		tagNames: ['lang_en'],
		systemPromptVersionId: promptVersion.id,
		hash: 'token-limit-test',
	})
	await harness.db.insert(schema.sessions).values({
		testVersionId: testVersion.id,
		candidateSysPromptVersionId: promptVersion.id,
		modelVersionId: modelVersion.id,
		temperature: 0.3,
		answer: 'old truncated answer',
		completionTokens: 2000,
		promptTokens: 20,
		timeTaken: 10,
	})

	let calls = 0
	await runAllTestsWithDeps(
		createDeps({
			db: harness.db,
			testsDir: harness.rootDir,
			providerCode: 'openai',
			modelCode: 'token-limit-model',
			generateText: async () => {
				calls += 1
				throw new Error('existing row should be counted before the limit increases')
			},
		})
	)
	assert.strictEqual(calls, 0)
	let sessions = await harness.db.select().from(schema.sessions)
	assert.strictEqual(sessions.length, 1)
	assert.strictEqual(sessions[0]?.active, true)
	assert.strictEqual(sessions[0]?.finishReason, 'length')
	assert.strictEqual(sessions[0]?.maxOutputTokens, 2000)

	await runAllTestsWithDeps(
		createDeps({
			db: harness.db,
			testsDir: harness.rootDir,
			providerCode: 'openai',
			modelCode: 'token-limit-model',
			maxTestOutputTokens: 3000,
			generateText: async () => {
				calls += 1
				return {
					text: 'new complete answer',
					usage: { inputTokens: 4, outputTokens: 2 },
					finishReason: 'stop',
				}
			},
		})
	)

	sessions = await harness.db.select().from(schema.sessions)
	assert.strictEqual(calls, 1)
	assert.strictEqual(sessions.length, 2)
	assert.strictEqual(sessions.find(session => session.answer === 'old truncated answer')?.active, false)
	const newSession = sessions.find(session => session.answer === 'new complete answer')
	assert.ok(newSession)
	assert.strictEqual(newSession!.active, true)
	assert.strictEqual(newSession!.finishReason, 'stop')
	assert.strictEqual(newSession!.maxOutputTokens, 3000)
})
