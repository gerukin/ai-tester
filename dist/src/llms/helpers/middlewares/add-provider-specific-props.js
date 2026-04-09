/** Middleware to inject provider specific properties. */
export const addProviderSpecificProps = (provider, props) => ({
    specificationVersion: 'v3',
    transformParams: async ({ params }) => {
        return {
            ...params,
            providerOptions: {
                ...params.providerOptions,
                [provider]: props,
            },
        };
    },
});
