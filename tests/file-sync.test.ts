import assert from 'node:assert/strict'
import test from 'node:test'

import { and, eq } from 'drizzle-orm'

import { schema } from '../src/database/schema.js'
import { createSyncTestEnv } from './helpers/test-harness.js'

const expectSyncSuccess = (result: { status: number | null; stdout: string; stderr: string }) => {
	assert.strictEqual(result.status, 0, `Expected sync success.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`)
}

const expectSyncFailure = (
	result: { status: number | null; stdout: string; stderr: string },
	pattern: RegExp
) => {
	assert.notStrictEqual(result.status, 0, `Expected sync failure.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`)
	assert.match(`${result.stdout}\n${result.stderr}`, pattern)
}

test('provider and currency sync bootstraps empty DB and creates a new active model version on runtime option changes', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'ai-tester.config.yaml',
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
			'analysisQueries:',
			'  - description: Default query',
			'    currency: JPY',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)
	await env.write(
		'data/currencies/JPY.yaml',
		['code: JPY', 'rates:', '  - rateInUSD: 0.0067', '    validFrom: 2025-01-01'].join('\n')
	)
	await env.write(
		'data/providers/openai.yaml',
		['code: openai', 'name: OpenAI', 'type: openai'].join('\n')
	)
	await env.write(
		'data/models/gpt-4o-mini.yaml',
		[
			'code: gpt-4o-mini',
			'provider: openai',
			'providerModelCode: gpt-4o-mini-2024-07-18',
			'providerOptions:',
			'  seed: 1',
			'costs:',
			'  - costPerCall: 0',
			'    costPerPromptToken: 0.1',
			'    costPerCompletionToken: 0.2',
			'    costPerHour: 0',
			'    currency: USD',
			'    validFrom: 2025-01-01',
		].join('\n')
	)

	expectSyncSuccess(env.runSync(['currencies', 'providers']))

	const providersAfterFirstSync = await env.db.select().from(schema.providers)
	const modelsAfterFirstSync = await env.db.select().from(schema.models)
	const modelVersionsAfterFirstSync = await env.db.select().from(schema.modelVersions)
	const currenciesAfterFirstSync = await env.db.select().from(schema.currencies)
	const currencyRatesAfterFirstSync = await env.db.select().from(schema.currencyRates)
	const modelCostsAfterFirstSync = await env.db.select().from(schema.modelCosts)

	assert.strictEqual(providersAfterFirstSync.length, 1)
	assert.strictEqual(providersAfterFirstSync[0]?.active, true)
	assert.strictEqual(modelsAfterFirstSync.length, 1)
	assert.strictEqual(modelsAfterFirstSync[0]?.active, true)
	assert.strictEqual(modelVersionsAfterFirstSync.length, 1)
	assert.strictEqual(modelVersionsAfterFirstSync[0]?.active, true)
	assert.strictEqual(currenciesAfterFirstSync.length, 2)
	assert.strictEqual(currencyRatesAfterFirstSync.length, 2)
	assert.strictEqual(modelCostsAfterFirstSync.length, 1)

	await env.write(
		'data/models/gpt-4o-mini.yaml',
		[
			'code: gpt-4o-mini',
			'provider: openai',
			'providerModelCode: gpt-4o-mini-2024-07-18',
			'providerOptions:',
			'  seed: 2',
			'costs:',
			'  - costPerCall: 0',
			'    costPerPromptToken: 0.3',
			'    costPerCompletionToken: 0.4',
			'    costPerHour: 0',
			'    currency: JPY',
			'    validFrom: 2025-01-01',
		].join('\n')
	)

	expectSyncSuccess(env.runSync(['currencies', 'providers']))

	const modelVersionsAfterSecondSync = await env.db.select().from(schema.modelVersions)
	assert.strictEqual(modelVersionsAfterSecondSync.length, 2)
	assert.strictEqual(modelVersionsAfterSecondSync.filter(version => version.active).length, 1)
	assert.match(
		modelVersionsAfterSecondSync.find(version => version.active)?.runtimeOptionsJson ?? '',
		/"seed":2/
	)
	const activeModelVersion = modelVersionsAfterSecondSync.find(version => version.active)
	assert.ok(activeModelVersion)

	const activeCosts = await env.db
		.select({
			currencyCode: schema.currencies.code,
			costPerPromptToken: schema.modelCosts.costPerPromptToken,
		})
		.from(schema.modelCosts)
		.innerJoin(schema.currencies, eq(schema.modelCosts.currencyId, schema.currencies.id))
		.where(eq(schema.modelCosts.modelVersionId, activeModelVersion!.id))
	assert.deepStrictEqual(activeCosts, [{ currencyCode: 'JPY', costPerPromptToken: 0.3 }])
})

