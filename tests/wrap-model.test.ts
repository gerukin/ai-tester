import assert from 'node:assert/strict'
import test from 'node:test'

import { setupRuntimeEnv } from './helpers/test-harness.js'

await setupRuntimeEnv()

const { wrapModel } = await import('../src/llms/helpers/wraper.js')

const createRecordingModel = (provider: string, text = 'plain text') => {
	const calls: unknown[] = []
	const model = {
		specificationVersion: 'v3' as const,
		provider,
		modelId: 'test-model',
		async doGenerate(params: unknown) {
			calls.push(params)
			return {
				content: [{ type: 'text', text }],
				finishReason: 'stop',
				usage: { inputTokens: 3, outputTokens: 2 },
				warnings: [],
				rawCall: { rawPrompt: null, rawSettings: {} },
				rawResponse: { headers: {} },
				response: { id: 'res_1', modelId: 'test-model' },
			}
		},
		async doStream() {
			throw new Error('doStream should not be called in these tests')
		},
	}

	return { model, calls }
}

test('wrapModel merges candidate overrides and injects openai reasoning effort', async () => {
	const { model, calls } = createRecordingModel('openai.responses')
	const wrapped = wrapModel(model, 'candidate', {
		provider: 'openai',
		providerOptions: { parallelToolCalls: false },
		thinking: { effort: 'high' },
		candidateOverrides: {
			providerOptions: { user: 'candidate' },
		},
	})

	await wrapped.doGenerate({
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
		providerOptions: { existing: { keep: true } },
	} as never)

	assert.deepStrictEqual(calls[0], {
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
		providerOptions: {
			existing: { keep: true },
			openai: {
				parallelToolCalls: false,
				user: 'candidate',
				reasoningEffort: 'high',
			},
		},
	})
})

test('wrapModel maps vertex thinking config into the vertex provider namespace', async () => {
	const { model, calls } = createRecordingModel('google.vertex.gemini')
	const wrapped = wrapModel(model, 'candidate', {
		provider: 'vertex',
		providerOptions: { responseMimeType: 'application/json' },
		thinking: { budgetTokens: 64, includeThoughts: true },
	})

	await wrapped.doGenerate({
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
	} as never)

	assert.deepStrictEqual(calls[0], {
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
		providerOptions: {
			vertex: {
				responseMimeType: 'application/json',
				thinkingConfig: {
					includeThoughts: true,
					thinkingBudget: 64,
				},
			},
		},
	})
})

test('wrapModel maps openai-compatible evaluator overrides into the provider namespace', async () => {
	const { model, calls } = createRecordingModel('openrouter.chat')
	const wrapped = wrapModel(model, 'evaluator', {
		provider: 'openai-compatible',
		providerOptions: { topP: 0.9 },
		thinking: { effort: 'low' },
		evaluatorOverrides: {
			providerOptions: { metadata: { lane: 'eval' } },
			thinking: { effort: 'medium' },
		},
	})

	await wrapped.doGenerate({
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
	} as never)

	assert.deepStrictEqual(calls[0], {
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
		providerOptions: {
			openrouter: {
				topP: 0.9,
				metadata: { lane: 'eval' },
				reasoningEffort: 'medium',
			},
		},
	})
})

test('wrapModel maps anthropic thinking enabled and disabled modes correctly', async () => {
	const enabled = createRecordingModel('bedrock.anthropic.claude')
	const enabledWrapped = wrapModel(enabled.model, 'evaluator', {
		provider: 'vertex-anthropic',
		providerOptions: { topK: 4 },
		thinking: { enabled: true, budgetTokens: 32 },
	})
	await enabledWrapped.doGenerate({
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
	} as never)

	assert.deepStrictEqual(enabled.calls[0], {
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
		providerOptions: {
			anthropic: {
				topK: 4,
				thinking: { type: 'enabled', budgetTokens: 32 },
			},
		},
	})

	const disabled = createRecordingModel('bedrock.anthropic.claude')
	const disabledWrapped = wrapModel(disabled.model, 'evaluator', {
		provider: 'vertex-anthropic',
		providerOptions: {},
		thinking: { enabled: false },
	})
	await disabledWrapped.doGenerate({
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
	} as never)

	assert.deepStrictEqual(disabled.calls[0], {
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
		providerOptions: {
			anthropic: {
				thinking: { type: 'disabled' },
			},
		},
	})
})

test('wrapModel extracts reasoning tags only for ollama providers', async () => {
	const ollama = createRecordingModel('ollama.chat', '<think>deliberate</think>visible answer')
	const wrappedOllama = wrapModel(ollama.model, 'candidate', {
		provider: 'ollama',
		providerOptions: {},
		thinking: { extractionTagName: 'think' },
	})

	const ollamaResult = await wrappedOllama.doGenerate({
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
	} as never)

	assert.deepStrictEqual(ollamaResult.content, [
		{ type: 'reasoning', text: 'deliberate' },
		{ type: 'text', text: 'visible answer' },
	])

	const nonOllama = createRecordingModel('openai.responses', '<think>deliberate</think>visible answer')
	const wrappedOpenAI = wrapModel(nonOllama.model, 'candidate', {
		provider: 'openai',
		providerOptions: {},
		thinking: { extractionTagName: 'think' },
	})

	const openAIResult = await wrappedOpenAI.doGenerate({
		inputFormat: 'messages',
		mode: { type: 'regular' },
		prompt: [],
	} as never)

	assert.deepStrictEqual(openAIResult.content, [{ type: 'text', text: '<think>deliberate</think>visible answer' }])
})
