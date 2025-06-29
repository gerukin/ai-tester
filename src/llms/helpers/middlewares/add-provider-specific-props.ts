import type { LanguageModelV1Middleware } from 'ai'

/** Middleware to inject provider specific properties. */
export const addProviderSpecificProps = (provider: string, props: Record<string, any>): LanguageModelV1Middleware => ({
	transformParams: async ({ params }) => {
		return {
			...params,

			providerMetadata: {
				...params.providerMetadata,
				[provider]: props,
			},
		}
	},
})
