import type { JSONValue, LanguageModelMiddleware } from 'ai'

const isRecord = (value: unknown): value is Record<string, JSONValue> =>
	value !== null && typeof value === 'object' && !Array.isArray(value)

/** Middleware to inject provider specific properties. */
export const addProviderSpecificProps = (
	provider: string,
	props: Record<string, JSONValue>
): LanguageModelMiddleware => ({
	specificationVersion: 'v3',
	transformParams: async ({ params }) => {
		return {
			...params,

			providerOptions: {
				...params.providerOptions,
				[provider]: {
					...(isRecord(params.providerOptions?.[provider]) ? params.providerOptions[provider] : {}),
					...props,
				},
			},
		}
	},
})
