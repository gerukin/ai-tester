const payload = JSON.parse(process.argv[2] ?? '{}') as {
	env?: Record<string, string>
	operations?: string[]
}

for (const [key, value] of Object.entries(payload.env ?? {})) {
	process.env[key] = value
}

const operationMap = {
	currencies: async () => (await import('../../src/main/currencies.js')).updateCurrenciesInDb(),
	providers: async () => (await import('../../src/main/providers.js')).updateProvidersInDb(),
	prompts: async () => (await import('../../src/main/prompts.js')).updatePromptsInDb(),
	tools: async () => (await import('../../src/main/tools.js')).updateToolsInDb(),
	structuredObjects: async () => (await import('../../src/main/structured-objects.js')).updateStructuredObjectsInDb(),
	tests: async () => (await import('../../src/main/tests.js')).updateTestsInDb(),
} as const

for (const operation of payload.operations ?? []) {
	const runner = operationMap[operation as keyof typeof operationMap]
	if (!runner) {
		throw new Error(`Unknown sync operation: ${operation}`)
	}
	await runner()
}
