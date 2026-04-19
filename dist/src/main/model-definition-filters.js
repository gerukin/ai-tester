import { and, eq, isNull } from 'drizzle-orm';
import { getModelRuntimeIdentityKeyFromParts, getModelRuntimeOptionsJson, } from '../config/model-registry.js';
export const getConfiguredModelDefinition = (registry, configuredModel) => {
    const modelDefinition = registry.modelsById.get(configuredModel.id);
    if (!modelDefinition) {
        throw new Error(`Configured model ${configuredModel.id} is not available in the active model registry.`);
    }
    return modelDefinition;
};
export const getConfiguredModelDefinitions = (registry, configuredModels) => configuredModels.map(configuredModel => getConfiguredModelDefinition(registry, configuredModel));
export const modelVersionMatchesDefinition = (providerTable, modelVersionTable, modelDefinition, role) => and(eq(providerTable.code, modelDefinition.provider), eq(modelVersionTable.providerModelCode, modelDefinition.providerModelCode), eq(modelVersionTable.runtimeOptionsJson, getModelRuntimeOptionsJson(modelDefinition, role)), modelDefinition.extraIdentifier
    ? eq(modelVersionTable.extraIdentifier, modelDefinition.extraIdentifier)
    : isNull(modelVersionTable.extraIdentifier));
export const getModelDefinitionForVersion = (registry, row) => registry.modelsByRuntimeIdentity.get(getModelRuntimeIdentityKeyFromParts({
    provider: row.providerCode,
    providerModelCode: row.modelVersionCode,
    extraIdentifier: row.modelVersionExtraIdentifier,
    runtimeOptionsJson: row.modelVersionRuntimeOptionsJson,
}));
export const getModelVersionLabel = (registry, row) => getModelDefinitionForVersion(registry, row)?.id ??
    getModelRuntimeIdentityKeyFromParts({
        provider: row.providerCode,
        providerModelCode: row.modelVersionCode,
        extraIdentifier: row.modelVersionExtraIdentifier,
        runtimeOptionsJson: row.modelVersionRuntimeOptionsJson,
    });
