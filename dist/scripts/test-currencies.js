import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tester-currencies-'));
const dbPath = path.join(tempRoot, 'sqlite.db');
const providersDir = path.join(tempRoot, 'providers');
const modelsDir = path.join(tempRoot, 'models');
const currenciesDir = path.join(tempRoot, 'currencies');
const testsDir = path.join(tempRoot, 'tests');
const promptsDir = path.join(tempRoot, 'prompts');
const logsDir = path.join(tempRoot, 'logs');
const configPath = path.join(tempRoot, 'ai-tester.config.yaml');
const writeFile = (filePath, content) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
};
process.env['AI_TESTER_SQLITE_DB_PATH'] = dbPath;
process.env['AI_TESTER_LOGS_DIR'] = logsDir;
process.env['AI_TESTER_TESTS_DIR'] = testsDir;
process.env['AI_TESTER_PROMPTS_DIR'] = promptsDir;
process.env['AI_TESTER_PROVIDERS_DIR'] = providersDir;
process.env['AI_TESTER_MODELS_DIR'] = modelsDir;
process.env['AI_TESTER_CURRENCIES_DIR'] = currenciesDir;
process.env['AI_TESTER_CONFIG_PATH'] = configPath;
writeFile(configPath, `candidates: []
candidatesTemperature: 0.3
attempts: 1
requiredTags1: []
requiredTags2: []
prohibitedTags: []
evaluators: []
evaluatorsTemperature: 0.3
evaluationsPerEvaluator: 1
analysisQueries:
  - description: JPY stats
    currency: JPY
`);
writeFile(path.join(providersDir, 'openai.yaml'), `code: openai
name: OpenAI
type: openai
`);
writeFile(path.join(modelsDir, 'gpt-4o-mini.yaml'), `code: gpt-4o-mini
provider: openai
providerModelCode: gpt-4o-mini-2024-07-18
costs:
  - costPerCall: 0
    costPerPromptToken: 0.00000015
    costPerCompletionToken: 0.0000006
    costPerHour: 0
    currency: USD
    validFrom: 2025-01-19
`);
writeFile(path.join(currenciesDir, 'USD.yaml'), `code: USD
rates:
  - rateInUSD: 1
    validFrom: 2025-01-19
`);
writeFile(path.join(currenciesDir, 'JPY.yaml'), `code: JPY
rates:
  - rateInUSD: 0.0064
    validFrom: 2025-01-19
`);
execFileSync('node', [path.join(workspaceRoot, 'dist/scripts/migrations-run.js')], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit',
});
const { clearFileBackedCurrencyRegistryCache, getFileBackedCurrencyRegistry } = await import('../src/config/currency-registry.js');
const { updateCurrenciesInDb } = await import('../src/main/currencies.js');
const { updateProvidersInDb } = await import('../src/main/providers.js');
const { db } = await import('../src/database/db.js');
const { currencies, currencyRates, modelCosts } = await import('../src/database/schema/costs.js');
const { providers } = await import('../src/database/schema/providers.js');
const { models, modelVersions } = await import('../src/database/schema/models.js');
const { eq } = await import('drizzle-orm');
const expectThrows = async (label, fnc, pattern) => {
    try {
        await fnc();
        assert.fail(`Expected failure for ${label}`);
    }
    catch (error) {
        assert.match(String(error), pattern);
        console.log(`PASS: ${label}`);
    }
};
clearFileBackedCurrencyRegistryCache();
assert.equal(getFileBackedCurrencyRegistry().currencies.length, 2);
console.log('PASS: valid currency registry loads');
writeFile(path.join(currenciesDir, 'JPY.yaml'), `code: JPY
rates:
  - rateInUSD: 0.0064
    validFrom: 2025-01-19
  - rateInUSD: 0.0065
    validFrom: 2025-01-19
`);
clearFileBackedCurrencyRegistryCache();
await expectThrows('duplicate validFrom is rejected', () => getFileBackedCurrencyRegistry(), /Duplicate rate entry/);
writeFile(path.join(currenciesDir, 'JPY.yaml'), `code: JPY
rates:
  - rateInUSD: 0.0064
    validFrom: not-a-date
`);
clearFileBackedCurrencyRegistryCache();
await expectThrows('invalid validFrom is rejected', () => getFileBackedCurrencyRegistry(), /Invalid validFrom date/);
writeFile(path.join(currenciesDir, 'JPY.yaml'), `code: JPY
rates: []
`);
clearFileBackedCurrencyRegistryCache();
await expectThrows('empty rates are rejected', () => getFileBackedCurrencyRegistry(), /Array must contain at least 1 element/);
writeFile(path.join(currenciesDir, 'JPY.yaml'), `code: JPY
rates:
  - rateInUSD: 0.0064
    validFrom: 2025-01-19
`);
writeFile(path.join(currenciesDir, 'usd-duplicate.yaml'), `code: usd
rates:
  - rateInUSD: 1
    validFrom: 2025-01-20
`);
clearFileBackedCurrencyRegistryCache();
await expectThrows('duplicate currency codes are rejected', () => getFileBackedCurrencyRegistry(), /Duplicate currency code/);
fs.unlinkSync(path.join(currenciesDir, 'usd-duplicate.yaml'));
writeFile(path.join(currenciesDir, 'invalid-code.yaml'), `code: A1!
rates:
  - rateInUSD: 1
    validFrom: 2025-01-20
`);
clearFileBackedCurrencyRegistryCache();
await expectThrows('non-letter currency codes are rejected', () => getFileBackedCurrencyRegistry(), /Currency code must be a 3-letter ISO 4217 code/);
fs.unlinkSync(path.join(currenciesDir, 'invalid-code.yaml'));
clearFileBackedCurrencyRegistryCache();
await updateCurrenciesInDb();
await updateProvidersInDb();
const usdCurrency = await db.query.currencies.findFirst({
    where: eq(currencies.code, 'USD'),
});
assert.ok(usdCurrency);
console.log('PASS: USD currency found after sync');
const jpyCurrency = await db.query.currencies.findFirst({
    where: eq(currencies.code, 'JPY'),
});
assert.ok(jpyCurrency);
console.log('PASS: JPY currency found after sync');
const jpyRates = await db.query.currencyRates.findMany({
    where: eq(currencyRates.currencyId, jpyCurrency.id),
});
assert.equal(jpyRates.length, 1);
assert.equal(jpyRates[0]?.rateInUSD, 0.0064);
console.log('PASS: JPY rate inserted');
writeFile(path.join(currenciesDir, 'AUD.yaml'), `code: AUD
rates:
  - rateInUSD: 0.64
    validFrom: 2025-01-19
`);
clearFileBackedCurrencyRegistryCache();
await updateCurrenciesInDb();
const audCurrency = await db.query.currencies.findFirst({
    where: eq(currencies.code, 'AUD'),
});
assert.ok(audCurrency);
const audRates = await db.query.currencyRates.findMany({
    where: eq(currencyRates.currencyId, audCurrency.id),
});
assert.equal(audRates.length, 1);
console.log('PASS: newly added currencies sync correctly');
writeFile(path.join(currenciesDir, 'JPY.yaml'), `code: JPY
rates:
  - rateInUSD: 0.0063
    validFrom: 2025-01-19
  - rateInUSD: 0.0061
    validFrom: 2025-02-01
`);
clearFileBackedCurrencyRegistryCache();
await updateCurrenciesInDb();
const updatedJpyRates = await db.query.currencyRates.findMany({
    where: eq(currencyRates.currencyId, jpyCurrency.id),
});
assert.equal(updatedJpyRates.length, 2);
assert.equal(updatedJpyRates.find(rate => rate.validFrom.toISOString().startsWith('2025-01-19'))?.rateInUSD, 0.0063);
console.log('PASS: currency rates update in place and add history');
writeFile(path.join(currenciesDir, 'JPY.yaml'), `code: JPY
rates:
  - rateInUSD: 0.0062
    validFrom: 2025-02-01
`);
clearFileBackedCurrencyRegistryCache();
await updateCurrenciesInDb();
const prunedJpyRates = await db.query.currencyRates.findMany({
    where: eq(currencyRates.currencyId, jpyCurrency.id),
});
assert.equal(prunedJpyRates.length, 1);
assert.equal(prunedJpyRates[0]?.rateInUSD, 0.0062);
console.log('PASS: stale currency rate rows are deleted');
const usdStillExists = await db.query.currencies.findFirst({
    where: eq(currencies.code, 'USD'),
});
assert.ok(usdStillExists);
console.log('PASS: currency rows are preserved');
fs.unlinkSync(path.join(currenciesDir, 'AUD.yaml'));
clearFileBackedCurrencyRegistryCache();
await updateCurrenciesInDb();
const removedAudRates = await db.query.currencyRates.findMany({
    where: eq(currencyRates.currencyId, audCurrency.id),
});
assert.equal(removedAudRates.length, 0);
console.log('PASS: stale rates are removed when a currency file is deleted');
const provider = await db.query.providers.findFirst({
    where: eq(providers.code, 'openai'),
});
assert.ok(provider);
console.log('PASS: provider sync still runs with currency registry enabled');
const model = await db.query.models.findFirst({
    where: eq(models.code, 'gpt-4o-mini'),
});
assert.ok(model);
const modelVersion = await db.query.modelVersions.findFirst({
    where: eq(modelVersions.modelId, model.id),
});
assert.ok(modelVersion);
const costs = await db.query.modelCosts.findMany({
    where: eq(modelCosts.modelVersionId, modelVersion.id),
});
assert.equal(costs.length, 1);
console.log('PASS: model costs still sync');
fs.unlinkSync(path.join(currenciesDir, 'USD.yaml'));
clearFileBackedCurrencyRegistryCache();
await expectThrows('missing model cost currency is rejected', () => updateCurrenciesInDb(), /Currency registry is missing YAML files.*USD/);
writeFile(path.join(currenciesDir, 'USD.yaml'), `code: USD
rates:
  - rateInUSD: 1
    validFrom: 2025-01-19
`);
const eurConfigPath = path.join(tempRoot, 'ai-tester-eur.config.yaml');
writeFile(eurConfigPath, `candidates: []
candidatesTemperature: 0.3
attempts: 1
requiredTags1: []
requiredTags2: []
prohibitedTags: []
evaluators: []
evaluatorsTemperature: 0.3
evaluationsPerEvaluator: 1
analysisQueries:
  - description: EUR stats
    currency: EUR
`);
await expectThrows('missing analysis query currency is rejected', () => Promise.resolve(execFileSync('node', [
    '--input-type=module',
    '-e',
    `import { updateCurrenciesInDb } from ${JSON.stringify(path.join(workspaceRoot, 'dist/src/main/currencies.js'))}; await updateCurrenciesInDb();`,
], {
    cwd: workspaceRoot,
    env: {
        ...process.env,
        AI_TESTER_CONFIG_PATH: eurConfigPath,
    },
    stdio: 'pipe',
})), /Currency registry is missing YAML files.*EUR/);
execFileSync('node', [
    '--input-type=module',
    '-e',
    `import { updateProvidersInDb } from ${JSON.stringify(path.join(workspaceRoot, 'dist/src/main/providers.js'))}; await updateProvidersInDb();`,
], {
    cwd: workspaceRoot,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'AI_TESTER_CURRENCIES_DIR' && key !== 'AI_TESTER_CONFIG_PATH')),
    stdio: 'pipe',
});
console.log('PASS: provider sync does not require the main config when currencies are unset');
execFileSync('node', [
    '--input-type=module',
    '-e',
    `import { updateCurrenciesInDb } from ${JSON.stringify(path.join(workspaceRoot, 'dist/src/main/currencies.js'))}; await updateCurrenciesInDb();`,
], {
    cwd: workspaceRoot,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'AI_TESTER_CURRENCIES_DIR')),
    stdio: 'pipe',
});
console.log('PASS: currency sync is a no-op when AI_TESTER_CURRENCIES_DIR is unset');
console.log('All currency checks passed!');
