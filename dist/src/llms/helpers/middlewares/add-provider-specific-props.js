/** Middleware to inject provider specific properties. */
export const addProviderSpecificProps = (provider, props) => ({
    transformParams: async ({ params }) => {
        return {
            ...params,
            providerMetadata: {
                ...params.providerMetadata,
                [provider]: props,
            },
        };
    },
});
