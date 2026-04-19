import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import { createClient } from '@libsql/client/node'
import { drizzle } from 'drizzle-orm/libsql'
import { sql } from 'drizzle-orm'

import { schema } from '../../src/database/schema.js'
import { EMPTY_MODEL_RUNTIME_OPTIONS_JSON } from '../../src/utils/json.js'
import { getModelRuntimeIdentityKeys } from '../../src/config/model-registry.js'

const repoRoot = process.cwd()
const migrationsDir = path.join(repoRoot, 'migrations')
const syncRunnerPath = path.join(repoRoot, 'tests/helpers/sync-runner.ts')
const moduleRunnerPath = path.join(repoRoot, 'tests/helpers/module-runner.ts')

export const setupRuntimeEnv = async () => {
	const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-tester-env-'))
	const testsDir = path.join(rootDir, 'tests')
	const promptsDir = path.join(rootDir, 'prompts')
	const modelsDir = path.join(rootDir, 'models')
	const providersDir = path.join(rootDir, 'providers')
	const logsDir = path.join(rootDir, 'logs')
	const configPath = path.join(rootDir, 'ai-tester.config.yaml')
	const dbPath = path.join(rootDir, 'placeholder.sqlite')

	await Promise.all([
		fs.mkdir(testsDir, { recursive: true }),
		fs.mkdir(promptsDir, { recursive: true }),
		fs.mkdir(modelsDir, { recursive: true }),
		fs.mkdir(providersDir, { recursive: true }),
		fs.mkdir(logsDir, { recursive: true }),
		fs.writeFile(
			configPath,
			[
				'candidatesTemperature: 0.3',
				'candidates: []',
				'attempts: 1',
				'requiredTags1: []',
				'requiredTags2: []',
				'prohibitedTags: []',
				'evaluatorsTemperature: 0.4',
				'evaluationsPerEvaluator: 1',
				'evaluators: []',
			].join('\n')
		),
	])

	process.env['AI_TESTER_SQLITE_DB_PATH'] = dbPath
	process.env['AI_TESTER_LOGS_DIR'] = logsDir
	process.env['AI_TESTER_TESTS_DIR'] = testsDir
	process.env['AI_TESTER_PROMPTS_DIR'] = promptsDir
	process.env['AI_TESTER_MODELS_DIR'] = modelsDir
	process.env['AI_TESTER_PROVIDERS_DIR'] = providersDir
	process.env['AI_TESTER_CONFIG_PATH'] = configPath
	process.env['MAX_WAIT_TIME'] = '1000'
	process.env['MAX_TEST_OUTPUT_TOKENS'] = '2000'
	process.env['MAX_TEST_THINKING_TOKENS'] = '1000'
	process.env['MAX_EVALUATION_OUTPUT_TOKENS'] = '1000'
	process.env['MAX_EVALUATION_THINKING_TOKENS'] = '500'

	return { rootDir, testsDir, promptsDir, modelsDir, providersDir, logsDir, configPath, dbPath }
}

const applyMigrations = async (executeMultiple: (sqlText: string) => Promise<void>) => {
	const migrationFiles = (await fs.readdir(migrationsDir))
		.filter(file => file.endsWith('.sql'))
		.sort((a, b) => a.localeCompare(b))

	for (const migrationFile of migrationFiles) {
		const migrationSql = await fs.readFile(path.join(migrationsDir, migrationFile), 'utf8')
		await executeMultiple(migrationSql.replaceAll('--> statement-breakpoint', '\n'))
	}
}

export const createTestDatabase = async () => {
	const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-tester-db-'))
	const dbPath = path.join(rootDir, 'test.sqlite')
	const client = createClient({ url: `file:${dbPath}` })
	await applyMigrations(sqlText => client.executeMultiple(sqlText))

	const db = drizzle(client, { schema, logger: false })
	await db.run(sql`PRAGMA foreign_keys = ON`)

	return {
		rootDir,
		dbPath,
		client,
		db,
		async cleanup() {
			client.close()
			await fs.rm(rootDir, { recursive: true, force: true })
		},
	}
}