test('provider sync allows multiple active model definitions for the same provider model when unique properties differ', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write('data/providers/openai.yaml', ['code: openai', 'name: OpenAI', 'type: openai'].join('\n'))
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)
	await env.write(
		'data/models/gpt-4o-mini-low.yaml',
		[
			'id: openai/gpt-4o-mini/reasoning-low',
			'code: gpt-4o-mini',
			'provider: openai',
			'providerModelCode: gpt-4o-mini',
			'uniqueProperties:',
			'  - thinking.effort',
			'thinking:',
			'  effort: low',
			'costs:',
			'  - costPerCall: 0',
			'    costPerPromptToken: 0.1',
			'    costPerCompletionToken: 0.2',
			'    costPerHour: 0',
			'    currency: USD',
			'    validFrom: 2025-01-01',
		].join('\n')
	)
	await env.write(
		'data/models/gpt-4o-mini-high.yaml',
		[
			'id: openai/gpt-4o-mini/reasoning-high',
			'code: gpt-4o-mini',
			'provider: openai',
			'providerModelCode: gpt-4o-mini',
			'uniqueProperties:',
			'  - thinking.effort',
			'thinking:',
			'  effort: high',
			'costs:',
			'  - costPerCall: 0',
			'    costPerPromptToken: 0.1',
			'    costPerCompletionToken: 0.2',
			'    costPerHour: 0',
			'    currency: USD',
			'    validFrom: 2025-01-01',
		].join('\n')
	)

	expectSyncSuccess(env.runSync(['currencies', 'providers']))

	const models = await env.db.select().from(schema.models)
	const modelVersions = await env.db.select().from(schema.modelVersions)
	assert.strictEqual(models.length, 1)
	assert.strictEqual(modelVersions.length, 2)
	assert.strictEqual(modelVersions.filter(version => version.active).length, 2)
	assert.ok(modelVersions.some(version => version.runtimeOptionsJson.includes('"effort":"low"')))
	assert.ok(modelVersions.some(version => version.runtimeOptionsJson.includes('"effort":"high"')))
})

test('provider sync does not create a new model version when only a YAML id is added', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const modelWithoutId = [
		'code: gpt-4o-mini',
		'provider: openai',
		'providerModelCode: gpt-4o-mini',
		'providerOptions:',
		'  seed: 1',
		'costs:',
		'  - costPerCall: 0',
		'    costPerPromptToken: 0.1',
		'    costPerCompletionToken: 0.2',
		'    costPerHour: 0',
		'    currency: USD',
		'    validFrom: 2025-01-01',
	].join('\n')

	await env.write('data/providers/openai.yaml', ['code: openai', 'name: OpenAI', 'type: openai'].join('\n'))
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)
	await env.write('data/models/gpt-4o-mini.yaml', modelWithoutId)

	expectSyncSuccess(env.runSync(['currencies', 'providers']))

	const [firstVersion] = await env.db.select().from(schema.modelVersions)
	assert.ok(firstVersion)

	await env.write('data/models/gpt-4o-mini.yaml', ['id: openai/gpt-4o-mini/default', modelWithoutId].join('\n'))

	expectSyncSuccess(env.runSync(['currencies', 'providers']))

	const modelVersions = await env.db.select().from(schema.modelVersions)
	assert.strictEqual(modelVersions.length, 1)
	assert.strictEqual(modelVersions[0]?.id, firstVersion!.id)
	assert.strictEqual(modelVersions[0]?.active, true)
})

