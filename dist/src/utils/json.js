export const EMPTY_MODEL_RUNTIME_OPTIONS_JSON = '{"providerOptions":{},"thinking":null}';
const sortJsonValue = (value) => {
    if (Array.isArray(value))
        return value.map(sortJsonValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)]));
    }
    return value;
};
export const stableJsonStringify = (value) => JSON.stringify(sortJsonValue(value));
