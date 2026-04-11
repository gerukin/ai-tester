import { CliUsageError } from './errors.js'

type RunWithSyncCliOptions = {
	dryRun?: boolean
	includeCounts?: boolean
	configOverridesJson?: string
	configOverridesFile?: string
}

type SyncSkillCliOptions = {
	replace?: boolean
}

type ListValueCliOptions = {
	models?: boolean
	tags?: boolean
	prompts?: boolean
	currencies?: boolean
}

type CliDeps = {
	runInteractive: () => Promise<unknown>
	syncAll: () => Promise<void>
	syncSkill: (options?: SyncSkillCliOptions) => Promise<void>
	listAvailableValues: (options: ListValueCliOptions) => Promise<void>
	runTestsWithSync: (options?: RunWithSyncCliOptions) => Promise<void>
	runEvalsWithSync: (options?: RunWithSyncCliOptions) => Promise<void>
	listStatsQueries: () => Promise<void>
	runStatsQueryByDescription: (description: string, options?: { dryRun?: boolean }) => Promise<void>
	runStatsQueryJson: (json: string, options?: { dryRun?: boolean }) => Promise<void>
	runStatsQueryFile: (filePath: string, options?: { dryRun?: boolean }) => Promise<void>
	runMigrations: () => Promise<void>
}

const STATS_MODE_ERROR =
	'stats requires exactly one of --list, --query <name>, --query-json <json>, or --query-file <path>.'

const ROOT_HELP = `Usage: ai-tester [command] [options]

Commands:
  migrate               Run outstanding database migrations.
  sync                  Synchronize currencies, providers, structured objects, tools, prompts, and tests.
  skills sync           Copy the packaged ai-tester skill into .agents/skills/ai-tester.
  list                  List file-backed values usable in runtime overrides.
  run-tests             Sync first, then run missing tests.
  run-evals             Sync first, then run missing evaluations.
  stats --list          List runnable analysis query descriptions.
  stats --query <name>  Run one configured analysis query by exact description.
  stats --query-json    Run an ad hoc analysis query from inline JSON.
  stats --query-file    Run an ad hoc analysis query from a JSON file.

Options:
  -h, --help            Show help for the root command or a subcommand.`

const LIST_FLAGS = '--models, --tags, --prompts, --currencies'

const LIST_HELP = `Usage: ai-tester list [--models] [--tags] [--prompts] [--currencies]

List file-backed values usable in runtime overrides and ad hoc stats queries.

Options:
  --models              List active provider/model references.
  --tags                List test tags.
  --prompts             List non-evaluator prompt codes.
  --currencies          List file-backed currency codes.
  -h, --help            Show this help message.`

const MIGRATE_HELP = `Usage: ai-tester migrate

Run outstanding database migrations.

Options:
  -h, --help            Show this help message.`

const SYNC_HELP = `Usage: ai-tester sync

Synchronize currencies, providers, structured objects, tools, prompts, and tests.

Options:
  -h, --help            Show this help message.`

const SKILLS_HELP = `Usage:
  ai-tester skills sync [--replace]

Manage packaged ai-tester skills.

Commands:
  sync                  Copy the packaged ai-tester skill into .agents/skills/ai-tester.

Options:
  -h, --help            Show this help message.`

const SKILLS_SYNC_HELP = `Usage: ai-tester skills sync [--replace]

Copy the packaged ai-tester skill into .agents/skills/ai-tester.

If the destination already exists, interactive runs ask before replacing it.
Unattended runs fail unless --replace is set.
Use --replace to replace the destination without confirmation.

Options:
  --replace             Replace .agents/skills/ai-tester without interactive confirmation.
  -h, --help            Show this help message.`

