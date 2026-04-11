import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

import { CliUsageError } from './errors.js'
import { stableJsonStringify } from '../utils/json.js'

const RUN_WITH_SYNC_CONFIRMATION_MESSAGE =
	'This will first update the file-backed registry and sync the DB. Do you want to continue?'

const DRY_RUN_SYNC_ACTION = 'sync currencies, providers, structured objects, tools, prompts, and tests'

type ConfirmFn = (message: string) => Promise<boolean>

type RunWithSyncOptions = {
	dryRun?: boolean
	includeCounts?: boolean
	configOverridesJson?: string
	configOverridesFile?: string
	confirmSync?: ConfirmFn
	confirmRun?: ConfirmFn
}

const alwaysYes: ConfirmFn = async () => true

const getAbsoluteDbPath = () => {
	dotenv.config({ path: '.env.local' })
	dotenv.config()

	const dbPath = process.env['AI_TESTER_SQLITE_DB_PATH']
	if (!dbPath) {
		throw new Error('AI_TESTER_SQLITE_DB_PATH is not set')
	}
	return path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath)
}

const readJsonPayload = (label: string, json: string) => {
	try {
		return JSON.parse(json) as unknown
	} catch (error) {
		throw new CliUsageError(
			`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`
		)
	}
}

const readJsonFilePayload = (label: string, filePath: string) => {
	const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
	let content: string
	try {
		content = fs.readFileSync(absolutePath, 'utf-8')
	} catch (error) {
		throw new CliUsageError(
			`Unable to read ${label} file at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`
		)
	}
	return readJsonPayload(label, content)
}

const readOptionalJsonPayload = ({
	label,
	json,
	filePath,
}: {
	label: string
	json?: string
	filePath?: string
}) => {
	if (json !== undefined && filePath !== undefined) {
		throw new CliUsageError(`${label} accepts only one JSON source.`)
	}
	if (json !== undefined) return readJsonPayload(label, json)
	if (filePath !== undefined) return readJsonFilePayload(label, filePath)
	return {}
}

const formatDryRunConfig = (value: unknown) => JSON.stringify(JSON.parse(stableJsonStringify(value)), null, 2)

const withTemporaryDatabaseCopy = async <T>(action: () => Promise<T>) => {
	const originalDbPath = getAbsoluteDbPath()
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tester-dry-run-'))
	const tmpDbPath = path.join(tmpDir, 'dry-run.sqlite')
	for (const suffix of ['', '-wal', '-shm']) {
		const sourcePath = `${originalDbPath}${suffix}`
		if (fs.existsSync(sourcePath)) {
			fs.copyFileSync(sourcePath, `${tmpDbPath}${suffix}`)
		}
	}

	const previousDbPath = process.env['AI_TESTER_SQLITE_DB_PATH']
	process.env['AI_TESTER_SQLITE_DB_PATH'] = tmpDbPath

	try {
		return await action()
	} finally {
		if (previousDbPath === undefined) {
			delete process.env['AI_TESTER_SQLITE_DB_PATH']
		} else {
			process.env['AI_TESTER_SQLITE_DB_PATH'] = previousDbPath
		}
		fs.rmSync(tmpDir, { recursive: true, force: true })
	}
}

const resolveTestRunConfig = async ({
	configOverridesJson,
	configOverridesFile,
}: Pick<RunWithSyncOptions, 'configOverridesJson' | 'configOverridesFile'>) => {
	const { TestRunConfigOverridesSchema, mergeTestsConfigOverrides, resolveTestsConfig, getFileBackedModelRegistry } =
		await import('../config/index.js')
	const registry = getFileBackedModelRegistry()
	const overrides = TestRunConfigOverridesSchema.parse(
		readOptionalJsonPayload({
			label: 'run-tests --config-overrides',
			json: configOverridesJson,
			filePath: configOverridesFile,
		})
	)
	const testsConfig = resolveTestsConfig(mergeTestsConfigOverrides(overrides), registry)
	return { testsConfig, registry }
}

const resolveEvaluationRunConfig = async ({
	configOverridesJson,
	configOverridesFile,
}: Pick<RunWithSyncOptions, 'configOverridesJson' | 'configOverridesFile'>) => {
	const { EvaluationRunConfigOverridesSchema, mergeTestsConfigOverrides, resolveTestsConfig, getFileBackedModelRegistry } =
		await import('../config/index.js')
	const registry = getFileBackedModelRegistry()
	const overrides = EvaluationRunConfigOverridesSchema.parse(
		readOptionalJsonPayload({
			label: 'run-evals --config-overrides',
			json: configOverridesJson,
			filePath: configOverridesFile,
		})
	)
	const testsConfig = resolveTestsConfig(mergeTestsConfigOverrides(overrides), registry)
	return { testsConfig, registry }
}

const validateRunConfig = async () => {
	const { resolveTestsConfig } = await import('../config/index.js')
	const { getFileBackedCurrencyRegistry, validateCurrencyRegistryReferences } = await import(
		'../config/currency-registry.js'
	)
	resolveTestsConfig()
	validateCurrencyRegistryReferences(getFileBackedCurrencyRegistry())
	await import('../database/db.js')
}

