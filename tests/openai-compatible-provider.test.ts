import assert from 'node:assert/strict'
import test from 'node:test'

import createProvider from '../src/llms/providers/openai-compatible.js'
import { wrapModel } from '../src/llms/helpers/wraper.js'

test('openai-compatible provider forwards structured output support to chat models', () => {
	const provider = createProvider({
		code: 'openrouter',
		name: 'OpenRouter',
		type: 'openai-compatible',
		baseURL: 'https://openrouter.ai/api/v1',
		apiKeyEnvVar: 'OPENROUTER_API_KEY',
		supportsStructuredOutputs: true,
	})

	const model = provider('minimax/minimax-m2.5')

	assert.strictEqual(model.supportsStructuredOutputs, true)
})

test('openai-compatible provider keeps structured output support disabled by default', () => {
	const provider = createProvider({
		code: 'compatible',
		name: 'Compatible',
		type: 'openai-compatible',
		baseURL: 'https://compatible.example.com/v1',
		apiKeyEnvVar: 'COMPATIBLE_API_KEY',
		supportsStructuredOutputs: false,
	})

	const model = provider('test-model')

	assert.strictEqual(model.supportsStructuredOutputs, false)
})

test('wrapped openai-compatible provider sends structured output requests as json_schema', async t => {
	const originalFetch = globalThis.fetch
	let requestBody: Record<string, unknown> | undefined

	t.after(() => {
		globalThis.fetch = originalFetch
	})

	globalThis.fetch = async (_input, init) => {
		requestBody = JSON.parse(String(init?.body))

		return new Response(
			JSON.stringify({
				id: 'chatcmpl_test',
				object: 'chat.completion',
				created: 0,
				model: 'minimax/minimax-m2.5',
				choices: [
					{
						index: 0,
						message: {
							role: 'assistant',
							content: '{"pass":true}',
						},
						finish_reason: 'stop',
					},
				],
				usage: {
					prompt_tokens: 1,
					completion_tokens: 1,
					total_tokens: 2,
				},
			}),
			{ status: 200, headers: { 'content-type': 'application/json' } }
		)
	}

	const provider = createProvider({
		code: 'openrouter',
		name: 'OpenRouter',
		type: 'openai-compatible',
		baseURL: 'https://openrouter.ai/api/v1',
		apiKeyEnvVar: 'OPENROUTER_API_KEY',
		supportsStructuredOutputs: true,
	})
	const wrappedModel = wrapModel(provider('minimax/minimax-m2.5'), 'candidate', {
		provider: 'openrouter',
		providerOptions: { user: 'test-user' },
		thinking: undefined,
	})

	const result = await wrappedModel.doGenerate({
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [{ role: 'user', content: [{ type: 'text', text: 'Return JSON.' }] }],
		responseFormat: {
			type: 'json',
			name: 'response',
			schema: {
				type: 'object',
				properties: {
					pass: { type: 'boolean' },
				},
				required: ['pass'],
				additionalProperties: false,
			},
		},
	} as never)

	assert.deepStrictEqual(result.warnings, [])
	assert.deepStrictEqual(requestBody?.['response_format'], {
		type: 'json_schema',
		json_schema: {
			name: 'response',
			strict: true,
			schema: {
				type: 'object',
				properties: {
					pass: { type: 'boolean' },
				},
				required: ['pass'],
				additionalProperties: false,
			},
		},
	})
})