test('provider sync keeps role-specific model versions tied to effective runtime options', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const writeModel = async (evaluatorLane: string) => {
		await env.write(
			'data/models/gpt-4o-mini.yaml',
			[
				'id: openai/gpt-4o-mini/role-overrides',
				'code: gpt-4o-mini',
				'provider: openai',
				'providerModelCode: gpt-4o-mini',
				'candidateOverrides:',
				'  providerOptions:',
				'    user: candidate',
				'evaluatorOverrides:',
				'  providerOptions:',
				`    lane: ${evaluatorLane}`,
				'costs:',
				'  - costPerCall: 0',
				'    costPerPromptToken: 0.1',
				'    costPerCompletionToken: 0.2',
				'    costPerHour: 0',
				'    currency: USD',
				'    validFrom: 2025-01-01',
			].join('\n')
		)
	}

	await env.write('data/providers/openai.yaml', ['code: openai', 'name: OpenAI', 'type: openai'].join('\n'))
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)
	await writeModel('eval-a')

	expectSyncSuccess(env.runSync(['currencies', 'providers']))

	const modelVersionsAfterFirstSync = await env.db.select().from(schema.modelVersions)
	assert.strictEqual(modelVersionsAfterFirstSync.length, 2)
	assert.strictEqual(modelVersionsAfterFirstSync.filter(version => version.active).length, 2)
	const candidateVersion = modelVersionsAfterFirstSync.find(version => version.runtimeOptionsJson.includes('"user":"candidate"'))
	const firstEvaluatorVersion = modelVersionsAfterFirstSync.find(version => version.runtimeOptionsJson.includes('"lane":"eval-a"'))
	assert.ok(candidateVersion)
	assert.ok(firstEvaluatorVersion)

	await writeModel('eval-b')
	expectSyncSuccess(env.runSync(['providers']))

	const modelVersionsAfterSecondSync = await env.db.select().from(schema.modelVersions)
	assert.strictEqual(modelVersionsAfterSecondSync.length, 3)
	const activeVersions = modelVersionsAfterSecondSync.filter(version => version.active)
	assert.strictEqual(activeVersions.length, 2)
	assert.strictEqual(activeVersions.find(version => version.runtimeOptionsJson.includes('"user":"candidate"'))?.id, candidateVersion.id)
	assert.strictEqual(modelVersionsAfterSecondSync.find(version => version.id === firstEvaluatorVersion.id)?.active, false)
	assert.ok(activeVersions.some(version => version.runtimeOptionsJson.includes('"lane":"eval-b"')))
})

test('provider sync deactivates registry rows when files are removed', async t => {
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
			'providerModelCode: gpt-4o-mini-2024-07-18',
			'costs:',
			'  - costPerCall: 0',
			'    costPerPromptToken: 0.1',
			'    costPerCompletionToken: 0.2',
			'    costPerHour: 0',
			'    currency: USD',
			'    validFrom: 2025-01-01',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	expectSyncSuccess(env.runSync(['currencies', 'providers']))

	await env.remove('data/models/gpt-4o-mini.yaml')
	await env.remove('data/providers/openai.yaml')

	expectSyncSuccess(env.runSync(['providers']))

	const providersAfterRemoval = await env.db.select().from(schema.providers)
	const modelsAfterRemoval = await env.db.select().from(schema.models)
	const modelVersionsAfterRemoval = await env.db.select().from(schema.modelVersions)
	assert.strictEqual(providersAfterRemoval[0]?.active, false)
	assert.strictEqual(modelsAfterRemoval[0]?.active, false)
	assert.strictEqual(modelVersionsAfterRemoval[0]?.active, false)
})

test('provider sync rejects historical cost windows that start after existing runs', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write('data/providers/openai.yaml', ['code: openai', 'name: OpenAI', 'type: openai'].join('\n'))
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)
	await env.write(
		'data/models/gpt-4o-mini.yaml',
		[
			'code: gpt-4o-mini',
			'provider: openai',
			'providerModelCode: gpt-4o-mini-2024-07-18',
			'costs:',
			'  - costPerCall: 0',
			'    costPerPromptToken: 0.1',
			'    costPerCompletionToken: 0.2',
			'    costPerHour: 0',
			'    currency: USD',
			'    validFrom: 2025-01-01',
		].join('\n')
	)

	expectSyncSuccess(env.runSync(['currencies', 'providers']))

	const modelVersion = await env.db.query.modelVersions.findFirst()
	assert.ok(modelVersion)
	await env.db.insert(schema.testVersions).values({
		hash: 'historic-test',
		content: '# 👤\n\nHistoric run',
		active: true,
	})
	await env.db.insert(schema.prompts).values({ code: 'historic-prompt' })
	await env.db.insert(schema.promptVersions).values({
		promptId: 1,
		hash: 'historic-prompt-version',
		content: 'historic system prompt',
		active: true,
	})
	await env.db.insert(schema.sessions).values({
		testVersionId: 1,
		candidateSysPromptVersionId: 1,
		modelVersionId: modelVersion!.id,
		temperature: 0.3,
		answer: 'historic answer',
		completionTokens: 1,
		promptTokens: 1,
		timeTaken: 1,
		createdAt: new Date('2025-01-15T00:00:00Z'),
	})

	await env.write(
		'data/models/gpt-4o-mini.yaml',
		[
			'code: gpt-4o-mini',
			'provider: openai',
			'providerModelCode: gpt-4o-mini-2024-07-18',
			'costs:',
			'  - costPerCall: 0',
			'    costPerPromptToken: 0.1',
			'    costPerCompletionToken: 0.2',
			'    costPerHour: 0',
			'    currency: USD',
			'    validFrom: 2025-02-01',
		].join('\n')
	)

	expectSyncFailure(env.runSync(['providers']), /cost history starting at 2025-02-01/)
})

