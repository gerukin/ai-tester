const payload = JSON.parse(process.argv[2] ?? '{}') as {
	env?: Record<string, string>
	operation?: string
	args?: unknown
}

for (const [key, value] of Object.entries(payload.env ?? {})) {
	process.env[key] = value
}

const captureConsole = async (fn: () => Promise<unknown>) => {
	const logs: unknown[][] = []
	const tables: unknown[][] = []
	const originalLog = console.log
	const originalWarn = console.warn
	const originalError = console.error
	const originalTable = console.table

	console.log = (...args) => {
		logs.push(args)
	}
	console.warn = (...args) => {
		logs.push(args)
	}
	console.error = (...args) => {
		logs.push(args)
	}
	console.table = (...args) => {
		tables.push(args)
	}

	try {
		const result = await fn()
		return { result, logs, tables }
	} finally {
		console.log = originalLog
		console.warn = originalWarn
		console.error = originalError
		console.table = originalTable
	}
}

const operationMap = {
	'config:getResolvedTestsConfig': async () => {
		const config = await import('../../src/config/config-file.js')
		return {
			testsConfig: config.testsConfig,
			resolvedTestsConfig: config.resolveTestsConfig(),
		}
	},
	'modelRegistry:loadProviders': async () => (await import('../../src/config/model-registry.js')).loadProviderDefinitions(),
	'modelRegistry:loadModels': async () => (await import('../../src/config/model-registry.js')).loadModelDefinitions(),
	'modelRegistry:loadRegistry': async () => {
		const registry = (await import('../../src/config/model-registry.js')).loadFileBackedModelRegistry()
		return {
			providers: registry.providers,
			models: registry.models,
			activeModels: registry.activeModels,
			modelReferences: Array.from(registry.modelsByReference.keys()),
		}
	},
	'currencyRegistry:loadDefinitions': async () => (await import('../../src/config/currency-registry.js')).loadCurrencyDefinitions(),
	'currencyRegistry:validateReferences': async () => {
		;(await import('../../src/config/currency-registry.js')).validateCurrencyRegistryReferences()
		return { ok: true }
	},
	'stats:show': async () => {
		const { showStats } = await import('../../src/main/stats.js')
		return captureConsole(async () => {
			await showStats(payload.args as never)
			return { ok: true }
		})
	},
	'bootstrap:index': async () => {
		let menuCalls = 0
		globalThis.__AI_TESTER_TEST_MENU_LOADER__ = async () => async () => {
			menuCalls += 1
			return 'index-result'
		}
		const originalArgv = process.argv

		try {
			process.argv = [process.execPath, 'ai-tester']
			await import('../../src/index.js')
			return { menuCalls }
		} finally {
			process.argv = originalArgv
			delete globalThis.__AI_TESTER_TEST_MENU_LOADER__
		}
	},
	'cli:run': async () => {
		const args = (payload.args ?? {}) as { argv?: string[] }
		const { runCli } = await import('../../src/cli/index.js')
		return captureConsole(async () => ({ exitCode: await runCli(args.argv ?? []) }))
	},
	'cli:dispatch': async () => {
		const args = (payload.args ?? {}) as { argv?: string[] }
		const calls: Array<{
			name: string
			dryRun?: boolean
			includeCounts?: boolean
			description?: string
			json?: string
			filePath?: string
			configOverridesJson?: string
			configOverridesFile?: string
		}> = []
		const { runCli } = await import('../../src/cli/index.js')
		return captureConsole(async () => ({
			exitCode: await runCli(args.argv ?? [], {
				runInteractive: async () => {
					calls.push({ name: 'interactive' })
				},
				syncAll: async () => {
					calls.push({ name: 'sync' })
				},
				runTestsWithSync: async options => {
					calls.push({
						name: 'run-tests',
						dryRun: options?.dryRun,
						...(options?.includeCounts ? { includeCounts: true } : {}),
						...(options?.configOverridesJson !== undefined
							? { configOverridesJson: options.configOverridesJson }
							: {}),
						...(options?.configOverridesFile !== undefined
							? { configOverridesFile: options.configOverridesFile }
							: {}),
					})
				},
				runEvalsWithSync: async options => {
					calls.push({
						name: 'run-evals',
						dryRun: options?.dryRun,
						...(options?.includeCounts ? { includeCounts: true } : {}),
						...(options?.configOverridesJson !== undefined
							? { configOverridesJson: options.configOverridesJson }
							: {}),
						...(options?.configOverridesFile !== undefined
							? { configOverridesFile: options.configOverridesFile }
							: {}),
					})
				},
				listStatsQueries: async () => {
					calls.push({ name: 'stats:list' })
				},
				runStatsQueryByDescription: async (description, options) => {
					calls.push({ name: 'stats:query', description, ...(options?.dryRun ? { dryRun: true } : {}) })
				},
				runStatsQueryJson: async (json, options) => {
					calls.push({ name: 'stats:query-json', json, ...(options?.dryRun ? { dryRun: true } : {}) })
				},
				runStatsQueryFile: async (filePath, options) => {
					calls.push({ name: 'stats:query-file', filePath, ...(options?.dryRun ? { dryRun: true } : {}) })
				},
				runMigrations: async () => {
					calls.push({ name: 'migrate' })
				},
			}),
			calls,
		}))
	},
	'actions:runTestsWithSyncCancelled': async () => {
		const { runTestsWithSync } = await import('../../src/cli/actions.js')
		return captureConsole(async () => {
			let confirmCalls = 0
			await runTestsWithSync({
				configOverridesJson: '{',
				confirmSync: async () => {
					confirmCalls += 1
					return false
				},
			})
			return { confirmCalls }
		})
	},
	'openRouter:getModels': async () => {
		const args = (payload.args ?? {}) as {
			fetchResponse?: unknown
			fetchStatus?: number
			fetchError?: string
		}
		globalThis.fetch = async () => {
			if (args.fetchError) throw new Error(args.fetchError)
			return {
				ok: (args.fetchStatus ?? 200) >= 200 && (args.fetchStatus ?? 200) < 300,
				status: args.fetchStatus ?? 200,
				json: async () => args.fetchResponse,
			} as Response
		}
		return (await import('../../src/apis/open-router.js')).getOpenRouterModels()
	},
	'openRouter:format': async () =>
		(await import('../../src/apis/open-router.js')).formatOpenRouterModelsForDisplay(payload.args as never),
} as const

const runner = payload.operation ? operationMap[payload.operation as keyof typeof operationMap] : undefined

if (!runner) {
	throw new Error(`Unknown module operation: ${payload.operation ?? 'undefined'}`)
}

const result = await runner()
if (result !== undefined) {
	console.log(JSON.stringify(result))
}
