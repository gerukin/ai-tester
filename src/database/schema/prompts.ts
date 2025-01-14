import { text, integer, sqliteTable, unique } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

import { promptToTagRels } from './tags.js'

export const prompts = sqliteTable('prompts', {
	id: integer('id').primaryKey(),

	/** Internal code for identifying this prompt (all revisions and languages should share the same code) */
	code: text('code').notNull().unique(),
})
export const promptRelations = relations(prompts, ({ many }) => ({
	/** All versions of this template */
	versions: many(promptVersions),

	/** The tags this model version is able to judge for */
	tags: many(promptToTagRels),
}))

export type PromptVersionInsert = typeof promptVersions.$inferInsert
export const promptVersions = sqliteTable(
	'prompt_versions',
	{
		id: integer('id').primaryKey(),
		promptId: integer('prompt_id')
			.notNull()
			.references(() => prompts.id, { onUpdate: 'cascade', onDelete: 'cascade' }),

		/** Whether the prompt version is still being used in the markdown files */
		active: integer('active', { mode: 'boolean' }).notNull().default(true),

		/**
		 * SHA-256 hash of the content, encoded as a hex string, used to determine if the content has changed.
		 * It includes a list of special tags used in this test, since they can change the output and should be considered a different prompt.
		 *
		 * note: as of 2024/08/31 this cannot be done as a runtime default value using the other columns here,
		 * and crypto extensions are not enabled in SQLite.
		 */
		hash: text('hash').notNull(),

		content: text('content').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(strftime('%s', 'now'))`),
	},
	t => ({
		unq: unique().on(t.promptId, t.hash),
	})
)
export const promptVersionRelations = relations(promptVersions, ({ one }) => ({
	/** The prompt this version belongs to */
	prompt: one(prompts, {
		fields: [promptVersions.promptId],
		references: [prompts.id],
	}),
}))