test('currency sync rejects missing referenced currencies from config or model costs', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'ai-tester.config.yaml',
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
			'analysisQueries:',
			'  - description: Missing currency',
			'    currency: JPY',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	expectSyncFailure(env.runSync(['currencies']), /Currency registry is missing YAML files.*JPY/)
})

test('currency sync updates and cleans up existing rate rows as YAML changes', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/currencies/USD.yaml',
		[
			'code: USD',
			'rates:',
			'  - rateInUSD: 1',
			'    validFrom: 2025-01-01',
			'  - rateInUSD: 1.1',
			'    validFrom: 2025-02-01',
		].join('\n')
	)
	await env.write(
		'data/currencies/JPY.yaml',
		[
			'code: JPY',
			'rates:',
			'  - rateInUSD: 0.0067',
			'    validFrom: 2025-01-01',
		].join('\n')
	)

	expectSyncSuccess(env.runSync(['currencies']))

	await env.write(
		'data/currencies/USD.yaml',
		[
			'code: USD',
			'rates:',
			'  - rateInUSD: 1.2',
			'    validFrom: 2025-02-01',
		].join('\n')
	)
	await env.remove('data/currencies/JPY.yaml')

	expectSyncSuccess(env.runSync(['currencies']))

	const currenciesAfterResync = await env.db.select().from(schema.currencies)
	assert.strictEqual(currenciesAfterResync.length, 2)
	const usd = currenciesAfterResync.find(currency => currency.code === 'USD')
	const jpy = currenciesAfterResync.find(currency => currency.code === 'JPY')
	assert.ok(usd)
	assert.ok(jpy)

	const usdRates = await env.db
		.select()
		.from(schema.currencyRates)
		.where(eq(schema.currencyRates.currencyId, usd!.id))
	const jpyRates = await env.db
		.select()
		.from(schema.currencyRates)
		.where(eq(schema.currencyRates.currencyId, jpy!.id))

	assert.strictEqual(usdRates.length, 1)
	assert.strictEqual(usdRates[0]?.rateInUSD, 1.2)
	assert.strictEqual(jpyRates.length, 0)
})

