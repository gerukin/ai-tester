// This is a convenience file that exports all the schema files in this directory, for use in the app.
// Make sure no exported names conflict with each other.

import * as models from './schema/models.js'
import * as prompts from './schema/prompts.js'
import * as providers from './schema/providers.js'
import * as sessions from './schema/sessions.js'
import * as tags from './schema/tags.js'
import * as tests from './schema/tests.js'
// import * as views from './schema/views.js'

export const schema = {
	...models,
	...prompts,
	...providers,
	...sessions,
	...tags,
	...tests,

	// TODO: views do not seem to be handled by DrizzleKit - will be handled manually or here in the future
	// ...views,
}
