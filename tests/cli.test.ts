import assert from 'node:assert/strict'
import test from 'node:test'

import { schema } from '../src/database/schema.js'
import { createSyncTestEnv } from './helpers/test-harness.js'

const expectModuleSuccess = (result: { status: number | null; stdout: string; stderr: string }) => {
	assert.strictEqual(
		result.status,
		0,
		`Expected module success.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
	)
	return JSON.parse(result.stdout) as {
		result: unknown
		logs: unknown[][]
		tables: unknown[][]
	}
}

test('cli dispatch enters interactive mode when no arguments are provided', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const output = expectModuleSuccess(env.runModule('cli:dispatch', { argv: [] })) as {
		result: { exitCode: number; calls: Array<{ name: string }> }
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.deepStrictEqual(output.result.calls, [{ name: 'interactive' }])
})

test('cli dispatch routes commands and forwards dry-run and query arguments', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const runTests = expectModuleSuccess(env.runModule('cli:dispatch', { argv: ['run-tests', '--dry-run'] })) as {
		result: { exitCode: number; calls: Array<{ name: string; dryRun?: boolean }> }
	}
	assert.strictEqual(runTests.result.exitCode, 0)
	assert.deepStrictEqual(runTests.result.calls, [{ name: 'run-tests', dryRun: true }])

	const runEvals = expectModuleSuccess(env.runModule('cli:dispatch', { argv: ['run-evals'] })) as {
		result: { exitCode: number; calls: Array<{ name: string; dryRun?: boolean }> }
	}
	assert.strictEqual(runEvals.result.exitCode, 0)
	assert.deepStrictEqual(runEvals.result.calls, [{ name: 'run-evals', dryRun: false }])

	const sync = expectModuleSuccess(env.runModule('cli:dispatch', { argv: ['sync'] })) as {
		result: { exitCode: number; calls: Array<{ name: string }> }
	}
	assert.strictEqual(sync.result.exitCode, 0)
	assert.deepStrictEqual(sync.result.calls, [{ name: 'sync' }])

	const migrate = expectModuleSuccess(env.runModule('cli:dispatch', { argv: ['migrate'] })) as {
		result: { exitCode: number; calls: Array<{ name: string }> }
	}
	assert.strictEqual(migrate.result.exitCode, 0)
	assert.deepStrictEqual(migrate.result.calls, [{ name: 'migrate' }])

	const statsQuery = expectModuleSuccess(
		env.runModule('cli:dispatch', { argv: ['stats', '--query', 'Named query'] })
	) as {
		result: { exitCode: number; calls: Array<{ name: string; description?: string }> }
	}
	assert.strictEqual(statsQuery.result.exitCode, 0)
	assert.deepStrictEqual(statsQuery.result.calls, [{ name: 'stats:query', description: 'Named query' }])
})

test('cli help works at the root and subcommand level', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const rootHelp = expectModuleSuccess(env.runModule('cli:run', { argv: ['--help'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(rootHelp.result.exitCode, 0)
	assert.match(String(rootHelp.logs[0]?.[0]), /Usage: ai-tester \[command\] \[options\]/)

	const statsHelp = expectModuleSuccess(env.runModule('cli:run', { argv: ['stats', '-h'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(statsHelp.result.exitCode, 0)
	assert.match(String(statsHelp.logs[0]?.[0]), /ai-tester stats --list/)

	const statsHelpAfterList = expectModuleSuccess(env.runModule('cli:run', { argv: ['stats', '--list', '--help'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(statsHelpAfterList.result.exitCode, 0)
	assert.match(String(statsHelpAfterList.logs[0]?.[0]), /ai-tester stats --query <name>/)

	const statsHelpAfterQuery = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['stats', '--query', 'anything', '--help'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(statsHelpAfterQuery.result.exitCode, 0)
	assert.match(String(statsHelpAfterQuery.logs[0]?.[0]), /ai-tester stats --query <name>/)
})

test('cli returns usage errors for invalid commands and invalid stats options', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'ai-tester.config.yaml',
		[
			'candidates: []',
			'candidatesTemperature: 0.3',
			'attempts: 1',
			'requiredTags1: []',
			'requiredTags2: []',
			'prohibitedTags: []',
			'evaluators: []',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
			'analysisQueries:',
			'  - description: Existing query',
			'    currency: USD',
			'    candidates: []',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	const unknownCommand = expectModuleSuccess(env.runModule('cli:run', { argv: ['unknown'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(unknownCommand.result.exitCode, 2)
	assert.match(String(unknownCommand.logs[0]?.[0]), /Unknown command: unknown/)

	const missingStatsMode = expectModuleSuccess(env.runModule('cli:run', { argv: ['stats'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(missingStatsMode.result.exitCode, 2)
	assert.match(String(missingStatsMode.logs[0]?.[0]), /stats requires exactly one of --list or --query/)

	const conflictingStatsMode = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['stats', '--list', '--query', 'Named query'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(conflictingStatsMode.result.exitCode, 2)
	assert.match(String(conflictingStatsMode.logs[0]?.[0]), /stats requires exactly one of --list or --query/)

	const unknownStatsQuery = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['stats', '--query', 'Missing query'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(unknownStatsQuery.result.exitCode, 2)
	assert.match(String(unknownStatsQuery.logs[0]?.[0]), /Analysis query not found: Missing query/)

	env.env.AI_TESTER_SQLITE_DB_PATH = `${env.rootDir}/missing.sqlite`

	const unknownStatsQueryWithoutDb = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['stats', '--query', 'Missing query'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(unknownStatsQueryWithoutDb.result.exitCode, 2)
	assert.match(String(unknownStatsQueryWithoutDb.logs[0]?.[0]), /Analysis query not found: Missing query/)

	env.env.AI_TESTER_SQLITE_DB_PATH = env.dbPath

	await env.write(
		'ai-tester.config.yaml',
		[
			'candidates: []',
			'candidatesTemperature: 0.3',
			'attempts: 1',
			'requiredTags1: []',
			'requiredTags2: []',
			'prohibitedTags: []',
			'evaluators: []',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
			'analysisQueries:',
			'  - description: Existing query',
			'    currency: EUR',
		].join('\n')
	)

	const repeatedStatsQuery = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['stats', '--query', 'First', '--query', 'Second'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(repeatedStatsQuery.result.exitCode, 2)
	assert.match(String(repeatedStatsQuery.logs[0]?.[0]), /stats requires exactly one of --list or --query/)

	const unknownStatsQueryWithBrokenCurrency = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['stats', '--query', 'Missing query'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(unknownStatsQueryWithBrokenCurrency.result.exitCode, 2)
	assert.match(String(unknownStatsQueryWithBrokenCurrency.logs[0]?.[0]), /Analysis query not found: Missing query/)
})

test('cli stats --list prints configured analysis query descriptions in order', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'ai-tester.config.yaml',
		[
			'candidates: []',
			'candidatesTemperature: 0.3',
			'attempts: 1',
			'requiredTags1: []',
			'requiredTags2: []',
			'prohibitedTags: []',
			'evaluators: []',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
			'analysisQueries:',
			'  - description: First query',
			'    currency: USD',
			'  - description: Hidden query',
			'    currency: USD',
			'    candidates:',
			'      - provider: missing',
			'        model: missing',
			'  - description: Second query',
			'    currency: USD',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	const output = expectModuleSuccess(env.runModule('cli:run', { argv: ['stats', '--list'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.deepStrictEqual(
		output.logs.map(entry => entry[0]),
		['First query', 'Second query']
	)
})

test('cli stats --list does not require an existing database', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	env.env.AI_TESTER_SQLITE_DB_PATH = `${env.rootDir}/missing.sqlite`

	await env.write(
		'ai-tester.config.yaml',
		[
			'candidates: []',
			'candidatesTemperature: 0.3',
			'attempts: 1',
			'requiredTags1: []',
			'requiredTags2: []',
			'prohibitedTags: []',
			'evaluators: []',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
			'analysisQueries:',
			'  - description: Query without DB',
			'    currency: USD',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	const output = expectModuleSuccess(env.runModule('cli:run', { argv: ['stats', '--list'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.deepStrictEqual(output.logs.map(entry => entry[0]), ['Query without DB'])
})

test('cli stats --list fails when the currency registry is invalid for configured queries', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'ai-tester.config.yaml',
		[
			'candidates: []',
			'candidatesTemperature: 0.3',
			'attempts: 1',
			'requiredTags1: []',
			'requiredTags2: []',
			'prohibitedTags: []',
			'evaluators: []',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
			'analysisQueries:',
			'  - description: Missing currency query',
			'    currency: EUR',
		].join('\n')
	)

	const output = expectModuleSuccess(env.runModule('cli:run', { argv: ['stats', '--list'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 1)
	assert.match(String(output.logs[0]?.[0]), /Currency registry is missing YAML files for referenced currencies/)
})

test('cli stats --query runs the selected analysis query by description', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'ai-tester.config.yaml',
		[
			'candidates: []',
			'candidatesTemperature: 0.3',
			'attempts: 1',
			'requiredTags1: []',
			'requiredTags2: []',
			'prohibitedTags: []',
			'evaluators: []',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
			'analysisQueries:',
			'  - description: ""',
			'    currency: USD',
			'  - description: -hidden query',
			'    currency: USD',
			'  - description: Empty query',
			'    currency: USD',
			'    candidates: []',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	const output = expectModuleSuccess(env.runModule('cli:run', { argv: ['stats', '--query', 'Empty query'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.deepStrictEqual(output.logs, [
		['Checking for stats...'],
		['⚠️ Query "Empty query" has no active candidate models.'],
	])

	const hyphenated = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['stats', '--query', '-hidden query'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(hyphenated.result.exitCode, 0)
	assert.deepStrictEqual(hyphenated.logs, [['Checking for stats...']])

	const emptyDescription = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['stats', '--query', ''] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(emptyDescription.result.exitCode, 0)
	assert.deepStrictEqual(emptyDescription.logs, [['Checking for stats...']])
})

test('cli run-tests --dry-run validates and does not mutate the database', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const before = await env.db.select().from(schema.providers)
	assert.deepStrictEqual(before, [])

	const output = expectModuleSuccess(env.runModule('cli:run', { argv: ['run-tests', '--dry-run'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.deepStrictEqual(output.logs, [
		['Dry run: would sync currencies, providers, structured objects, tools, prompts, and tests.'],
		['Dry run: would then run missing tests.'],
	])

	const after = await env.db.select().from(schema.providers)
	assert.deepStrictEqual(after, [])
})

test('cli run-tests --dry-run still fails when config validation fails', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.remove('ai-tester.config.yaml')

	const output = expectModuleSuccess(env.runModule('cli:run', { argv: ['run-tests', '--dry-run'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 1)
	assert.match(String(output.logs[0]?.[0]), /Config file not found/)
})

test('cli run-tests --dry-run fails when runtime prerequisites are broken', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	env.env.AI_TESTER_SQLITE_DB_PATH = `${env.rootDir}/missing.sqlite`
	await env.write(
		'ai-tester.config.yaml',
		[
			'candidates: []',
			'candidatesTemperature: 0.3',
			'attempts: 1',
			'requiredTags1: []',
			'requiredTags2: []',
			'prohibitedTags: []',
			'evaluators: []',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
			'analysisQueries:',
			'  - description: Missing currency query',
			'    currency: EUR',
		].join('\n')
	)

	const output = expectModuleSuccess(env.runModule('cli:run', { argv: ['run-tests', '--dry-run'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 1)
	assert.match(
		String(output.logs[0]?.[0]),
		/Currency registry is missing YAML files for referenced currencies|The DB at .* does not exist/
	)
})

test('cli run-evals --dry-run validates and does not mutate the database', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const output = expectModuleSuccess(env.runModule('cli:run', { argv: ['run-evals', '--dry-run'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.deepStrictEqual(output.logs, [
		['Dry run: would sync currencies, providers, structured objects, tools, prompts, and tests.'],
		['Dry run: would then run missing evaluations.'],
	])
})

test('cli run-evals --dry-run still fails when config validation fails', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.remove('ai-tester.config.yaml')

	const output = expectModuleSuccess(env.runModule('cli:run', { argv: ['run-evals', '--dry-run'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 1)
	assert.match(String(output.logs[0]?.[0]), /Config file not found/)
})

test('cli run-evals --dry-run fails when runtime prerequisites are broken', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	env.env.AI_TESTER_SQLITE_DB_PATH = `${env.rootDir}/missing.sqlite`
	await env.write(
		'ai-tester.config.yaml',
		[
			'candidates: []',
			'candidatesTemperature: 0.3',
			'attempts: 1',
			'requiredTags1: []',
			'requiredTags2: []',
			'prohibitedTags: []',
			'evaluators: []',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
			'analysisQueries:',
			'  - description: Missing currency query',
			'    currency: EUR',
		].join('\n')
	)

	const output = expectModuleSuccess(env.runModule('cli:run', { argv: ['run-evals', '--dry-run'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 1)
	assert.match(
		String(output.logs[0]?.[0]),
		/Currency registry is missing YAML files for referenced currencies|The DB at .* does not exist/
	)
})
