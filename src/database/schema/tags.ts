import { text, integer, sqliteTable, primaryKey } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

import { testVersions } from './tests.js'
import { prompts } from './prompts.js'

export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey(),

	/** The name of the tag */
	name: text('name').notNull().unique(),
})
export const tagRelations = relations(tags, ({ many }) => ({
	/** Tests related to this tag */
	tests: many(testToTagRels),

	/** Prompts related to this tag */
	prompts: many(promptToTagRels),
}))

export const testToTagRels = sqliteTable(
	'test_to_tag_rels',
	{
		tagId: integer('tag_id')
			.notNull()
			.references(() => tags.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
		testVersionId: integer('test_version_id')
			.notNull()
			.references(() => testVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),
	},
	t => ({
		pk: primaryKey({ columns: [t.tagId, t.testVersionId] }),
	})
)
export const tagsToTestRelations = relations(testToTagRels, ({ one }) => ({
	/** The tag related to this test */
	tag: one(tags, {
		fields: [testToTagRels.tagId],
		references: [tags.id],
	}),

	/** The test related to this tag */
	test: one(testVersions, {
		fields: [testToTagRels.testVersionId],
		references: [testVersions.id],
	}),
}))

export const promptToTagRels = sqliteTable(
	'prompt_to_tag_rels',
	{
		tagId: integer('tag_id')
			.notNull()
			.references(() => tags.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
		promptId: integer('prompt_id')
			.notNull()
			.references(() => prompts.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
	},
	t => ({
		pk: primaryKey({ columns: [t.tagId, t.promptId] }),
	})
)
export const tagsToPromptRelations = relations(promptToTagRels, ({ one }) => ({
	/** The tag related to this prompt */
	tag: one(tags, {
		fields: [promptToTagRels.tagId],
		references: [tags.id],
	}),

	/** The prompt related to this tag */
	prompt: one(prompts, {
		fields: [promptToTagRels.promptId],
		references: [prompts.id],
	}),
}))
