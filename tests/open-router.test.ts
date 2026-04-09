import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import { createSyncTestEnv } from './helpers/test-harness.js'

const sampleModel = {
	id: 'openai/gpt-4.1-mini',
	canonical_slug: 'openai/gpt-4.1-mini',
	hugging_face_id: '',
	name: 'OpenAI experimental free',
	created: 1,
	description: 'Fast model',
	context_length: 128000,
	architecture: {
		input_modalities: ['text', 'image'],
		output_modalities: ['text'],
	},
	pricing: {
		prompt: '0.000001',
		completion: '0',
		request: '0.5',
	},
	top_provider: {},
	per_request_limits: null,
	supported_parameters: ['tools', 'structured_outputs', 'reasoning'],
}

const expectModuleSuccess = (result: { status: number | null; stdout: string; stderr: string }) => {
	assert.strictEqual(
		result.status,
		0,
		`Expected module success.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
	)
	return JSON.parse(result.stdout) as unknown
}

test('getOpenRouterModels fetches, enriches, and caches models', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const models = expectModuleSuccess(
		env.runModule('openRouter:getModels', {
			fetchResponse: { data: [sampleModel] },
		})
	) as Array<{
		_enhanced_description: string
		_capabilities: { in: string[]; out: string[]; other: string[] }
	}>

	assert.deepStrictEqual(models[0]?._capabilities, {
		in: ['text', 'image'],
		out: ['text'],
		other: ['tools', 'structured_outputs', 'reasoning'],
	})
	assert.match(models[0]?._enhanced_description ?? '', /💪/)
	assert.match(models[0]?._enhanced_description ?? '', /💵 prompt: 1, request: 0.5/)

	const cachePath = path.join(env.env.AI_TESTER_LOGS_DIR, 'open-router-models.json')
	const cacheContent = JSON.parse(await fs.readFile(cachePath, 'utf8')) as { data: Array<{ id: string }> }
	assert.deepStrictEqual(cacheContent.data.map(model => model.id), ['openai/gpt-4.1-mini'])
})

test('getOpenRouterModels falls back to cached data when fetch fails', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	await fs.writeFile(
		path.join(env.env.AI_TESTER_LOGS_DIR, 'open-router-models.json'),
		JSON.stringify({ data: [sampleModel] }, null, 2)
	)

	const models = expectModuleSuccess(
		env.runModule('openRouter:getModels', {
			fetchError: 'network down',
		})
	) as Array<{ id: string }>

	assert.deepStrictEqual(models.map(model => model.id), ['openai/gpt-4.1-mini'])
})

test('formatOpenRouterModelsForDisplay abbreviates pricing and capabilities', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const formatted = expectModuleSuccess(
		env.runModule('openRouter:format', [
			{
				...sampleModel,
				_capabilities: {
					in: ['text', 'image'],
					out: ['text'],
					other: ['tools', 'reasoning'],
				},
			},
		])
	) as Record<string, Record<string, string | number>>

	const [name, row] = Object.entries(formatted)[0] ?? []
	assert.match(name ?? '', /OAI/)
	assert.match(name ?? '', /exp\./)
	assert.match(name ?? '', /🤑/)
	assert.deepStrictEqual(row, {
		'$in': 1,
		'$req': 0.5,
		'⬆️ img': '✅',
		'🛠️': '✅',
		'🧠': '✅',
	})
})
