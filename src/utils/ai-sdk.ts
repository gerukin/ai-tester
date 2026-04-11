import type { JSONValue, LanguageModelUsage } from 'ai'

const isJsonObject = (value: JSONValue | undefined): value is Record<string, JSONValue> =>
	value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)

const getOptionalNumber = (value: JSONValue | undefined) => (typeof value === 'number' ? value : undefined)

export const getTrimmedReasoningText = (reasoningText: string | undefined) => {
	const reasoning = reasoningText?.trim()
	return reasoning ? reasoning : undefined
}

const isOpenAICompatibleUsageShape = (raw: JSONValue | undefined): raw is Record<string, JSONValue> =>
	isJsonObject(raw) &&
	['prompt_tokens', 'completion_tokens', 'prompt_tokens_details', 'completion_tokens_details'].some(key =>
		Object.hasOwn(raw, key)
	)

const isAnthropicUsageShape = (raw: JSONValue | undefined): raw is Record<string, JSONValue> =>
	isJsonObject(raw) &&
	['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'iterations'].some(key =>
		Object.hasOwn(raw, key)
	)

const isGoogleUsageShape = (raw: JSONValue | undefined): raw is Record<string, JSONValue> =>
	isJsonObject(raw) &&
	[
		'promptTokenCount',
		'candidatesTokenCount',
		'cachedContentTokenCount',
		'thoughtsTokenCount',
		'promptTokensDetails',
		'candidatesTokensDetails',
		'trafficType',
	].some(key => Object.hasOwn(raw, key))

export const getRequiredLanguageModelTokenUsage = (
	usage: Pick<LanguageModelUsage, 'inputTokens' | 'outputTokens' | 'inputTokenDetails' | 'raw'>
) => {
	if (usage.inputTokens === undefined || usage.outputTokens === undefined) {
		throw new Error('The provider did not return complete token usage. Refusing to persist inaccurate token counts.')
	}

	const rawUsage = usage.raw
	let cachedPromptTokensRead = usage.inputTokenDetails?.cacheReadTokens
	let cachedPromptTokensWritten = usage.inputTokenDetails?.cacheWriteTokens

	if (isOpenAICompatibleUsageShape(rawUsage)) {
		if (rawUsage['prompt_tokens'] == null || rawUsage['completion_tokens'] == null) {
			throw new Error('The provider returned partial token usage. Refusing to persist inaccurate token counts.')
		}

		const promptTokenDetails = rawUsage['prompt_tokens_details']
		cachedPromptTokensRead = isJsonObject(promptTokenDetails)
			? getOptionalNumber(promptTokenDetails['cached_tokens'])
			: undefined
	}

	if (isAnthropicUsageShape(rawUsage)) {
		if (rawUsage['input_tokens'] == null || rawUsage['output_tokens'] == null) {
			throw new Error('The provider returned partial token usage. Refusing to persist inaccurate token counts.')
		}

		if (Object.hasOwn(rawUsage, 'cache_creation_input_tokens') && rawUsage['cache_creation_input_tokens'] == null) {
			throw new Error('The provider returned partial token usage. Refusing to persist inaccurate token counts.')
		}

		if (Object.hasOwn(rawUsage, 'cache_read_input_tokens') && rawUsage['cache_read_input_tokens'] == null) {
			throw new Error('The provider returned partial token usage. Refusing to persist inaccurate token counts.')
		}

		cachedPromptTokensWritten = Object.hasOwn(rawUsage, 'cache_creation_input_tokens')
			? getOptionalNumber(rawUsage['cache_creation_input_tokens'])
			: undefined
		cachedPromptTokensRead = Object.hasOwn(rawUsage, 'cache_read_input_tokens')
			? getOptionalNumber(rawUsage['cache_read_input_tokens'])
			: undefined
	}

	if (isGoogleUsageShape(rawUsage)) {
		if (rawUsage['promptTokenCount'] == null || rawUsage['candidatesTokenCount'] == null) {
			throw new Error('The provider returned partial token usage. Refusing to persist inaccurate token counts.')
		}

		if (Object.hasOwn(rawUsage, 'thoughtsTokenCount') && rawUsage['thoughtsTokenCount'] == null) {
			throw new Error('The provider returned partial token usage. Refusing to persist inaccurate token counts.')
		}

		cachedPromptTokensRead = Object.hasOwn(rawUsage, 'cachedContentTokenCount')
			? getOptionalNumber(rawUsage['cachedContentTokenCount'])
			: undefined
		cachedPromptTokensWritten = undefined
	}

	return {
		promptTokens: usage.inputTokens,
		completionTokens: usage.outputTokens,
		cachedPromptTokensRead,
		cachedPromptTokensWritten,
	}
}
