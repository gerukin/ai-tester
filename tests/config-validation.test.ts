import assert from 'node:assert/strict'
import test from 'node:test'

import { createSyncTestEnv } from './helpers/test-harness.js'

const expectModuleSuccess = (result: { status: number | null; stdout: string; stderr: string }) => {
	assert.strictEqual(
		result.status,
		0,
		`Expected module success.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
	)
	return JSON.parse(result.stdout) as unknown
}

const expectModuleFailure = (
	result: { status: number | null; stdout: string; stderr: string },
	pattern: RegExp
) => {
	assert.notStrictEqual(
		result.status,
		0,
		`Expected module failure.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
	)
	assert.match(`${result.stdout}\n${result.stderr}`, pattern)
}

test('config loading fails when the config file is missing', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.remove('ai-tester.config.yaml')

	expectModuleFailure(env.runModule('config:getResolvedTestsConfig'), /Config file not found/)
})

test('config loading rejects duplicate configured model references', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'ai-tester.config.yaml',
		[
			'candidatesTemperature: 0.3',
			'candidates:',
			'  - provider: openai',
			'    model: gpt-4o-mini',
			'  - provider: openai',
			'    model: gpt-4o-mini',
			'attempts: 1',
			'requiredTags1: []',
			'requiredTags2: []',
			'prohibitedTags: []',
			'evaluators: []',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
		].join('\n')
	)

	expectModuleFailure(env.runModule('config:getResolvedTestsConfig'), /Duplicate configured model reference/)
})

test('config loading rejects duplicate analysis query descriptions', async t => {
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
			'evaluators: []',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
			'analysisQueries:',
			'  - description: Duplicate query',
			'    currency: USD',
			'  - description: Duplicate query',
			'    currency: USD',
		].join('\n')
	)

	expectModuleFailure(env.runModule('config:getResolvedTestsConfig'), /Duplicate analysis query description/)
})

test('resolveTestsConfig filters unavailable configured models from tests and analysis queries', async t => {
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
		'ai-tester.config.yaml',
		[
			'candidatesTemperature: 0.3',
			'candidates:',
			'  - provider: openai',
			'    model: gpt-4o-mini',
			'  - provider: openai',
			'    model: missing-candidate',
			'attempts: 1',
			'requiredTags1: []',
			'requiredTags2: []',
			'prohibitedTags: []',
			'evaluators:',
			'  - provider: openai',
			'    model: gpt-4o-mini',
			'  - provider: openai',
			'    model: missing-evaluator',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
			'analysisQueries:',
			'  - description: Active only',
			'    currency: USD',
			'    systemPrompts:',
			'      - helpful',
			'      - helpful-v1-hash',
			'    candidates:',
			'      - provider: openai',
			'        model: gpt-4o-mini',
			'      - provider: openai',
			'        model: missing-analysis-candidate',
			'    evaluators:',
			'      - provider: openai',
			'        model: missing-analysis-evaluator',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	const result = expectModuleSuccess(env.runModule('config:getResolvedTestsConfig')) as {
		resolvedTestsConfig: {
			candidates: Array<{ provider: string; model: string }>
			evaluators: Array<{ provider: string; model: string }>
			analysisQueries?: Array<{
				systemPrompts?: string[]
				candidates?: Array<{ provider: string; model: string }>
				evaluators?: Array<{ provider: string; model: string }>
			}>
		}
	}

	assert.deepStrictEqual(result.resolvedTestsConfig.candidates, [{ provider: 'openai', model: 'gpt-4o-mini' }])
	assert.deepStrictEqual(result.resolvedTestsConfig.evaluators, [{ provider: 'openai', model: 'gpt-4o-mini' }])
	assert.deepStrictEqual(result.resolvedTestsConfig.analysisQueries?.[0]?.candidates, [
		{ provider: 'openai', model: 'gpt-4o-mini' },
	])
	assert.deepStrictEqual(result.resolvedTestsConfig.analysisQueries?.[0]?.systemPrompts, [
		'helpful',
		'helpful-v1-hash',
	])
	assert.deepStrictEqual(result.resolvedTestsConfig.analysisQueries?.[0]?.evaluators, [])
})

test('model registry rejects duplicate provider codes', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write('data/providers/openai-a.yaml', ['code: openai', 'name: OpenAI A', 'type: openai'].join('\n'))
	await env.write('data/providers/openai-b.yaml', ['code: openai', 'name: OpenAI B', 'type: openai'].join('\n'))

	expectModuleFailure(env.runModule('modelRegistry:loadProviders'), /Duplicate provider code found in YAML files/)
})

test('model registry loads openai-compatible structured output support flag', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/providers/openrouter.yaml',
		[
			'code: openrouter',
			'name: OpenRouter',
			'type: openai-compatible',
			'baseURL: https://openrouter.ai/api/v1',
			'apiKeyEnvVar: OPENROUTER_API_KEY',
			'supportsStructuredOutputs: true',
		].join('\n')
	)
	await env.write(
		'data/providers/compatible.yaml',
		[
			'code: compatible',
			'name: Compatible',
			'type: openai-compatible',
			'baseURL: https://compatible.example.com/v1',
			'apiKeyEnvVar: COMPATIBLE_API_KEY',
		].join('\n')
	)

	const providers = expectModuleSuccess(env.runModule('modelRegistry:loadProviders')) as Array<{
		code: string
		supportsStructuredOutputs?: boolean
	}>

	const byCode = new Map(providers.map(provider => [provider.code, provider]))
	assert.strictEqual(byCode.get('openrouter')?.supportsStructuredOutputs, true)
	assert.strictEqual(byCode.get('compatible')?.supportsStructuredOutputs, false)
})