const RUN_TESTS_HELP = `Usage: ai-tester run-tests [--dry-run] [--include-counts] [--config-overrides <json> | --config-overrides-file <path>]

Synchronize currencies, providers, structured objects, tools, prompts, and tests,
then run missing tests without interactive prompts.

Options:
  --dry-run                  Validate the command and print the resolved action/configuration without mutating state.
  --include-counts           With --dry-run, sync a temporary DB copy and print the missing test count.
  --config-overrides <json>  Shallow-replace test run config fields from inline JSON.
  --config-overrides-file    Shallow-replace test run config fields from a JSON file.
  ai-tester list --models --tags
                              List values usable in runtime override JSON.
  -h, --help                 Show this help message.`

const RUN_EVALS_HELP = `Usage: ai-tester run-evals [--dry-run] [--include-counts] [--config-overrides <json> | --config-overrides-file <path>]

Synchronize currencies, providers, structured objects, tools, prompts, and tests,
then run missing evaluations without interactive prompts.

Options:
  --dry-run                  Validate the command and print the resolved action/configuration without mutating state.
  --include-counts           With --dry-run, sync a temporary DB copy and print the missing evaluation count.
  --config-overrides <json>  Shallow-replace evaluation run config fields from inline JSON.
  --config-overrides-file    Shallow-replace evaluation run config fields from a JSON file.
  ai-tester list --models --tags
                              List values usable in runtime override JSON.
  -h, --help                 Show this help message.`

const STATS_HELP = `Usage:
  ai-tester stats --list
  ai-tester stats --query <name> [--dry-run]
  ai-tester stats --query-json <json> [--dry-run]
  ai-tester stats --query-file <path> [--dry-run]

List configured analysis queries, run one by exact description, or run an ad hoc query.

Options:
  --list                Print runnable analysis query descriptions, one per line.
  --query <name>        Run the matching configured analysis query.
  --query-json <json>   Run an ad hoc analysis query from inline JSON.
  --query-file <path>   Run an ad hoc analysis query from a JSON file.
  --dry-run             Validate and print the resolved query without running stats.
  ai-tester list --models --tags --prompts --currencies
                       List values usable in ad hoc stats JSON.
  -h, --help            Show this help message.`

const isHelpFlag = (value: string) => value === '-h' || value === '--help'

const createDefaultDeps = (): CliDeps => ({
	runInteractive: async () => (await import('../bootstrap.js')).runDefaultApp(),
	syncAll: async () => (await import('./actions.js')).syncAll(),
	syncSkill: async options => (await import('./actions.js')).syncSkill(options),
	listAvailableValues: async options => {
		console.log((await import('./list-values.js')).formatAvailableValues(options))
	},
	runTestsWithSync: async options => (await import('./actions.js')).runTestsWithSync(options),
	runEvalsWithSync: async options => (await import('./actions.js')).runEvalsWithSync(options),
	listStatsQueries: async () => (await import('./actions.js')).listStatsQueries(),
	runStatsQueryByDescription: async (description, options) =>
		(await import('./actions.js')).runStatsQueryByDescription(description, options),
	runStatsQueryJson: async (json, options) => (await import('./actions.js')).runStatsQueryJson(json, options),
	runStatsQueryFile: async (filePath, options) => (await import('./actions.js')).runStatsQueryFile(filePath, options),
	runMigrations: async () => (await import('./actions.js')).runMigrations(),
})

const ensureNoExtraArgs = (command: string, args: string[]) => {
	if (args.length > 0) {
		throw new CliUsageError(`Unexpected argument for ${command}: ${args[0]}`)
	}
}

const readOptionValue = (command: string, option: string, args: string[], index: number) => {
	const next = args[index + 1]
	if (next === undefined) {
		throw new CliUsageError(`Missing value for ${command} ${option}.`)
	}
	return next
}

