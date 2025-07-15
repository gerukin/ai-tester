import { text, integer, sqliteTable, unique, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

import { testToTagRels } from './tags.js'
import { promptVersions } from './prompts.js'
import { structuredObjectVersions } from './structured-objects.js'

export const testVersions = sqliteTable(
	'test_versions',
	{
		id: integer('id').primaryKey(),

		/** Whether the test version is still being used in the markdown files */
		active: integer('active', { mode: 'boolean' }).notNull().default(true),

		/**
		 * SHA-256 hash of the content, encoded as a hex string, used to determine if the content has changed.
		 * It includes a list of special tags used in this test, since they can change the output and should be considered a different test.
		 *
		 * note: as of 2024/08/31 this cannot be done as a runtime default value using the other columns here,
		 * and crypto extensions are not enabled in SQLite.
		 */
		hash: text('hash').notNull(),

		content: text('content').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(strftime('%s', 'now'))`),

		/** The expected structured object version for this test (optional) */
		structuredObjectVersionId: integer('structured_object_version_id').references(() => structuredObjectVersions.id, {
			onUpdate: 'cascade',
			onDelete: 'set null',
		}),
	},
	t => ({
		unq: unique().on(t.hash),
	})
)
export const testRelations = relations(testVersions, ({ many }) => ({
	/** The tags related to this test */
	tags: many(testToTagRels),

	/** All prompt versions used in this test */
	promptVersions: many(testToSystemPromptVersionRels),
}))

export const testToSystemPromptVersionRels = sqliteTable(
	'test_to_system_prompt_version_rels',
	{
		/** The id of the test */
		testVersionId: integer('test_version_id')
			.notNull()
			.references(() => testVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),

		/** The id of the system prompt version */
		systemPromptVersionId: integer('system_prompt_version_id')
			.notNull()
			.references(() => promptVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),
	},
	t => ({
		pk: primaryKey({ columns: [t.testVersionId, t.systemPromptVersionId] }),
	})
)
export const testSystemPromptVersionRelations = relations(testToSystemPromptVersionRels, ({ one }) => ({
	/** The test version related to this system prompt version */
	test: one(testVersions, {
		fields: [testToSystemPromptVersionRels.testVersionId],
		references: [testVersions.id],
	}),

	/** The system prompt version related to this test */
	systemPromptVersion: one(promptVersions, {
		fields: [testToSystemPromptVersionRels.systemPromptVersionId],
		references: [promptVersions.id],
	}),
}))

export const testEvaluationInstructionsVersions = sqliteTable(
	'test_evaluation_instructions_versions',
	{
		/** The id of the instructions version */
		id: integer('id').primaryKey(),

		/** Whether the instructions version is still being used in the markdown files */
		active: integer('active', { mode: 'boolean' }).notNull().default(true),

		/**
		 * SHA-256 hash of the content, encoded as a hex string, used to determine if the content has changed.
		 *
		 * note: as of 2024/08/31 this cannot be done as a runtime default value using the other columns here,
		 * and crypto extensions are not enabled in SQLite.
		 */
		hash: text('hash').notNull(),

		/** The content of the evaluation instructions */
		content: text('content').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(strftime('%s', 'now'))`),
	},
	t => ({
		unq: unique().on(t.hash),
	})
)

export const testToEvaluationInstructionsRels = sqliteTable(
	'test_to_evaluation_instructions_rels',
	{
		/** The id of the test */
		testVersionId: integer('test_version_id')
			.notNull()
			.references(() => testVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),

		/** The id of the evaluation instructions version */
		evaluationInstructionsVersionId: integer('evaluation_instructions_version_id')
			.notNull()
			.references(() => testEvaluationInstructionsVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),
	},
	t => ({
		pk: primaryKey({ columns: [t.testVersionId, t.evaluationInstructionsVersionId] }),
	})
)

export const testEvaluationInstructionsRelations = relations(testToEvaluationInstructionsRels, ({ one }) => ({
	/** The test version related to this evaluation instructions version */
	test: one(testVersions, {
		fields: [testToEvaluationInstructionsRels.testVersionId],
		references: [testVersions.id],
	}),

	/** The evaluation instructions version related to this test */
	evaluationInstructionsVersion: one(testEvaluationInstructionsVersions, {
		fields: [testToEvaluationInstructionsRels.evaluationInstructionsVersionId],
		references: [testEvaluationInstructionsVersions.id],
	}),
}))