test('provider sync rejects active model variants without declared unique properties', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write('data/providers/openai.yaml', ['code: openai', 'name: OpenAI', 'type: openai'].join('\n'))
	await env.write(
		'data/models/variant-a.yaml',
		[
			'id: openai/gpt-4o-mini-2024-07-18/a',
			'code: gpt-4o-mini-a',
			'provider: openai',
			'providerModelCode: gpt-4o-mini-2024-07-18',
			'extraIdentifier: a',
			'costs:',
			'  - costPerCall: 0',
			'    costPerPromptToken: 0.1',
			'    costPerCompletionToken: 0.2',
			'    costPerHour: 0',
			'    currency: USD',
			'    validFrom: 2025-01-01',
		].join('\n')
	)
	await env.write(
		'data/models/variant-b.yaml',
		[
			'id: openai/gpt-4o-mini-2024-07-18/b',
			'code: gpt-4o-mini-b',
			'provider: openai',
			'providerModelCode: gpt-4o-mini-2024-07-18',
			'extraIdentifier: b',
			'costs:',
			'  - costPerCall: 0',
			'    costPerPromptToken: 0.1',
			'    costPerCompletionToken: 0.2',
			'    costPerHour: 0',
			'    currency: USD',
			'    validFrom: 2025-01-01',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	expectSyncFailure(env.runSync(['currencies', 'providers']), /must declare uniqueProperties/)
})

test('prompt sync creates versions from replacements and updates active tags on resync', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/prompts/helpful-en.md',
		[
			'---',
			'id: helpful-en',
			'tags:',
			'  - lang_en',
			'replacements:',
			'  tone:',
			'    - Kind',
			'    - Sharp',
			'---',
			'You are `{{tone}}`.',
		].join('\n')
	)

	expectSyncSuccess(env.runSync(['prompts']))

	const prompt = await env.db.query.prompts.findFirst({
		where: (prompts, { eq }) => eq(prompts.code, 'helpful-en'),
		with: { versions: true, tags: true },
	})
	assert.ok(prompt)
	assert.strictEqual(prompt!.versions.length, 2)
	assert.strictEqual(prompt!.versions.filter(version => version.active).length, 2)
	assert.strictEqual(prompt!.tags.length, 1)

	await env.write(
		'data/prompts/helpful-en.md',
		[
			'---',
			'id: helpful-en',
			'tags:',
			'  - lang_fr',
			'---',
			'Vous etes utile.',
		].join('\n')
	)

	expectSyncSuccess(env.runSync(['prompts']))

	const promptAfterResync = await env.db.query.prompts.findFirst({
		where: (prompts, { eq }) => eq(prompts.code, 'helpful-en'),
		with: { versions: true, tags: true },
	})
	assert.ok(promptAfterResync)
	assert.strictEqual(promptAfterResync!.versions.length, 3)
	assert.strictEqual(promptAfterResync!.versions.filter(version => version.active).length, 1)
	assert.deepStrictEqual(promptAfterResync!.tags.map(tag => tag.tagId).length, 1)
	const langFrTag = await env.db.query.tags.findFirst({
		where: (tags, { eq }) => eq(tags.name, 'lang_fr'),
	})
	assert.ok(langFrTag)
	assert.strictEqual(promptAfterResync!.tags[0]?.tagId, langFrTag!.id)
})

test('prompt sync deactivates removed files and reactivates restored versions', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const promptContent = [
		'---',
		'id: restore-me',
		'tags:',
		'  - lang_en',
		'---',
		'You are back.',
	].join('\n')

	await env.write('data/prompts/restore-me.md', promptContent)
	expectSyncSuccess(env.runSync(['prompts']))

	let versions = await env.db.select().from(schema.promptVersions)
	assert.strictEqual(versions.length, 1)
	assert.strictEqual(versions[0]?.active, true)

	await env.remove('data/prompts/restore-me.md')
	expectSyncSuccess(env.runSync(['prompts']))

	versions = await env.db.select().from(schema.promptVersions)
	assert.strictEqual(versions[0]?.active, false)

	await env.write('data/prompts/restore-me.md', promptContent)
	expectSyncSuccess(env.runSync(['prompts']))

	versions = await env.db.select().from(schema.promptVersions)
	assert.strictEqual(versions.length, 1)
	assert.strictEqual(versions[0]?.active, true)
})

test('prompt sync rejects invalid evaluator prompt structure', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/prompts/evaluator.md',
		[
			'---',
			'id: _evaluator_default',
			'tags:',
			'  - _evaluator',
			'---',
			'# 👤',
			'',
			'This is invalid for an evaluator prompt.',
		].join('\n')
	)

	expectSyncFailure(env.runSync(['prompts']), /must have sections system, and user/)
})

test('prompt sync rejects unresolved non-runtime placeholders after replacement expansion', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/prompts/helpful-en.md',
		[
			'---',
			'id: helpful-en',
			'---',
			'You are `{{tone}}`.',
			'Runtime placeholders like `{{_futureRuntime}}` are allowed.',
		].join('\n')
	)

	expectSyncFailure(env.runSync(['prompts']), /Unresolved placeholders in prompt helpful-en: \{\{tone\}\}/)
})

