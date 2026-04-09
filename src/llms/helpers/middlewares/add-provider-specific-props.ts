import type { JSONValue, LanguageModelMiddleware } from 'ai'

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
				[provider]: props,
			},
		}
	},
})
