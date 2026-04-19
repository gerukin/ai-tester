import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
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

	const runTestsWithOverrides = expectModuleSuccess(
		env.runModule('cli:dispatch', {
			argv: ['run-tests', '--dry-run', '--include-counts', '--config-overrides', '{"attempts":2}'],
		})
	) as {
		result: {
			exitCode: number
			calls: Array<{ name: string; dryRun?: boolean; includeCounts?: boolean; configOverridesJson?: string }>
		}
	}
	assert.strictEqual(runTestsWithOverrides.result.exitCode, 0)
	assert.deepStrictEqual(runTestsWithOverrides.result.calls, [
		{ name: 'run-tests', dryRun: true, includeCounts: true, configOverridesJson: '{"attempts":2}' },
	])

	const runEvals = expectModuleSuccess(env.runModule('cli:dispatch', { argv: ['run-evals'] })) as {
		result: { exitCode: number; calls: Array<{ name: string; dryRun?: boolean }> }
	}
	assert.strictEqual(runEvals.result.exitCode, 0)
	assert.deepStrictEqual(runEvals.result.calls, [{ name: 'run-evals', dryRun: false }])

	const runEvalsWithOverrides = expectModuleSuccess(
		env.runModule('cli:dispatch', {
			argv: ['run-evals', '--dry-run', '--include-counts', '--config-overrides-file', 'eval-overrides.json'],
		})
	) as {
		result: {
			exitCode: number
			calls: Array<{ name: string; dryRun?: boolean; includeCounts?: boolean; configOverridesFile?: string }>
		}
	}
	assert.strictEqual(runEvalsWithOverrides.result.exitCode, 0)
	assert.deepStrictEqual(runEvalsWithOverrides.result.calls, [
		{ name: 'run-evals', dryRun: true, includeCounts: true, configOverridesFile: 'eval-overrides.json' },
	])

	const sync = expectModuleSuccess(env.runModule('cli:dispatch', { argv: ['sync'] })) as {
		result: { exitCode: number; calls: Array<{ name: string }> }
	}
	assert.strictEqual(sync.result.exitCode, 0)
	assert.deepStrictEqual(sync.result.calls, [{ name: 'sync' }])

	const skillsSync = expectModuleSuccess(env.runModule('cli:dispatch', { argv: ['skills', 'sync'] })) as {
		result: { exitCode: number; calls: Array<{ name: string; replace?: boolean }> }
	}
	assert.strictEqual(skillsSync.result.exitCode, 0)
	assert.deepStrictEqual(skillsSync.result.calls, [{ name: 'skills:sync', replace: false }])

	const skillsSyncReplace = expectModuleSuccess(
		env.runModule('cli:dispatch', { argv: ['skills', 'sync', '--replace'] })
	) as {
		result: { exitCode: number; calls: Array<{ name: string; replace?: boolean }> }
	}
	assert.strictEqual(skillsSyncReplace.result.exitCode, 0)
	assert.deepStrictEqual(skillsSyncReplace.result.calls, [{ name: 'skills:sync', replace: true }])

	const migrate = expectModuleSuccess(env.runModule('cli:dispatch', { argv: ['migrate'] })) as {
		result: { exitCode: number; calls: Array<{ name: string }> }
	}
	assert.strictEqual(migrate.result.exitCode, 0)
	assert.deepStrictEqual(migrate.result.calls, [{ name: 'migrate' }])

	const list = expectModuleSuccess(
		env.runModule('cli:dispatch', { argv: ['list', '--models', '--tags', '--prompts', '--currencies'] })
	) as {
		result: {
			exitCode: number
			calls: Array<{
				name: string
				listOptions?: { models?: boolean; tags?: boolean; prompts?: boolean; currencies?: boolean }
			}>
		}
	}
	assert.strictEqual(list.result.exitCode, 0)
	assert.deepStrictEqual(list.result.calls, [
		{ name: 'list', listOptions: { models: true, tags: true, prompts: true, currencies: true } },
	])

	const statsQuery = expectModuleSuccess(
		env.runModule('cli:dispatch', { argv: ['stats', '--query', 'Named query'] })
	) as {
		result: { exitCode: number; calls: Array<{ name: string; description?: string }> }
	}
	assert.strictEqual(statsQuery.result.exitCode, 0)
	assert.deepStrictEqual(statsQuery.result.calls, [{ name: 'stats:query', description: 'Named query' }])

	const statsQueryJson = expectModuleSuccess(
		env.runModule('cli:dispatch', {
			argv: ['stats', '--query-json', '{"description":"Ad hoc","currency":"USD"}', '--dry-run'],
		})
	) as {
		result: { exitCode: number; calls: Array<{ name: string; json?: string; dryRun?: boolean }> }
	}
	assert.strictEqual(statsQueryJson.result.exitCode, 0)
	assert.deepStrictEqual(statsQueryJson.result.calls, [
		{ name: 'stats:query-json', json: '{"description":"Ad hoc","currency":"USD"}', dryRun: true },
	])

	const statsQueryFile = expectModuleSuccess(
		env.runModule('cli:dispatch', { argv: ['stats', '--query-file', 'stats-query.json'] })
	) as {
		result: { exitCode: number; calls: Array<{ name: string; filePath?: string }> }
	}
	assert.strictEqual(statsQueryFile.result.exitCode, 0)
	assert.deepStrictEqual(statsQueryFile.result.calls, [
		{ name: 'stats:query-file', filePath: 'stats-query.json' },
	])
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
	assert.match(String(rootHelp.logs[0]?.[0]), /list\s+List file-backed values usable in runtime overrides/)

	const statsHelp = expectModuleSuccess(env.runModule('cli:run', { argv: ['stats', '-h'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(statsHelp.result.exitCode, 0)
	assert.match(String(statsHelp.logs[0]?.[0]), /ai-tester stats --list/)

	const skillsHelp = expectModuleSuccess(env.runModule('cli:run', { argv: ['skills', '--help'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(skillsHelp.result.exitCode, 0)
	assert.match(String(skillsHelp.logs[0]?.[0]), /ai-tester skills sync \[--replace\]/)

	const skillsSyncHelp = expectModuleSuccess(env.runModule('cli:run', { argv: ['skills', 'sync', '-h'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(skillsSyncHelp.result.exitCode, 0)
	assert.match(String(skillsSyncHelp.logs[0]?.[0]), /--replace\s+Replace \.agents\/skills\/ai-tester/)

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

	const listHelp = expectModuleSuccess(env.runModule('cli:run', { argv: ['list', '--help'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(listHelp.result.exitCode, 0)
	assert.match(String(listHelp.logs[0]?.[0]), /Usage: ai-tester list \[--models\]/)
})

test('cli list prints file-backed values for runtime overrides without an existing database', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	env.env.AI_TESTER_SQLITE_DB_PATH = `${env.rootDir}/missing-db.sqlite`

	await env.write('data/providers/openai.yaml', ['code: openai', 'name: OpenAI', 'type: openai'].join('\n'))
	await env.write('data/providers/ollama.yaml', ['code: ollama', 'name: Ollama', 'type: ollama'].join('\n'))
	await env.write(
		'data/models/openai/gpt-4o-mini.yaml',
		[
			'code: gpt-4o-mini',
			'provider: openai',
			'providerModelCode: gpt-4o-mini-2024-07-18',
			'costs:',
			'  - costPerPromptToken: 0.00000015',
			'    costPerCompletionToken: 0.0000006',
			'    currency: USD',
			'    validFrom: 2025-01-01',
		].join('\n')
	)
	await env.write(
		'data/models/ollama/gemma.yaml',
		[
			'code: gemma',
			'provider: ollama',
			'providerModelCode: gemma2:9b',
			'active: false',
			'costs: []',
		].join('\n')
	)
	await env.write(
		'data/tests/smoke.md',
		[
			'---',
			'tags:',
			'  - smoke',
			'  - lang_en',
			'systemPrompts:',
			'  - helpful',
			'---',
			'# 👤',
			'Hello',
			'---',
			'Pass when helpful.',
		].join('\n')
	)
	await env.write(
		'data/tests/reasoning.md',
		[
			'---',
			'tags:',
			'  - reasoning',
			'  - smoke',
			'systemPrompts:',
			'  - concise',
			'---',
			'# 👤',
			'Think.',
			'---',
			'Pass when correct.',
		].join('\n')
	)
	await env.write(
		'data/prompts/helpful.md',
		['---', 'id: helpful', 'tags:', '  - candidate', '---', 'You are helpful.'].join('\n')
	)
	await env.write(
		'data/prompts/concise.md',
		['---', 'id: concise', '---', 'You are concise.'].join('\n')
	)
	await env.write(
		'data/prompts/evaluator.md',
		['---', 'id: _evaluator_default', 'tags:', '  - _evaluator', '---', 'System', '# 👤', 'User'].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)
	await env.write(
		'data/currencies/jpy.yaml',
		['code: jpy', 'rates:', '  - rateInUSD: 0.0067', '    validFrom: 2025-01-01'].join('\n')
	)

	const output = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['list', '--models', '--tags', '--prompts', '--currencies'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	const text = String(output.logs[0]?.[0])
	assert.match(text, /Models:\n  {"id":"openai\/gpt-4o-mini-2024-07-18"}/)
	assert.doesNotMatch(text, /gemma2:9b/)
	assert.match(text, /Tags:\n  lang_en\n  reasoning\n  smoke/)
	assert.match(text, /Prompts:\n  concise\n  helpful/)
	assert.doesNotMatch(text, /_evaluator_default/)
	assert.match(text, /Currencies:\n  JPY\n  USD/)

	const modelsOnly = expectModuleSuccess(env.runModule('cli:run', { argv: ['list', '--models'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(modelsOnly.result.exitCode, 0)
	assert.match(String(modelsOnly.logs[0]?.[0]), /Models:/)
	assert.doesNotMatch(String(modelsOnly.logs[0]?.[0]), /Tags:/)
})

test('cli skills sync creates the packaged ai-tester skill', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const output = expectModuleSuccess(env.runModule('actions:syncSkill', { cwd: env.rootDir, isInteractive: false })) as {
		result: { confirmCalls: number; messages: string[] }
		logs: string[][]
	}

	const skillPath = path.join(env.rootDir, '.agents/skills/ai-tester/SKILL.md')
	const runningReferencePath = path.join(env.rootDir, '.agents/skills/ai-tester/references/running.md')
	const skillContent = await fs.readFile(skillPath, 'utf8')
	const runningReferenceContent = await fs.readFile(runningReferencePath, 'utf8')

	assert.strictEqual(output.result.confirmCalls, 0)
	assert.deepStrictEqual(output.result.messages, [])
	assert.match(String(output.logs[0]?.[0]), /Created ai-tester skill/)
	assert.match(skillContent, /name: ai-tester/)
	assert.match(skillContent, /current project/)
	assert.match(skillContent, /references\/running\.md/)
	assert.match(runningReferenceContent, /Dry Runs/)
})

test('cli skills sync can cancel replacement after confirmation', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const skillPath = await env.write('.agents/skills/ai-tester/SKILL.md', 'local edit\n')
	const output = expectModuleSuccess(
		env.runModule('actions:syncSkill', { cwd: env.rootDir, confirmReplace: false, isInteractive: true })
	) as {
		result: { confirmCalls: number; messages: string[] }
		logs: string[][]
	}

	assert.strictEqual(output.result.confirmCalls, 1)
	assert.match(output.result.messages[0] ?? '', /Replace .*\.agents\/skills\/ai-tester/)
	assert.match(String(output.logs[0]?.[0]), /Skill sync cancelled/)
	assert.strictEqual(await fs.readFile(skillPath, 'utf8'), 'local edit\n')
})

test('cli skills sync replaces the existing skill after confirmation', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const skillPath = await env.write('.agents/skills/ai-tester/SKILL.md', 'local edit\n')
	const output = expectModuleSuccess(
		env.runModule('actions:syncSkill', { cwd: env.rootDir, confirmReplace: true, isInteractive: true })
	) as {
		result: { confirmCalls: number; messages: string[] }
		logs: string[][]
	}

	const skillContent = await fs.readFile(skillPath, 'utf8')
	assert.strictEqual(output.result.confirmCalls, 1)
	assert.match(String(output.logs[0]?.[0]), /Replaced ai-tester skill/)
	assert.match(skillContent, /name: ai-tester/)
	assert.doesNotMatch(skillContent, /local edit/)
})

test('cli skills sync --replace bypasses confirmation and removes stale destination files', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const skillPath = await env.write('.agents/skills/ai-tester/SKILL.md', 'local edit\n')
	const stalePath = await env.write('.agents/skills/ai-tester/stale.md', 'stale\n')
	const output = expectModuleSuccess(
		env.runModule('actions:syncSkill', { cwd: env.rootDir, replace: true, confirmReplace: false, isInteractive: false })
	) as {
		result: { confirmCalls: number }
		logs: string[][]
	}

	const skillContent = await fs.readFile(skillPath, 'utf8')
	assert.strictEqual(output.result.confirmCalls, 0)
	assert.match(String(output.logs[0]?.[0]), /Replaced ai-tester skill/)
	assert.match(skillContent, /name: ai-tester/)
	await assert.rejects(fs.access(stalePath))
})

test('cli skills sync fails non-interactive replacement without --replace', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write('.agents/skills/ai-tester/SKILL.md', 'local edit\n')
	const output = expectModuleSuccess(
		env.runModule('cli:run', { cwd: env.rootDir, argv: ['skills', 'sync'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 2)
	assert.match(String(output.logs[0]?.[0]), /already exists/)
	assert.match(String(output.logs[0]?.[0]), /--replace/)
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

	const missingListFlags = expectModuleSuccess(env.runModule('cli:run', { argv: ['list'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(missingListFlags.result.exitCode, 2)
	assert.match(String(missingListFlags.logs[0]?.[0]), /list requires at least one of --models/)

	const unknownListOption = expectModuleSuccess(env.runModule('cli:run', { argv: ['list', '--unknown'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(unknownListOption.result.exitCode, 2)
	assert.match(String(unknownListOption.logs[0]?.[0]), /Unknown option for list: --unknown/)

	const missingStatsMode = expectModuleSuccess(env.runModule('cli:run', { argv: ['stats'] })) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(missingStatsMode.result.exitCode, 2)
	assert.match(String(missingStatsMode.logs[0]?.[0]), /stats requires exactly one of --list/)

	const conflictingStatsMode = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['stats', '--list', '--query', 'Named query'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(conflictingStatsMode.result.exitCode, 2)
	assert.match(String(conflictingStatsMode.logs[0]?.[0]), /stats requires exactly one of --list/)

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
	assert.match(String(repeatedStatsQuery.logs[0]?.[0]), /stats requires exactly one of --list/)

	const conflictingRunOverrides = expectModuleSuccess(
		env.runModule('cli:run', {
			argv: ['run-tests', '--config-overrides', '{}', '--config-overrides-file', 'overrides.json'],
		})
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(conflictingRunOverrides.result.exitCode, 2)
	assert.match(String(conflictingRunOverrides.logs[0]?.[0]), /run-tests accepts only one runtime override source/)

	const invalidRunOverrideJson = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['run-tests', '--config-overrides', '{'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(invalidRunOverrideJson.result.exitCode, 2)
	assert.match(String(invalidRunOverrideJson.logs[0]?.[0]), /run-tests --config-overrides must be valid JSON/)

	const includeCountsWithoutDryRun = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['run-tests', '--include-counts'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(includeCountsWithoutDryRun.result.exitCode, 2)
	assert.match(String(includeCountsWithoutDryRun.logs[0]?.[0]), /run-tests --include-counts can only be used with --dry-run/)

	const conflictingStatsQueryModes = expectModuleSuccess(
		env.runModule('cli:run', {
			argv: ['stats', '--query', 'Existing query', '--query-json', '{"currency":"USD"}'],
		})
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(conflictingStatsQueryModes.result.exitCode, 2)
	assert.match(String(conflictingStatsQueryModes.logs[0]?.[0]), /stats requires exactly one of --list/)

	const invalidStatsQueryJson = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['stats', '--query-json', '{'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}
	assert.strictEqual(invalidStatsQueryJson.result.exitCode, 2)
	assert.match(String(invalidStatsQueryJson.logs[0]?.[0]), /stats --query-json must be valid JSON/)

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
			'      - id: missing/missing',
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

	const dryRunNamedQuery = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['stats', '--query', 'Empty query', '--dry-run'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(dryRunNamedQuery.result.exitCode, 0)
	assert.strictEqual(dryRunNamedQuery.logs[0]?.[0], 'Dry run: would run stats query.')
	assert.match(String(dryRunNamedQuery.logs[1]?.[0]), /Dry run: resolved stats query:/)
})

test('cli stats can run an ad hoc query from JSON without configured analysisQueries', async t => {
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
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	const output = expectModuleSuccess(
		env.runModule('cli:run', {
			argv: [
				'stats',
				'--query-json',
				JSON.stringify({
					currency: 'usd',
					candidates: [],
				}),
			],
		})
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.deepStrictEqual(output.logs, [
		['Checking for stats...'],
		['⚠️ Query "Ad hoc query" has no active candidate models.'],
	])
})

test('cli stats --dry-run validates and prints ad hoc query without running stats', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)
	await env.write(
		'ad-hoc-query.json',
		JSON.stringify({
			description: 'Dry ad hoc',
			currency: 'USD',
			requiredTags1: ['smoke'],
			systemPrompts: ['helpful'],
		})
	)

	const output = expectModuleSuccess(
		env.runModule('cli:run', {
			argv: ['stats', '--dry-run', '--query-file', `${env.rootDir}/ad-hoc-query.json`],
		})
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.strictEqual(output.logs[0]?.[0], 'Dry run: would run stats query.')
	assert.match(String(output.logs[1]?.[0]), /Dry run: resolved stats query:/)
	const resolvedQuery = JSON.parse(String(output.logs[1]?.[0]).split('\n').slice(1).join('\n')) as {
		description: string
		currency: string
		requiredTags1: string[]
		systemPrompts: string[]
	}
	assert.strictEqual(resolvedQuery.description, 'Dry ad hoc')
	assert.strictEqual(resolvedQuery.currency, 'USD')
	assert.deepStrictEqual(resolvedQuery.requiredTags1, ['smoke'])
	assert.deepStrictEqual(resolvedQuery.systemPrompts, ['helpful'])
})

test('cli stats --dry-run suppresses unavailable model warnings for ad hoc queries', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	const output = expectModuleSuccess(
		env.runModule('cli:run', {
			argv: [
				'stats',
				'--dry-run',
				'--query-json',
				JSON.stringify({
					currency: 'USD',
					candidates: [{ id: 'missing/missing' }],
				}),
			],
		})
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.strictEqual(output.logs[0]?.[0], 'Dry run: would run stats query.')
	assert.match(String(output.logs[1]?.[0]), /Dry run: resolved stats query:/)
})

test('cli stats ad hoc queries do not validate unrelated configured query currencies', async t => {
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
			'  - description: Broken configured query',
			'    currency: EUR',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	const output = expectModuleSuccess(
		env.runModule('cli:run', {
			argv: ['stats', '--query-json', JSON.stringify({ currency: 'USD', candidates: [] })],
		})
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.deepStrictEqual(output.logs, [
		['Checking for stats...'],
		['⚠️ Query "Ad hoc query" has no active candidate models.'],
	])
})

test('cli stats ad hoc query validates runtime query currencies', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const output = expectModuleSuccess(
		env.runModule('cli:run', {
			argv: [
				'stats',
				'--query-json',
				JSON.stringify({
					description: 'Missing runtime currency',
					currency: 'EUR',
				}),
			],
		})
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 1)
	assert.match(
		String(output.logs[0]?.[0]),
		/Currency registry is missing YAML files for referenced currencies: EUR \(analysis query "Missing runtime currency"\)/
	)
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
	assert.deepStrictEqual(output.logs.slice(0, 2), [
		['Dry run: would sync currencies, providers, structured objects, tools, prompts, and tests.'],
		['Dry run: would then run missing tests.'],
	])
	assert.match(String(output.logs[2]?.[0]), /Dry run: resolved test run configuration:/)
	const resolvedConfig = JSON.parse(String(output.logs[2]?.[0]).split('\n').slice(1).join('\n')) as {
		attempts: number
	}
	assert.strictEqual(resolvedConfig.attempts, 1)

	const after = await env.db.select().from(schema.providers)
	assert.deepStrictEqual(after, [])
})

test('cli run-tests --dry-run applies runtime overrides and does not mutate the database', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const output = expectModuleSuccess(
		env.runModule('cli:run', {
			argv: [
				'run-tests',
				'--dry-run',
				'--config-overrides',
				JSON.stringify({
					attempts: 2,
					candidatesTemperature: 0.7,
					requiredTags1: ['smoke'],
					prohibitedTags: ['skip'],
				}),
			],
		})
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	const resolvedConfig = JSON.parse(String(output.logs[2]?.[0]).split('\n').slice(1).join('\n')) as {
		attempts: number
		candidatesTemperature: number
		requiredTags1: string[]
		prohibitedTags: string[]
	}
	assert.strictEqual(resolvedConfig.attempts, 2)
	assert.strictEqual(resolvedConfig.candidatesTemperature, 0.7)
	assert.deepStrictEqual(resolvedConfig.requiredTags1, ['smoke'])
	assert.deepStrictEqual(resolvedConfig.prohibitedTags, ['skip'])

	const after = await env.db.select().from(schema.providers)
	assert.deepStrictEqual(after, [])
})

test('cli run-tests --dry-run --include-counts syncs a temporary database copy only', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const output = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['run-tests', '--dry-run', '--include-counts'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.deepStrictEqual(output.logs.slice(0, 3), [
		['Dry run: would sync currencies, providers, structured objects, tools, prompts, and tests.'],
		['Dry run: would then run missing tests.'],
		['Dry run: 0 missing test run(s) after syncing a temporary database copy.'],
	])
	assert.match(String(output.logs[3]?.[0]), /Dry run: resolved test run configuration:/)

	const after = await env.db.select().from(schema.providers)
	assert.deepStrictEqual(after, [])
})

test('cli run-tests runtime overrides filter unavailable model references', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write('data/providers/openai.yaml', ['code: openai', 'name: OpenAI', 'type: openai'].join('\n'))
	await env.write(
		'data/models/gpt-4o-mini.yaml',
		[
			'code: gpt-4o-mini',
			'provider: openai',
			'providerModelCode: gpt-4o-mini',
			'costs:',
			'  - costPerCall: 0',
			'    costPerPromptToken: 0',
			'    costPerCompletionToken: 0',
			'    costPerHour: 0',
			'    currency: USD',
			'    validFrom: 2025-01-01',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	const output = expectModuleSuccess(
		env.runModule('cli:run', {
			argv: [
				'run-tests',
				'--dry-run',
				'--config-overrides',
				JSON.stringify({
					candidates: [
						{ id: 'openai/gpt-4o-mini' },
						{ id: 'openai/missing-model' },
					],
				}),
			],
		})
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.deepStrictEqual(output.logs.slice(0, 2), [
		['Dry run: would sync currencies, providers, structured objects, tools, prompts, and tests.'],
		['Dry run: would then run missing tests.'],
	])
	const resolvedLog = output.logs.find(entry =>
		String(entry[0]).startsWith('Dry run: resolved test run configuration:')
	)
	const resolvedConfig = JSON.parse(String(resolvedLog?.[0]).split('\n').slice(1).join('\n')) as {
		candidates: Array<{ id: string }>
	}
	assert.deepStrictEqual(resolvedConfig.candidates, [{ id: 'openai/gpt-4o-mini' }])
})

test('run-tests confirmation cancellation happens before runtime config parsing', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.remove('ai-tester.config.yaml')

	const output = expectModuleSuccess(env.runModule('actions:runTestsWithSyncCancelled')) as {
		result: { confirmCalls: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.confirmCalls, 1)
	assert.deepStrictEqual(output.logs, [])
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
	assert.deepStrictEqual(output.logs.slice(0, 2), [
		['Dry run: would sync currencies, providers, structured objects, tools, prompts, and tests.'],
		['Dry run: would then run missing evaluations.'],
	])
	assert.match(String(output.logs[2]?.[0]), /Dry run: resolved evaluation run configuration:/)
})

test('cli run-evals --dry-run applies file runtime overrides and does not mutate the database', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'eval-overrides.json',
		JSON.stringify({
			evaluatorsTemperature: 0.8,
			evaluationsPerEvaluator: 2,
			requiredTags2: ['reasoning'],
		})
	)

	const output = expectModuleSuccess(
		env.runModule('cli:run', {
			argv: ['run-evals', '--dry-run', '--config-overrides-file', `${env.rootDir}/eval-overrides.json`],
		})
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	const resolvedConfig = JSON.parse(String(output.logs[2]?.[0]).split('\n').slice(1).join('\n')) as {
		evaluatorsTemperature: number
		evaluationsPerEvaluator: number
		requiredTags2: string[]
	}
	assert.strictEqual(resolvedConfig.evaluatorsTemperature, 0.8)
	assert.strictEqual(resolvedConfig.evaluationsPerEvaluator, 2)
	assert.deepStrictEqual(resolvedConfig.requiredTags2, ['reasoning'])

	const after = await env.db.select().from(schema.providers)
	assert.deepStrictEqual(after, [])
})

test('cli run-evals --dry-run --include-counts syncs a temporary database copy only', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const output = expectModuleSuccess(
		env.runModule('cli:run', { argv: ['run-evals', '--dry-run', '--include-counts'] })
	) as {
		result: { exitCode: number }
		logs: string[][]
	}

	assert.strictEqual(output.result.exitCode, 0)
	assert.deepStrictEqual(output.logs.slice(0, 3), [
		['Dry run: would sync currencies, providers, structured objects, tools, prompts, and tests.'],
		['Dry run: would then run missing evaluations.'],
		['Dry run: 0 missing evaluation run(s) after syncing a temporary database copy.'],
	])
	assert.match(String(output.logs[3]?.[0]), /Dry run: resolved evaluation run configuration:/)

	const after = await env.db.select().from(schema.providers)
	assert.deepStrictEqual(after, [])
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