const parseRunWithOverridesArgs = (command: string, args: string[]) => {
	let dryRun = false
	let includeCounts = false
	let configOverridesJson: string | undefined
	let configOverridesFile: string | undefined

	for (let index = 0; index < args.length; index++) {
		const arg = args[index]
		if (arg === '--dry-run') {
			dryRun = true
			continue
		}
		if (arg === '--include-counts') {
			includeCounts = true
			continue
		}
		if (arg === '--config-overrides') {
			if (configOverridesJson !== undefined || configOverridesFile !== undefined) {
				throw new CliUsageError(`${command} accepts only one runtime override source.`)
			}
			configOverridesJson = readOptionValue(command, arg, args, index)
			index += 1
			continue
		}
		if (arg === '--config-overrides-file') {
			if (configOverridesJson !== undefined || configOverridesFile !== undefined) {
				throw new CliUsageError(`${command} accepts only one runtime override source.`)
			}
			configOverridesFile = readOptionValue(command, arg, args, index)
			index += 1
			continue
		}
		if (isHelpFlag(arg)) return { help: true, dryRun, includeCounts }
		throw new CliUsageError(`Unknown option for ${command}: ${arg}`)
	}

	if (includeCounts && !dryRun) {
		throw new CliUsageError(`${command} --include-counts can only be used with --dry-run.`)
	}

	return { help: false, dryRun, includeCounts, configOverridesJson, configOverridesFile }
}

const parseStatsArgs = (args: string[]) => {
	let shouldList = false
	let queryName: string | undefined
	let queryJson: string | undefined
	let queryFile: string | undefined
	let dryRun = false

	for (let index = 0; index < args.length; index++) {
		const arg = args[index]
		if (isHelpFlag(arg)) return { help: true, shouldList, queryName, queryJson, queryFile, dryRun }
		if (arg === '--dry-run') {
			dryRun = true
			continue
		}
		if (arg === '--list') {
			if (shouldList || queryName !== undefined || queryJson !== undefined || queryFile !== undefined) {
				throw new CliUsageError(STATS_MODE_ERROR)
			}
			shouldList = true
			continue
		}
		if (arg === '--query') {
			if (shouldList || queryName !== undefined || queryJson !== undefined || queryFile !== undefined) {
				throw new CliUsageError(STATS_MODE_ERROR)
			}
			queryName = readOptionValue('stats', arg, args, index)
			index += 1
			continue
		}
		if (arg === '--query-json') {
			if (shouldList || queryName !== undefined || queryJson !== undefined || queryFile !== undefined) {
				throw new CliUsageError(STATS_MODE_ERROR)
			}
			queryJson = readOptionValue('stats', arg, args, index)
			index += 1
			continue
		}
		if (arg === '--query-file') {
			if (shouldList || queryName !== undefined || queryJson !== undefined || queryFile !== undefined) {
				throw new CliUsageError(STATS_MODE_ERROR)
			}
			queryFile = readOptionValue('stats', arg, args, index)
			index += 1
			continue
		}
		throw new CliUsageError(`Unknown option for stats: ${arg}`)
	}

	const modeCount = [shouldList, queryName !== undefined, queryJson !== undefined, queryFile !== undefined].filter(Boolean).length
	if (modeCount !== 1) {
		throw new CliUsageError(STATS_MODE_ERROR)
	}

	if (shouldList && dryRun) {
		throw new CliUsageError('stats --dry-run can only be used with --query, --query-json, or --query-file.')
	}

	return { help: false, shouldList, queryName, queryJson, queryFile, dryRun }
}

const parseSkillsArgs = (args: string[]) => {
	if (args.length === 0 || isHelpFlag(args[0]!)) return { help: true, sync: false, replace: false }

	const [subcommand, ...rest] = args
	if (subcommand !== 'sync') {
		throw new CliUsageError(`Unknown skills command: ${subcommand}`)
	}

	let replace = false
	for (const arg of rest) {
		if (arg === '--replace') {
			replace = true
			continue
		}
		if (isHelpFlag(arg)) return { help: true, sync: true, replace }
		throw new CliUsageError(`Unknown option for skills sync: ${arg}`)
	}

	return { help: false, sync: true, replace }
}