test('tool and structured-object sync version and deactivate rows as files change', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/tool-definitions/city-weather.yaml',
		[
			'id: city-weather',
			'name: cityWeather',
			'description: Lookup weather',
			'parameters:',
			'  type: object',
			'  properties:',
			'    cityName:',
			'      type: string',
			'  required: [cityName]',
			'  additionalProperties: false',
		].join('\n')
	)
	await env.write(
		'data/structured-schemas/invoice.yaml',
		[
			'id: invoice',
			'type: object',
			'properties:',
			'  invoiceId:',
			'    type: string',
			'required: [invoiceId]',
			'additionalProperties: false',
		].join('\n')
	)

	expectSyncSuccess(env.runSync(['tools', 'structuredObjects']))
	assert.strictEqual((await env.db.select().from(schema.toolVersions)).length, 1)
	assert.strictEqual((await env.db.select().from(schema.structuredObjectVersions)).length, 1)

	await env.write(
		'data/tool-definitions/city-weather.yaml',
		[
			'id: city-weather',
			'name: cityWeather',
			'description: Lookup weather and units',
			'parameters:',
			'  type: object',
			'  properties:',
			'    cityName:',
			'      type: string',
			'    units:',
			'      type: string',
			'  required: [cityName]',
			'  additionalProperties: false',
		].join('\n')
	)
	await env.write(
		'data/structured-schemas/invoice.yaml',
		[
			'id: invoice',
			'type: object',
			'properties:',
			'  invoiceId:',
			'    type: string',
			'  total:',
			'    type: number',
			'required: [invoiceId]',
			'additionalProperties: false',
		].join('\n')
	)

	expectSyncSuccess(env.runSync(['tools', 'structuredObjects']))
	assert.strictEqual((await env.db.select().from(schema.toolVersions)).length, 2)
	assert.strictEqual((await env.db.select().from(schema.structuredObjectVersions)).length, 2)
	const activeToolVersion = (await env.db.select().from(schema.toolVersions)).find(version => version.active)
	const activeStructuredObjectVersion = (await env.db.select().from(schema.structuredObjectVersions)).find(
		version => version.active
	)
	assert.ok(activeToolVersion)
	assert.ok(activeStructuredObjectVersion)
	assert.match(activeToolVersion!.schema, /units/)
	assert.deepStrictEqual(activeStructuredObjectVersion!.schema, {
		type: 'object',
		properties: {
			invoiceId: { type: 'string' },
			total: { type: 'number' },
		},
		required: ['invoiceId'],
		additionalProperties: false,
	})

	await env.remove('data/tool-definitions/city-weather.yaml')
	await env.remove('data/structured-schemas/invoice.yaml')

	expectSyncSuccess(env.runSync(['tools', 'structuredObjects']))
	assert.strictEqual((await env.db.select().from(schema.toolVersions)).filter(version => version.active).length, 0)
	assert.strictEqual(
		(await env.db.select().from(schema.structuredObjectVersions)).filter(version => version.active).length,
		0
	)
})

test('test sync versions content based on file references and linked tool metadata', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/prompts/helpful-en.md',
		[
			'---',
			'id: helpful-en',
			'tags:',
			'  - lang_en',
			'---',
			'You are a helpful assistant.',
		].join('\n')
	)
	await env.write(
		'data/tool-definitions/city-weather.yaml',
		[
			'id: city-weather',
			'name: cityWeather',
			'description: Lookup weather',
			'parameters:',
			'  type: object',
			'  properties:',
			'    cityName:',
			'      type: string',
			'  required: [cityName]',
			'  additionalProperties: false',
		].join('\n')
	)
	await env.write('data/tests/fixtures/brief.txt', 'First version of the file')

	expectSyncSuccess(env.runSync(['prompts', 'tools']))

	await env.write(
		'data/tests/weather.md',
		[
			'---',
			'tags:',
			'  - tool_use',
			'  - lang_en',
			'systemPrompts:',
			'  - helpful-en',
			'availableTools:',
			'  - city-weather',
			'---',
			'# 👤',
			'',
			'Use this context: `{{_file:fixtures/brief.txt}}`',
			'What is the weather in Tokyo?',
			'',
			'---',
			'The answer should call the weather tool.',
		].join('\n')
	)

	expectSyncSuccess(env.runSync(['tests']))

	const firstTestVersions = await env.db.select().from(schema.testVersions)
	const firstEvalVersions = await env.db.select().from(schema.testEvaluationInstructionsVersions)
	const firstToolRels = await env.db.select().from(schema.testToToolVersionRels)
	const firstPromptRels = await env.db.select().from(schema.testToSystemPromptVersionRels)
	assert.strictEqual(firstTestVersions.length, 1)
	assert.strictEqual(firstEvalVersions.length, 1)
	assert.strictEqual(firstToolRels.length, 1)
	assert.strictEqual(firstPromptRels.length, 1)
	assert.strictEqual(firstTestVersions[0]?.active, true)

	await env.write('data/tests/fixtures/brief.txt', 'Second version of the file')

	expectSyncSuccess(env.runSync(['tests']))

	const secondTestVersions = await env.db.select().from(schema.testVersions)
	assert.strictEqual(secondTestVersions.length, 2)
	assert.strictEqual(secondTestVersions.filter(version => version.active).length, 1)
})