const runQuietly = async <T>(action: () => Promise<T>) => {
	const originalLog = console.log
	const originalWarn = console.warn
	console.log = () => {}
	console.warn = () => {}
	try {
		return await action()
	} finally {
		console.log = originalLog
		console.warn = originalWarn
	}
}

export const syncAll = async () => {
	const [
		{ updateCurrenciesInDb },
		{ updateProvidersInDb },
		{ updateStructuredObjectsInDb },
		{ updateToolsInDb },
		{ updatePromptsInDb },
		{ updateTestsInDb },
	] = await Promise.all([
		import('../main/currencies.js'),
		import('../main/providers.js'),
		import('../main/structured-objects.js'),
		import('../main/tools.js'),
		import('../main/prompts.js'),
		import('../main/tests.js'),
	])

	await updateCurrenciesInDb()
	await updateProvidersInDb()
	await updateStructuredObjectsInDb()
	await updateToolsInDb()
	await updatePromptsInDb()
	await updateTestsInDb()
}

const logDryRun = (noun: 'tests' | 'evaluations') => {
	console.log(`Dry run: would ${DRY_RUN_SYNC_ACTION}.`)
	console.log(`Dry run: would then run missing ${noun}.`)
}

export const runTestsWithSync = async ({
	dryRun = false,
	includeCounts = false,
	configOverridesJson,
	configOverridesFile,
	confirmSync,
	confirmRun = alwaysYes,
}: RunWithSyncOptions = {}) => {
	if (dryRun) {
		const { testsConfig, missingCount } = includeCounts
			? await withTemporaryDatabaseCopy(async () => {
					const { testsConfig } = await runQuietly(() =>
						resolveTestRunConfig({ configOverridesJson, configOverridesFile })
					)
					await runQuietly(validateRunConfig)
					await runQuietly(syncAll)
					const missingCount = await runQuietly(async () =>
						(await import('../main/sessions.js')).countMissingTests({ testsConfig })
					)
					return { testsConfig, missingCount }
			  })
			: await runQuietly(async () => {
					const { testsConfig } = await resolveTestRunConfig({ configOverridesJson, configOverridesFile })
					await validateRunConfig()
					return { testsConfig, missingCount: undefined }
			  })
		logDryRun('tests')
		if (missingCount !== undefined) {
			console.log(`Dry run: ${missingCount} missing test run(s) after syncing a temporary database copy.`)
		}
		console.log(`Dry run: resolved test run configuration:\n${formatDryRunConfig(testsConfig)}`)
		return
	}

	if (confirmSync && !(await confirmSync(RUN_WITH_SYNC_CONFIRMATION_MESSAGE))) return

	const { testsConfig, registry } = await resolveTestRunConfig({ configOverridesJson, configOverridesFile })

	console.log()
	await syncAll()
	await (await import('../main/sessions.js')).runAllTests({ confirmRun, testsConfig, registry })
	console.log()
}

export const runEvalsWithSync = async ({
	dryRun = false,
	includeCounts = false,
	configOverridesJson,
	configOverridesFile,
	confirmSync,
	confirmRun = alwaysYes,
}: RunWithSyncOptions = {}) => {
	if (dryRun) {
		const { testsConfig, missingCount } = includeCounts
			? await withTemporaryDatabaseCopy(async () => {
					const { testsConfig } = await runQuietly(() =>
						resolveEvaluationRunConfig({ configOverridesJson, configOverridesFile })
					)
					await runQuietly(validateRunConfig)
					await runQuietly(syncAll)
					const missingCount = await runQuietly(async () =>
						(await import('../main/evaluations.js')).countMissingEvaluations({ testsConfig })
					)
					return { testsConfig, missingCount }
			  })
			: await runQuietly(async () => {
					const { testsConfig } = await resolveEvaluationRunConfig({ configOverridesJson, configOverridesFile })
					await validateRunConfig()
					return { testsConfig, missingCount: undefined }
			  })
		logDryRun('evaluations')
		if (missingCount !== undefined) {
			console.log(`Dry run: ${missingCount} missing evaluation run(s) after syncing a temporary database copy.`)
		}
		console.log(`Dry run: resolved evaluation run configuration:\n${formatDryRunConfig(testsConfig)}`)
		return
	}

	if (confirmSync && !(await confirmSync(RUN_WITH_SYNC_CONFIRMATION_MESSAGE))) return

	const { testsConfig, registry } = await resolveEvaluationRunConfig({ configOverridesJson, configOverridesFile })

	console.log()
	await syncAll()
	await (await import('../main/evaluations.js')).runAllEvaluations({ confirmRun, testsConfig, registry })
	console.log()
}

const getConfigResolvedAnalysisQueries = async () =>
	runQuietly(async () => (await import('../config/index.js')).resolveTestsConfig().analysisQueries ?? [])

