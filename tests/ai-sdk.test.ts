import assert from 'node:assert/strict'
import test from 'node:test'

import { getRequiredLanguageModelTokenUsage } from '../src/utils/ai-sdk.js'

test('rejects incomplete top-level token usage', () => {
	assert.throws(
		() =>
			getRequiredLanguageModelTokenUsage({
				inputTokens: 4,
				outputTokens: undefined,
				raw: undefined,
				inputTokenDetails: undefined,
			}),
		/The provider did not return complete token usage/
	)
})

test('rejects partial openai-compatible raw usage', () => {
	assert.throws(
		() =>
			getRequiredLanguageModelTokenUsage({
				inputTokens: 10,
				outputTokens: 3,
				inputTokenDetails: undefined,
				raw: {
					prompt_tokens: 10,
					completion_tokens: null,
				},
			}),
		/The provider returned partial token usage/
	)
})

test('rejects partial anthropic raw usage including cache fields', () => {
	assert.throws(
		() =>
			getRequiredLanguageModelTokenUsage({
				inputTokens: 20,
				outputTokens: 5,
				inputTokenDetails: undefined,
				raw: {
					input_tokens: 20,
					output_tokens: 5,
					cache_creation_input_tokens: null,
				},
			}),
		/The provider returned partial token usage/
	)
})

test('rejects partial google raw usage', () => {
	assert.throws(
		() =>
			getRequiredLanguageModelTokenUsage({
				inputTokens: 12,
				outputTokens: 7,
				inputTokenDetails: undefined,
				raw: {
					promptTokenCount: 12,
					candidatesTokenCount: 7,
					thoughtsTokenCount: null,
				},
			}),
		/The provider returned partial token usage/
	)
})

test('preserves cache detail semantics for complete raw usage', () => {
	assert.deepStrictEqual(
		getRequiredLanguageModelTokenUsage({
			inputTokens: 30,
			outputTokens: 9,
			inputTokenDetails: {
				cacheReadTokens: 2,
				cacheWriteTokens: 1,
			},
			raw: {
				input_tokens: 30,
				output_tokens: 9,
				cache_creation_input_tokens: 6,
				cache_read_input_tokens: 4,
			},
		}),
		{
			promptTokens: 30,
			completionTokens: 9,
			cachedPromptTokensRead: 4,
			cachedPromptTokensWritten: 6,
		}
	)
})