test('test sync rejects unresolved non-runtime placeholders after replacement expansion', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/tests/broken.md',
		[
			'---',
			'systemPrompts:',
			'  - helpful-en',
			'---',
			'# 👤',
			'',
			'Question: `{{question}}`',
			'Runtime placeholders like `{{_file:fixtures/brief.txt}}` are allowed.',
			'',
			'---',
			'The answer should mention `{{answer}}`.',
		].join('\n')
	)

	expectSyncFailure(
		env.runSync(['tests']),
		/Unresolved placeholders in test .*broken\.md: \{\{answer\}\}, \{\{question\}\}/
	)
})

test('test sync deactivates removed files and reactivates restored versions including evaluation prompts', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/prompts/helpful-en.md',
		[
			'---',
			'id: helpful-en',
			'tags:',
			'  - lang_en',
			'---',
			'You are a helpful assistant.',
		].join('\n')
	)
	expectSyncSuccess(env.runSync(['prompts']))

	const testContent = [
		'---',
		'tags:',
		'  - lang_en',
		'systemPrompts:',
		'  - helpful-en',
		'---',
		'# 👤',
		'',
		'What is the answer?',
		'',
		'---',
		'It should say 42.',
	].join('\n')

	await env.write('data/tests/reloadable.md', testContent)
	expectSyncSuccess(env.runSync(['tests']))

	let testVersions = await env.db.select().from(schema.testVersions)
	let evalVersions = await env.db.select().from(schema.testEvaluationInstructionsVersions)
	assert.strictEqual(testVersions.length, 1)
	assert.strictEqual(evalVersions.length, 1)
	assert.strictEqual(testVersions[0]?.active, true)
	assert.strictEqual(evalVersions[0]?.active, true)

	await env.remove('data/tests/reloadable.md')
	expectSyncSuccess(env.runSync(['tests']))

	testVersions = await env.db.select().from(schema.testVersions)
	evalVersions = await env.db.select().from(schema.testEvaluationInstructionsVersions)
	assert.strictEqual(testVersions[0]?.active, false)
	assert.strictEqual(evalVersions[0]?.active, false)

	await env.write('data/tests/reloadable.md', testContent)
	expectSyncSuccess(env.runSync(['tests']))

	testVersions = await env.db.select().from(schema.testVersions)
	evalVersions = await env.db.select().from(schema.testEvaluationInstructionsVersions)
	assert.strictEqual(testVersions.length, 1)
	assert.strictEqual(evalVersions.length, 1)
	assert.strictEqual(testVersions[0]?.active, true)
	assert.strictEqual(evalVersions[0]?.active, true)
})

test('test sync rejects incompatible structured schema and available tool configuration', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/prompts/helpful-en.md',
		[
			'---',
			'id: helpful-en',
			'---',
			'You are helpful.',
		].join('\n')
	)
	await env.write(
		'data/tool-definitions/city-weather.yaml',
		[
			'id: city-weather',
			'name: cityWeather',
			'description: Lookup weather',
			'parameters:',
			'  type: object',
			'  properties:',
			'    cityName:',
			'      type: string',
			'  required: [cityName]',
			'  additionalProperties: false',
		].join('\n')
	)
	await env.write(
		'data/structured-schemas/invoice.yaml',
		[
			'id: invoice',
			'type: object',
			'properties:',
			'  invoiceId:',
			'    type: string',
			'required: [invoiceId]',
			'additionalProperties: false',
		].join('\n')
	)

	expectSyncSuccess(env.runSync(['prompts', 'tools', 'structuredObjects']))

	await env.write(
		'data/tests/invalid.md',
		[
			'---',
			'systemPrompts:',
			'  - helpful-en',
			'structuredResponseSchema: invoice',
			'availableTools:',
			'  - city-weather',
			'---',
			'# 👤',
			'',
			'This configuration is invalid.',
			'',
			'---',
			'Invalid.',
		].join('\n')
	)

	expectSyncFailure(env.runSync(['tests']), /Only one of structuredResponseSchema or availableTools can be specified/)
})
