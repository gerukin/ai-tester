import { defineConfig } from 'drizzle-kit'

// importing from the environment.js file avoids side effects from other config files
import { envConfig } from '../config/environment.js'

import { ensureDirectoryExists } from '../utils/files.js'

ensureDirectoryExists(envConfig.AI_TESTER_SQLITE_DB_PATH)

export default defineConfig({
	// This will be relative to the dist's version of this file (drizzle.config.js)
	schema: './src/database/schema/**/*.js',
	out: '../migrations', // targets the root of the package (as long as executed from the dist directory)
	dialect: 'sqlite',
	dbCredentials: {
		url: envConfig.AI_TESTER_SQLITE_DB_PATH,
	},
})
