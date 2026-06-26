const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Middleware to inject provider specific properties. */
export const addProviderSpecificProps = (provider, props) => ({
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
        };
    },
});
