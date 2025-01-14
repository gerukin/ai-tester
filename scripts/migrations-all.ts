#!/usr/bin/env -S node --no-warnings
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const DBPath = process.env['AI_TESTER_SQLITE_DB_PATH']
if (!DBPath) {
	throw new Error('AI_TESTER_SQLITE_DB_PATH is not set')
}

// get all arguments as a string
const args = process.argv.slice(2).join(' ')

// We transform the path (if relative) to an absolute path
// This is necessary for the drizzle-kit check command
// And we set the environment variable to the new path
// This guarantees that Drizzle Kit will find the database even when executed from a different directory
process.env['AI_TESTER_SQLITE_DB_PATH'] = path.isAbsolute(DBPath) ? DBPath : path.resolve(process.cwd(), DBPath)

// The drizzle-kit config file is managed by the package
execSync(`npx drizzle-kit ${args} --config ./src/database/drizzle.config.js`, {
	// We need to run this from the dist directory of the package (once built)
	// But we preserve the already set environment variables
	cwd: fileURLToPath(new URL('..', import.meta.url)),

	// And stream the output to the console
	stdio: 'inherit',
})
