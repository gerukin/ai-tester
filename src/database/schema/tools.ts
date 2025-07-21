import { sqliteTable, integer, text, unique, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

import { testVersions } from './tests.js'

/**
 * Table of tools (function definitions for use in tests)
 * Each tool can have multiple versions.
 */
export const tools = sqliteTable('tools', {
	id: integer('id').primaryKey(),

	/** Internal code for identifying this tool (all revisions share the same code) */
	code: text('code').notNull().unique(),
})

export const toolRelations = relations(tools, ({ many }) => ({
	versions: many(toolVersions),
}))

export const toolVersions = sqliteTable(
	'tool_versions',
	{
		id: integer('id').primaryKey(),

		toolId: integer('tool_id')
			.notNull()
			.references(() => tools.id, { onUpdate: 'cascade', onDelete: 'cascade' }),

		/** Whether the version is active */
		active: integer('active', { mode: 'boolean' }).notNull().default(true),

		/** SHA-256 hash of the content, encoded as a hex string, to detect changes */
		hash: text('hash').notNull(),

		/** The actual tool definition (including name, description, and parameters), stored as a JSON string */
		schema: text('schema').notNull(),

		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(strftime('%s', 'now'))`),
	},
	t => ({
		unq: unique().on(t.toolId, t.hash),
	})
)

export const toolVersionRelations = relations(toolVersions, ({ one, many }) => ({
	/** The tool this version belongs to */
	tool: one(tools, {
		fields: [toolVersions.toolId],
		references: [tools.id],
	}),

	/** All test versions using this tool version */
	tests: many(testToToolVersionRels),
}))

/**
 * Join table for many-to-many relationship between test versions and tool versions
 */
export const testToToolVersionRels = sqliteTable(
	'test_to_tool_version_rels',
	{
		testVersionId: integer('test_version_id')
			.notNull()
			.references(() => testVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),

		toolVersionId: integer('tool_version_id')
			.notNull()
			.references(() => toolVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),
	},
	t => ({
		pk: primaryKey({ columns: [t.testVersionId, t.toolVersionId] }),
	})
)

export const testToolVersionRelations = relations(testToToolVersionRels, ({ one }) => ({
	/** The test version related to this tool version */
	test: one(testVersions, {
		fields: [testToToolVersionRels.testVersionId],
		references: [testVersions.id],
	}),

	/** The tool version related to this test */
	toolVersion: one(toolVersions, {
		fields: [testToToolVersionRels.toolVersionId],
		references: [toolVersions.id],
	}),
}))