export const createSyncTestEnv = async () => {
	const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-tester-sync-'))
	const dbPath = path.join(rootDir, 'sync.sqlite')
	const testsDir = path.join(rootDir, 'data/tests')
	const promptsDir = path.join(rootDir, 'data/prompts')
	const modelsDir = path.join(rootDir, 'data/models')
	const providersDir = path.join(rootDir, 'data/providers')
	const currenciesDir = path.join(rootDir, 'data/currencies')
	const structuredSchemasDir = path.join(rootDir, 'data/structured-schemas')
	const toolDefinitionsDir = path.join(rootDir, 'data/tool-definitions')
	const logsDir = path.join(rootDir, '.local/_logs')
	const configPath = path.join(rootDir, 'ai-tester.config.yaml')

	await Promise.all([
		fs.mkdir(testsDir, { recursive: true }),
		fs.mkdir(promptsDir, { recursive: true }),
		fs.mkdir(modelsDir, { recursive: true }),
		fs.mkdir(providersDir, { recursive: true }),
		fs.mkdir(currenciesDir, { recursive: true }),
		fs.mkdir(structuredSchemasDir, { recursive: true }),
		fs.mkdir(toolDefinitionsDir, { recursive: true }),
		fs.mkdir(logsDir, { recursive: true }),
		fs.writeFile(
			configPath,
			[
				'candidatesTemperature: 0.3',
				'candidates: []',
				'attempts: 1',
				'requiredTags1: []',
				'requiredTags2: []',
				'prohibitedTags: []',
				'evaluatorsTemperature: 0.4',
				'evaluationsPerEvaluator: 1',
				'evaluators: []',
			].join('\n')
		),
	])

	const client = createClient({ url: `file:${dbPath}` })
	await applyMigrations(sqlText => client.executeMultiple(sqlText))
	const db = drizzle(client, { schema, logger: false })
	await db.run(sql`PRAGMA foreign_keys = ON`)

	const env = {
		AI_TESTER_SQLITE_DB_PATH: dbPath,
		AI_TESTER_LOGS_DIR: logsDir,
		AI_TESTER_TESTS_DIR: testsDir,
		AI_TESTER_PROMPTS_DIR: promptsDir,
		AI_TESTER_MODELS_DIR: modelsDir,
		AI_TESTER_PROVIDERS_DIR: providersDir,
		AI_TESTER_CURRENCIES_DIR: currenciesDir,
		AI_TESTER_STRUCTURED_SCHEMAS_DIR: structuredSchemasDir,
		AI_TESTER_TOOL_DEFINITIONS_DIR: toolDefinitionsDir,
		AI_TESTER_CONFIG_PATH: configPath,
		MAX_WAIT_TIME: '1000',
		MAX_TEST_OUTPUT_TOKENS: '2000',
		MAX_TEST_THINKING_TOKENS: '1000',
		MAX_EVALUATION_OUTPUT_TOKENS: '1000',
		MAX_EVALUATION_THINKING_TOKENS: '500',
	}

	const write = async (relativePath: string, content: string) => {
		const absolutePath = path.join(rootDir, relativePath)
		await fs.mkdir(path.dirname(absolutePath), { recursive: true })
		await fs.writeFile(absolutePath, content)
		return absolutePath
	}

	const remove = async (relativePath: string) => {
		await fs.rm(path.join(rootDir, relativePath), { force: true, recursive: true })
	}

	const runSync = (operations: string[]) => {
		const result = spawnSync(
			process.execPath,
			['--import', 'tsx', syncRunnerPath, JSON.stringify({ env, operations })],
			{
				cwd: repoRoot,
				encoding: 'utf8',
			}
		)

		return {
			status: result.status,
			stdout: result.stdout ?? '',
			stderr: result.stderr ?? '',
		}
	}

	const runModule = (operation: string, args?: unknown) => {
		const result = spawnSync(
			process.execPath,
			['--import', 'tsx', moduleRunnerPath, JSON.stringify({ env, operation, args })],
			{
				cwd: repoRoot,
				encoding: 'utf8',
			}
		)

		return {
			status: result.status,
			stdout: result.stdout ?? '',
			stderr: result.stderr ?? '',
		}
	}

	return {
		rootDir,
		dbPath,
		db,
		client,
		env,
		testsDir,
		promptsDir,
		modelsDir,
		providersDir,
		currenciesDir,
		structuredSchemasDir,
		toolDefinitionsDir,
		configPath,
		write,
		remove,
		runSync,
		runModule,
		async cleanup() {
			client.close()
			await fs.rm(rootDir, { recursive: true, force: true })
		},
	}
}

export const createRegistry = (
	...models: Array<{ id?: string; provider: string; providerModelCode: string; [key: string]: unknown }>
) => {
	const modelsWithIds = models.map(model => ({
		...model,
		id: model.id ?? `${model.provider}/${model.providerModelCode}`,
		providerOptions: model.providerOptions ?? {},
		thinking: model.thinking,
		candidateOverrides: model.candidateOverrides,
		evaluatorOverrides: model.evaluatorOverrides,
	}))

	return {
		providers: [],
		providersByCode: new Map(),
		models: modelsWithIds as never[],
		activeModels: modelsWithIds as never[],
		modelsById: new Map(modelsWithIds.map(model => [model.id, model])),
		modelsByRuntimeIdentity: new Map(
			modelsWithIds.flatMap(model => getModelRuntimeIdentityKeys(model).map(key => [key, model] as const))
		),
	} as const
}