test('model registry rejects invalid openai-compatible structured output support flag', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/providers/openrouter.yaml',
		[
			'code: openrouter',
			'name: OpenRouter',
			'type: openai-compatible',
			'baseURL: https://openrouter.ai/api/v1',
			'apiKeyEnvVar: OPENROUTER_API_KEY',
			'supportsStructuredOutputs: 1',
		].join('\n')
	)

	expectModuleFailure(env.runModule('modelRegistry:loadProviders'), /Expected boolean/)
})

test('model registry rejects model definitions that reference missing providers', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write(
		'data/models/gpt-4o-mini.yaml',
		['code: gpt-4o-mini', 'provider: missing', 'providerModelCode: gpt-4o-mini'].join('\n')
	)

	expectModuleFailure(env.runModule('modelRegistry:loadModels'), /references missing provider missing/)
})

test('model registry rejects duplicate runtime identities across YAML entries', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write('data/providers/openai.yaml', ['code: openai', 'name: OpenAI', 'type: openai'].join('\n'))
	await env.write(
		'data/models/a.yaml',
		[
			'code: gpt-4o-mini-a',
			'provider: openai',
			'providerModelCode: gpt-4o-mini',
			'providerOptions:',
			'  seed: 1',
		].join('\n')
	)
	await env.write(
		'data/models/b.yaml',
		[
			'code: gpt-4o-mini-b',
			'provider: openai',
			'providerModelCode: gpt-4o-mini',
			'providerOptions:',
			'  seed: 1',
		].join('\n')
	)

	expectModuleFailure(env.runModule('modelRegistry:loadModels'), /Duplicate runtime model identity found in YAML files/)
})

test('model registry rejects conflicting active variants for the same provider model code', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write('data/providers/openai.yaml', ['code: openai', 'name: OpenAI', 'type: openai'].join('\n'))
	await env.write(
		'data/models/a.yaml',
		[
			'code: gpt-4o-mini-a',
			'provider: openai',
			'providerModelCode: gpt-4o-mini',
			'providerOptions:',
			'  seed: 1',
		].join('\n')
	)
	await env.write(
		'data/models/b.yaml',
		[
			'code: gpt-4o-mini-b',
			'provider: openai',
			'providerModelCode: gpt-4o-mini',
			'providerOptions:',
			'  seed: 2',
		].join('\n')
	)

	expectModuleFailure(env.runModule('modelRegistry:loadRegistry'), /Conflicting active model variants for openai:gpt-4o-mini/)
})

test('model registry loads capabilities and defaults missing capability keys to false', async t => {
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
			'capabilities:',
			'  input:',
			'    text: true',
			'  output:',
			'    text: true',
			'    structured: true',
		].join('\n')
	)

	const models = expectModuleSuccess(env.runModule('modelRegistry:loadModels')) as Array<{
		capabilities?: {
			input: { text: boolean; image: boolean; file: boolean; pdf: boolean }
			output: { text: boolean; structured: boolean; tools: boolean; reasoning: boolean }
		}
	}>

	assert.deepStrictEqual(models[0]?.capabilities, {
		input: { text: true, image: false, file: false, pdf: false },
		output: { text: true, structured: true, tools: false, reasoning: false },
	})
})

test('model registry rejects invalid capability declarations', async t => {
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
			'capabilities:',
			'  input:',
			'    image: nope',
		].join('\n')
	)

	expectModuleFailure(env.runModule('modelRegistry:loadModels'), /Expected boolean/)
})

test('currency registry validation reports missing model-cost and analysis-query currencies', async t => {
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
			'evaluators: []',
			'evaluatorsTemperature: 0.4',
			'evaluationsPerEvaluator: 1',
			'analysisQueries:',
			'  - description: Missing currency',
			'    currency: JPY',
		].join('\n')
	)
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
			'    currency: EUR',
			'    validFrom: 2025-01-01',
		].join('\n')
	)
	await env.write(
		'data/currencies/USD.yaml',
		['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n')
	)

	expectModuleFailure(
		env.runModule('currencyRegistry:validateReferences'),
		/missing YAML files for referenced currencies: EUR \(model openai:gpt-4o-mini\), JPY \(analysis query "Missing currency"\)/
	)
})

test('currency registry rejects duplicate currency codes across YAML files', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await env.write('data/currencies/usd-a.yaml', ['code: USD', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-01-01'].join('\n'))
	await env.write('data/currencies/usd-b.yaml', ['code: usd', 'rates:', '  - rateInUSD: 1', '    validFrom: 2025-02-01'].join('\n'))

	expectModuleFailure(env.runModule('currencyRegistry:loadDefinitions'), /Duplicate currency code found in YAML files: USD/)
})
