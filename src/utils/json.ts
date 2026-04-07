export const EMPTY_MODEL_RUNTIME_OPTIONS_JSON = '{"providerOptions":{},"thinking":null}'

const sortJsonValue = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(sortJsonValue)
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)])
		)
	}
	return value
}

export const stableJsonStringify = (value: unknown) => JSON.stringify(sortJsonValue(value))