export const insertProviderModel = async (
	db: ReturnType<typeof drizzle>,
	{
		providerCode,
		providerName = providerCode,
		modelCode = providerCode + '-model',
		providerModelCode = modelCode,
		runtimeOptionsJson = EMPTY_MODEL_RUNTIME_OPTIONS_JSON,
	}: {
		providerCode: string
		providerName?: string
		modelCode?: string
		providerModelCode?: string
		runtimeOptionsJson?: string
	}
) => {
	const [provider] = await db
		.insert(schema.providers)
		.values({ code: providerCode, name: providerName, active: true })
		.returning()
	const [model] = await db.insert(schema.models).values({ code: modelCode, active: true }).returning()
	const [modelVersion] = await db
		.insert(schema.modelVersions)
		.values({
			modelId: model.id,
			providerId: provider.id,
			providerModelCode,
			runtimeOptionsJson,
			active: true,
		})
		.returning()

	return { provider, model, modelVersion }
}

export const insertPromptVersion = async (
	db: ReturnType<typeof drizzle>,
	{ code, content, hash = `${code}-hash` }: { code: string; content: string; hash?: string }
) => {
	const [prompt] = await db.insert(schema.prompts).values({ code }).returning()
	const [promptVersion] = await db
		.insert(schema.promptVersions)
		.values({ promptId: prompt.id, content, hash, active: true })
		.returning()
	return { prompt, promptVersion }
}

export const insertStructuredObjectVersion = async (
	db: ReturnType<typeof drizzle>,
	{ code, schemaObject }: { code: string; schemaObject: Record<string, unknown> }
) => {
	const [structuredObject] = await db.insert(schema.structuredObjects).values({ code }).returning()
	const [structuredObjectVersion] = await db
		.insert(schema.structuredObjectVersions)
		.values({
			structuredObjectId: structuredObject.id,
			hash: `${code}-hash`,
			schema: schemaObject,
			active: true,
		})
		.returning()
	return { structuredObject, structuredObjectVersion }
}

export const insertToolVersion = async (
	db: ReturnType<typeof drizzle>,
	{ code, schemaObject }: { code: string; schemaObject: Record<string, unknown> }
) => {
	const [tool] = await db.insert(schema.tools).values({ code }).returning()
	const [toolVersion] = await db
		.insert(schema.toolVersions)
		.values({
			toolId: tool.id,
			hash: `${code}-hash`,
			schema: JSON.stringify(schemaObject),
			active: true,
		})
		.returning()
	return { tool, toolVersion }
}

export const insertTestVersion = async (
	db: ReturnType<typeof drizzle>,
	{
		content,
		tagNames,
		systemPromptVersionId,
		structuredObjectVersionId,
		toolVersionIds = [],
		evaluationInstructions,
		hash = 'test-hash',
	}: {
		content: string
		tagNames: string[]
		systemPromptVersionId: number
		structuredObjectVersionId?: number
		toolVersionIds?: number[]
		evaluationInstructions?: string
		hash?: string
	}
) => {
	const [testVersion] = await db
		.insert(schema.testVersions)
		.values({ content, hash, active: true, structuredObjectVersionId })
		.returning()

	for (const tagName of tagNames) {
		const [tag] = await db.insert(schema.tags).values({ name: tagName }).onConflictDoNothing().returning()
		const resolvedTag =
			tag ??
			(await db.query.tags.findFirst({
				where: (tags, { eq }) => eq(tags.name, tagName),
			}))
		if (!resolvedTag) throw new Error(`Tag ${tagName} was not created`)
		await db.insert(schema.testToTagRels).values({ tagId: resolvedTag.id, testVersionId: testVersion.id })
	}

	await db.insert(schema.testToSystemPromptVersionRels).values({
		testVersionId: testVersion.id,
		systemPromptVersionId,
	})

	for (const toolVersionId of toolVersionIds) {
		await db.insert(schema.testToToolVersionRels).values({ testVersionId: testVersion.id, toolVersionId })
	}

	let evaluationInstructionsVersion:
		| typeof schema.testEvaluationInstructionsVersions.$inferSelect
		| undefined
	if (evaluationInstructions) {
		;[evaluationInstructionsVersion] = await db
			.insert(schema.testEvaluationInstructionsVersions)
			.values({
				hash: `${hash}-eval`,
				content: evaluationInstructions,
				active: true,
			})
			.returning()
		await db.insert(schema.testToEvaluationInstructionsRels).values({
			testVersionId: testVersion.id,
			evaluationInstructionsVersionId: evaluationInstructionsVersion.id,
		})
	}

	return { testVersion, evaluationInstructionsVersion }
}

export const insertSession = async (
	db: ReturnType<typeof drizzle>,
	{
		testVersionId,
		candidateSysPromptVersionId,
		modelVersionId,
		answer,
		reasoning = null,
		temperature = 0.3,
		completionTokens = 4,
		promptTokens = 3,
	}: {
		testVersionId: number
		candidateSysPromptVersionId: number
		modelVersionId: number
		answer: string
		reasoning?: string | null
		temperature?: number
		completionTokens?: number
		promptTokens?: number
	}
) => {
	const [session] = await db
		.insert(schema.sessions)
		.values({
			testVersionId,
			candidateSysPromptVersionId,
			modelVersionId,
			temperature,
			answer,
			reasoning,
			completionTokens,
			promptTokens,
			timeTaken: 12,
		})
		.returning()
	return session
}
