import { CliUsageError } from './errors.js';
const ROOT_HELP = `Usage: ai-tester [command] [options]

Commands:
  migrate               Run outstanding database migrations.
  sync                  Synchronize currencies, providers, structured objects, tools, prompts, and tests.
  run-tests             Sync first, then run missing tests.
  run-evals             Sync first, then run missing evaluations.
  stats --list          List runnable analysis query descriptions.
  stats --query <name>  Run one configured analysis query by exact description.

Options:
  -h, --help            Show help for the root command or a subcommand.`;
const MIGRATE_HELP = `Usage: ai-tester migrate

Run outstanding database migrations.

Options:
  -h, --help            Show this help message.`;
const SYNC_HELP = `Usage: ai-tester sync

Synchronize currencies, providers, structured objects, tools, prompts, and tests.

Options:
  -h, --help            Show this help message.`;
const RUN_TESTS_HELP = `Usage: ai-tester run-tests [--dry-run]

Synchronize currencies, providers, structured objects, tools, prompts, and tests,
then run missing tests without interactive prompts.

Options:
  --dry-run             Validate the command and print the actions without mutating state.
  -h, --help            Show this help message.`;
const RUN_EVALS_HELP = `Usage: ai-tester run-evals [--dry-run]

Synchronize currencies, providers, structured objects, tools, prompts, and tests,
then run missing evaluations without interactive prompts.

Options:
  --dry-run             Validate the command and print the actions without mutating state.
  -h, --help            Show this help message.`;
const STATS_HELP = `Usage:
  ai-tester stats --list
  ai-tester stats --query <name>

List configured analysis queries or run one by exact description.

Options:
  --list                Print runnable analysis query descriptions, one per line.
  --query <name>        Run the matching analysis query.
  -h, --help            Show this help message.`;
const isHelpFlag = (value) => value === '-h' || value === '--help';
const createDefaultDeps = () => ({
    runInteractive: async () => (await import('../bootstrap.js')).runDefaultApp(),
    syncAll: async () => (await import('./actions.js')).syncAll(),
    runTestsWithSync: async (options) => (await import('./actions.js')).runTestsWithSync(options),
    runEvalsWithSync: async (options) => (await import('./actions.js')).runEvalsWithSync(options),
    listStatsQueries: async () => (await import('./actions.js')).listStatsQueries(),
    runStatsQueryByDescription: async (description) => (await import('./actions.js')).runStatsQueryByDescription(description),
    runMigrations: async () => (await import('./actions.js')).runMigrations(),
});
const ensureNoExtraArgs = (command, args) => {
    if (args.length > 0) {
        throw new CliUsageError(`Unexpected argument for ${command}: ${args[0]}`);
    }
};
const parseDryRunArgs = (command, args) => {
    let dryRun = false;
    for (const arg of args) {
        if (arg === '--dry-run') {
            dryRun = true;
            continue;
        }
        if (isHelpFlag(arg))
            return { help: true, dryRun };
        throw new CliUsageError(`Unknown option for ${command}: ${arg}`);
    }
    return { help: false, dryRun };
};
const parseStatsArgs = (args) => {
    let shouldList = false;
    let queryName;
    let queryProvided = false;
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (isHelpFlag(arg))
            return { help: true, shouldList, queryName, queryProvided };
        if (arg === '--list') {
            if (shouldList || queryProvided) {
                throw new CliUsageError('stats requires exactly one of --list or --query <name>.');
            }
            shouldList = true;
            continue;
        }
        if (arg === '--query') {
            if (queryProvided || shouldList) {
                throw new CliUsageError('stats requires exactly one of --list or --query <name>.');
            }
            const next = args[index + 1];
            if (next === undefined) {
                throw new CliUsageError('Missing value for stats --query.');
            }
            queryProvided = true;
            queryName = next;
            index += 1;
            continue;
        }
        throw new CliUsageError(`Unknown option for stats: ${arg}`);
    }
    if (shouldList === queryProvided) {
        throw new CliUsageError('stats requires exactly one of --list or --query <name>.');
    }
    return { help: false, shouldList, queryName, queryProvided };
};
const printHelp = (text) => {
    console.log(text);
};
export const runCli = async (argv, deps = createDefaultDeps()) => {
    try {
        if (argv.length === 0) {
            await deps.runInteractive();
            return 0;
        }
        const [command, ...rest] = argv;
        if (isHelpFlag(command)) {
            printHelp(ROOT_HELP);
            return 0;
        }
        switch (command) {
            case 'migrate':
                if (rest.some(isHelpFlag)) {
                    printHelp(MIGRATE_HELP);
                    return 0;
                }
                ensureNoExtraArgs(command, rest);
                await deps.runMigrations();
                return 0;
            case 'sync':
                if (rest.some(isHelpFlag)) {
                    printHelp(SYNC_HELP);
                    return 0;
                }
                ensureNoExtraArgs(command, rest);
                await deps.syncAll();
                return 0;
            case 'run-tests': {
                const parsed = parseDryRunArgs(command, rest);
                if (parsed.help) {
                    printHelp(RUN_TESTS_HELP);
                    return 0;
                }
                await deps.runTestsWithSync({ dryRun: parsed.dryRun });
                return 0;
            }
            case 'run-evals': {
                const parsed = parseDryRunArgs(command, rest);
                if (parsed.help) {
                    printHelp(RUN_EVALS_HELP);
                    return 0;
                }
                await deps.runEvalsWithSync({ dryRun: parsed.dryRun });
                return 0;
            }
            case 'stats': {
                const parsed = parseStatsArgs(rest);
                if (parsed.help) {
                    printHelp(STATS_HELP);
                    return 0;
                }
                if (parsed.shouldList) {
                    await deps.listStatsQueries();
                    return 0;
                }
                await deps.runStatsQueryByDescription(parsed.queryName);
                return 0;
            }
            default:
                throw new CliUsageError(`Unknown command: ${command}`);
        }
    }
    catch (error) {
        if (error instanceof CliUsageError) {
            console.error(error.message);
            return 2;
        }
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
};
