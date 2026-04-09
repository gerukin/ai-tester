import assert from 'node:assert/strict'
import test from 'node:test'

import { runApp, runDefaultApp } from '../src/bootstrap.js'
import { createSyncTestEnv } from './helpers/test-harness.js'

test('runApp invokes the provided main menu and returns its result', async () => {
	let calls = 0

	const result = await runApp({
		mainMenu: async () => {
			calls += 1
			return 'menu-result'
		},
	})

	assert.strictEqual(calls, 1)
	assert.strictEqual(result, 'menu-result')
})

test('runDefaultApp loads the menu through the loader before running it', async () => {
	let loaderCalls = 0
	let menuCalls = 0

	const result = await runDefaultApp({
		menuLoader: async () => {
			loaderCalls += 1
			return async () => {
				menuCalls += 1
				return 'default-result'
			}
		},
	})

	assert.strictEqual(loaderCalls, 1)
	assert.strictEqual(menuCalls, 1)
	assert.strictEqual(result, 'default-result')
})

test('src/index.ts runs the default bootstrap entrypoint on import', async t => {
	const env = await createSyncTestEnv()
	t.after(async () => {
		await env.cleanup()
	})

	const result = env.runModule('bootstrap:index')
	assert.strictEqual(result.status, 0, `Expected bootstrap import success.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`)
	assert.deepStrictEqual(JSON.parse(result.stdout), { menuCalls: 1 })
})