const getValidatedResolvedAnalysisQueries = async () =>
	runQuietly(async () => {
		const { getFileBackedCurrencyRegistry, validateCurrencyRegistryReferences } = await import(
			'../config/currency-registry.js'
		)
		validateCurrencyRegistryReferences(getFileBackedCurrencyRegistry())
		return (await import('../config/index.js')).resolveTestsConfig().analysisQueries ?? []
	})

const getSyncedResolvedAnalysisQueries = async () =>
	runQuietly(async () => {
		await (await import('../main/providers.js')).updateProvidersInDb()
		return (await import('../config/index.js')).resolveTestsConfig().analysisQueries ?? []
	})

const parseAdHocAnalysisQuery = async (payload: unknown) =>
	(await import('../config/index.js')).AdHocAnalysisQuerySchema.parse(payload)

const validateAnalysisQueryCurrencies = async (analysisQueries: Array<{ description?: string; currency: string }>) => {
	const { getFileBackedCurrencyRegistry, validateCurrencyRegistryReferences } = await import(
		'../config/currency-registry.js'
	)
	validateCurrencyRegistryReferences(getFileBackedCurrencyRegistry(), {
		analysisQueries,
		includeConfiguredAnalysisQueries: false,
	})
}

const resolveAdHocAnalysisQuery = async (query: Awaited<ReturnType<typeof parseAdHocAnalysisQuery>>) => {
	const { getFileBackedModelRegistry, resolveAnalysisQuery } = await import('../config/index.js')
	return resolveAnalysisQuery(query, getFileBackedModelRegistry())
}

const getSyncedResolvedAdHocAnalysisQuery = async (query: Awaited<ReturnType<typeof parseAdHocAnalysisQuery>>) =>
	runQuietly(async () => {
		await (await import('../main/providers.js')).updateProvidersInDb({
			validateConfiguredAnalysisQueryCurrencies: false,
		})
		return resolveAdHocAnalysisQuery(query)
	})

const isRunnableQuery = (query: Awaited<ReturnType<typeof getValidatedResolvedAnalysisQueries>>[number]) =>
	(query.candidates === undefined || query.candidates.length > 0) &&
	(query.evaluators === undefined || query.evaluators.length > 0)

export const listStatsQueries = async () => {
	for (const query of (await getValidatedResolvedAnalysisQueries()).filter(isRunnableQuery)) {
		console.log(query.description)
	}
}

const logStatsDryRun = (query: Awaited<ReturnType<typeof parseAdHocAnalysisQuery>>) => {
	console.log('Dry run: would run stats query.')
	console.log(`Dry run: resolved stats query:\n${formatDryRunConfig(query)}`)
}

export const runStatsQueryByDescription = async (
	description: string,
	{ dryRun = false }: { dryRun?: boolean } = {}
) => {
	const configuredQuery = (await getConfigResolvedAnalysisQueries()).find(candidate => candidate.description === description)
	if (!configuredQuery) {
		throw new CliUsageError(`Analysis query not found: ${description}`)
	}

	if (dryRun) {
		await validateAnalysisQueryCurrencies([configuredQuery])
		const query =
			(await getValidatedResolvedAnalysisQueries()).find(candidate => candidate.description === description) ??
			configuredQuery
		logStatsDryRun(query)
		return
	}

	const queries = await getSyncedResolvedAnalysisQueries()
	const query = queries.find(candidate => candidate.description === description) ?? configuredQuery

	await (await import('../main/stats.js')).showStats(query)
}

export const runStatsQueryJson = async (json: string, { dryRun = false }: { dryRun?: boolean } = {}) => {
	const query = await parseAdHocAnalysisQuery(readJsonPayload('stats --query-json', json))
	await validateAnalysisQueryCurrencies([query])

	if (dryRun) {
		const resolvedQuery = await runQuietly(() => resolveAdHocAnalysisQuery(query))
		logStatsDryRun(resolvedQuery)
		return
	}

	await (await import('../main/stats.js')).showStats(await getSyncedResolvedAdHocAnalysisQuery(query))
}

export const runStatsQueryFile = async (filePath: string, { dryRun = false }: { dryRun?: boolean } = {}) =>
	runStatsQueryJson(stableJsonStringify(readJsonFilePayload('stats --query-file', filePath)), { dryRun })

export const runMigrations = async () => {
	dotenv.config({ path: '.env.local' })
	dotenv.config()

	const dbPath = process.env['AI_TESTER_SQLITE_DB_PATH']
	if (!dbPath) {
		throw new Error('AI_TESTER_SQLITE_DB_PATH is not set')
	}

	process.env['AI_TESTER_SQLITE_DB_PATH'] = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath)

	const drizzleConfigPath = fileURLToPath(new URL('../database/drizzle.config.js', import.meta.url))
	const distRoot = fileURLToPath(new URL('../../', import.meta.url))
	execSync(`npx drizzle-kit migrate --config "${drizzleConfigPath}"`, {
		cwd: distRoot,
		stdio: 'inherit',
	})
}