const parseListArgs = (args: string[]) => {
	const options: ListValueCliOptions = {}

	for (const arg of args) {
		if (arg === '--models') {
			options.models = true
			continue
		}
		if (arg === '--tags') {
			options.tags = true
			continue
		}
		if (arg === '--prompts') {
			options.prompts = true
			continue
		}
		if (arg === '--currencies') {
			options.currencies = true
			continue
		}
		if (isHelpFlag(arg)) return { help: true, options }
		throw new CliUsageError(`Unknown option for list: ${arg}`)
	}

	if (!options.models && !options.tags && !options.prompts && !options.currencies) {
		throw new CliUsageError(`list requires at least one of ${LIST_FLAGS}.`)
	}

	return { help: false, options }
}

const printHelp = (text: string) => {
	console.log(text)
}

export const runCli = async (argv: string[], deps: CliDeps = createDefaultDeps()): Promise<number> => {
	try {
		if (argv.length === 0) {
			await deps.runInteractive()
			return 0
		}

		const [command, ...rest] = argv
		if (isHelpFlag(command)) {
			printHelp(ROOT_HELP)
			return 0
		}

		switch (command) {
			case 'migrate':
				if (rest.some(isHelpFlag)) {
					printHelp(MIGRATE_HELP)
					return 0
				}
				ensureNoExtraArgs(command, rest)
				await deps.runMigrations()
				return 0

			case 'sync':
				if (rest.some(isHelpFlag)) {
					printHelp(SYNC_HELP)
					return 0
				}
				ensureNoExtraArgs(command, rest)
				await deps.syncAll()
				return 0

			case 'skills': {
				const parsed = parseSkillsArgs(rest)
				if (parsed.help) {
					printHelp(parsed.sync ? SKILLS_SYNC_HELP : SKILLS_HELP)
					return 0
				}
				await deps.syncSkill({ replace: parsed.replace })
				return 0
			}

			case 'list': {
				const parsed = parseListArgs(rest)
				if (parsed.help) {
					printHelp(LIST_HELP)
					return 0
				}
				await deps.listAvailableValues(parsed.options)
				return 0
			}

			case 'run-tests': {
				const parsed = parseRunWithOverridesArgs(command, rest)
				if (parsed.help) {
					printHelp(RUN_TESTS_HELP)
					return 0
				}
				await deps.runTestsWithSync({
					dryRun: parsed.dryRun,
					includeCounts: parsed.includeCounts,
					configOverridesJson: parsed.configOverridesJson,
					configOverridesFile: parsed.configOverridesFile,
				})
				return 0
			}

			case 'run-evals': {
				const parsed = parseRunWithOverridesArgs(command, rest)
				if (parsed.help) {
					printHelp(RUN_EVALS_HELP)
					return 0
				}
				await deps.runEvalsWithSync({
					dryRun: parsed.dryRun,
					includeCounts: parsed.includeCounts,
					configOverridesJson: parsed.configOverridesJson,
					configOverridesFile: parsed.configOverridesFile,
				})
				return 0
			}

			case 'stats': {
				const parsed = parseStatsArgs(rest)
				if (parsed.help) {
					printHelp(STATS_HELP)
					return 0
				}
				if (parsed.shouldList) {
					await deps.listStatsQueries()
					return 0
				}
				if (parsed.queryName !== undefined) {
					await deps.runStatsQueryByDescription(parsed.queryName, { dryRun: parsed.dryRun })
					return 0
				}
				if (parsed.queryJson !== undefined) {
					await deps.runStatsQueryJson(parsed.queryJson, { dryRun: parsed.dryRun })
					return 0
				}
				await deps.runStatsQueryFile(parsed.queryFile!, { dryRun: parsed.dryRun })
				return 0
			}

			default:
				throw new CliUsageError(`Unknown command: ${command}`)
		}
	} catch (error) {
		if (error instanceof CliUsageError) {
			console.error(error.message)
			return 2
		}

		console.error(error instanceof Error ? error.message : String(error))
		return 1
	}
}
