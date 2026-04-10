import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { CliUsageError } from './errors.js';
const RUN_WITH_SYNC_CONFIRMATION_MESSAGE = 'This will first update the file-backed registry and sync the DB. Do you want to continue?';
const DRY_RUN_SYNC_ACTION = 'sync currencies, providers, structured objects, tools, prompts, and tests';
const alwaysYes = async () => true;
const validateRunConfig = async () => {
    const { resolveTestsConfig } = await import('../config/index.js');
    const { getFileBackedCurrencyRegistry, validateCurrencyRegistryReferences } = await import('../config/currency-registry.js');
    resolveTestsConfig();
    validateCurrencyRegistryReferences(getFileBackedCurrencyRegistry());
    await import('../database/db.js');
};
const runQuietly = async (action) => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => { };
    console.warn = () => { };
    try {
        return await action();
    }
    finally {
        console.log = originalLog;
        console.warn = originalWarn;
    }
};
export const syncAll = async () => {
    const [{ updateCurrenciesInDb }, { updateProvidersInDb }, { updateStructuredObjectsInDb }, { updateToolsInDb }, { updatePromptsInDb }, { updateTestsInDb },] = await Promise.all([
        import('../main/currencies.js'),
        import('../main/providers.js'),
        import('../main/structured-objects.js'),
        import('../main/tools.js'),
        import('../main/prompts.js'),
        import('../main/tests.js'),
    ]);
    await updateCurrenciesInDb();
    await updateProvidersInDb();
    await updateStructuredObjectsInDb();
    await updateToolsInDb();
    await updatePromptsInDb();
    await updateTestsInDb();
};
const logDryRun = (noun) => {
    console.log(`Dry run: would ${DRY_RUN_SYNC_ACTION}.`);
    console.log(`Dry run: would then run missing ${noun}.`);
};
export const runTestsWithSync = async ({ dryRun = false, confirmSync, confirmRun = alwaysYes, } = {}) => {
    if (dryRun) {
        await validateRunConfig();
        logDryRun('tests');
        return;
    }
    if (confirmSync && !(await confirmSync(RUN_WITH_SYNC_CONFIRMATION_MESSAGE)))
        return;
    console.log();
    await syncAll();
    await (await import('../main/sessions.js')).runAllTests({ confirmRun });
    console.log();
};
export const runEvalsWithSync = async ({ dryRun = false, confirmSync, confirmRun = alwaysYes, } = {}) => {
    if (dryRun) {
        await validateRunConfig();
        logDryRun('evaluations');
        return;
    }
    if (confirmSync && !(await confirmSync(RUN_WITH_SYNC_CONFIRMATION_MESSAGE)))
        return;
    console.log();
    await syncAll();
    await (await import('../main/evaluations.js')).runAllEvaluations({ confirmRun });
    console.log();
};
const getConfigResolvedAnalysisQueries = async () => runQuietly(async () => (await import('../config/index.js')).resolveTestsConfig().analysisQueries ?? []);
const getValidatedResolvedAnalysisQueries = async () => runQuietly(async () => {
    const { getFileBackedCurrencyRegistry, validateCurrencyRegistryReferences } = await import('../config/currency-registry.js');
    validateCurrencyRegistryReferences(getFileBackedCurrencyRegistry());
    return (await import('../config/index.js')).resolveTestsConfig().analysisQueries ?? [];
});
const getSyncedResolvedAnalysisQueries = async () => runQuietly(async () => {
    await (await import('../main/providers.js')).updateProvidersInDb();
    return (await import('../config/index.js')).resolveTestsConfig().analysisQueries ?? [];
});
const isRunnableQuery = (query) => (query.candidates === undefined || query.candidates.length > 0) &&
    (query.evaluators === undefined || query.evaluators.length > 0);
export const listStatsQueries = async () => {
    for (const query of (await getValidatedResolvedAnalysisQueries()).filter(isRunnableQuery)) {
        console.log(query.description);
    }
};
export const runStatsQueryByDescription = async (description) => {
    const configuredQuery = (await getConfigResolvedAnalysisQueries()).find(candidate => candidate.description === description);
    if (!configuredQuery) {
        throw new CliUsageError(`Analysis query not found: ${description}`);
    }
    const queries = await getSyncedResolvedAnalysisQueries();
    const query = queries.find(candidate => candidate.description === description) ?? configuredQuery;
    await (await import('../main/stats.js')).showStats(query);
};
export const runMigrations = async () => {
    dotenv.config({ path: '.env.local' });
    dotenv.config();
    const dbPath = process.env['AI_TESTER_SQLITE_DB_PATH'];
    if (!dbPath) {
        throw new Error('AI_TESTER_SQLITE_DB_PATH is not set');
    }
    process.env['AI_TESTER_SQLITE_DB_PATH'] = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
    const drizzleConfigPath = fileURLToPath(new URL('../database/drizzle.config.js', import.meta.url));
    const distRoot = fileURLToPath(new URL('../../', import.meta.url));
    execSync(`npx drizzle-kit migrate --config "${drizzleConfigPath}"`, {
        cwd: distRoot,
        stdio: 'inherit',
    });
};
