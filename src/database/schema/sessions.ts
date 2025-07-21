import { text, integer, real, sqliteTable, index } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

import { promptVersions } from './prompts.js'
import { testVersions, testEvaluationInstructionsVersions } from './tests.js'
import { modelVersions } from './models.js'

export const sessions = sqliteTable(
	'sessions',
	{
		id: integer('id').primaryKey(),

		/** The id of the test version used in this session */
		testVersionId: integer('test_version_id')
			.notNull()
			.references(() => testVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),

		/** The id of the prompt version used in this session */
		candidateSysPromptVersionId: integer('candidate_sys_prompt_version_id')
			.notNull()
			.references(() => promptVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),

		/** Model version used */
		modelVersionId: integer('model_version_id')
			.notNull()
			.references(() => modelVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),

		/** Temperature used */
		temperature: real('temperature').notNull(),

		/** The thoughts/reasoning outputted by the LLM, if available */
		reasoning: text('reasoning'),

		/** The answer given by the LLM */
		answer: text('answer').notNull(),

		/** Completion tokens count */
		completionTokens: integer('completion_tokens').notNull(),

		/** Prompt tokens count */
		promptTokens: integer('prompt_tokens').notNull(),

		/** Cached prompt tokens written count */
		cachedPromptTokensWritten: integer('cached_prompt_tokens'),

		/** Cached prompt tokens read count */
		cachedPromptTokensRead: integer('cached_prompt_tokens_read'),

		/** The time taken to answer */
		timeTaken: integer('time_taken').notNull(),

		/** Timestamp */
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(strftime('%s', 'now'))`),
	},
	t => [
		index('combined_session_idx').on(
			t.modelVersionId,
			t.testVersionId,
			t.candidateSysPromptVersionId,
			t.temperature
		),
		index('test_id_idx').on(t.testVersionId),
	]
)
export const sessionRelations = relations(sessions, ({ one }) => ({
	/** The prompt version used in this session */
	candidateSysPromptVersion: one(promptVersions, {
		fields: [sessions.candidateSysPromptVersionId],
		references: [promptVersions.id],
	}),

	/** The test version used in this session */
	test: one(testVersions, {
		fields: [sessions.testVersionId],
		references: [testVersions.id],
	}),

	/** Model version used */
	modelVersion: one(modelVersions, {
		fields: [sessions.modelVersionId],
		references: [modelVersions.id],
	}),
}))

export const sessionEvaluations = sqliteTable(
	'session_evaluations',
	{
		id: integer('id').primaryKey(),

		/** The id of the session this evaluation is for */
		sessionId: integer('session_id')
			.notNull()
			.references(() => sessions.id, { onUpdate: 'cascade', onDelete: 'cascade' }),

		/** The id of the evaluation prompt version used in this session */
		evaluationPromptVersionId: integer('evaluation_prompt_version_id')
			.notNull()
			.references(() => promptVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),

		/** The id of the evaluation instructions version used in this evaluation */
		testEvaluationInstructionsVersionId: integer('test_evaluation_instructions_version_id')
			.notNull()
			.references(() => testEvaluationInstructionsVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),

		/** Model version used */
		modelVersionId: integer('model_version_id')
			.notNull()
			.references(() => modelVersions.id, {
				onUpdate: 'cascade',
				onDelete: 'cascade',
			}),

		/** Temperature used */
		temperature: real('temperature').notNull(),

		// Note: reasoning is not available when generating structured objects, even for reasoning models,
		// and cannot be stored here as a result.

		/** Whether the evaluation was passed or not */
		pass: integer('pass').notNull(),

		/** The evaluation feedback */
		feedback: text('feedback'),

		/** Completion tokens count */
		completionTokens: integer('completion_tokens').notNull(),

		/** Prompt tokens count */
		promptTokens: integer('prompt_tokens').notNull(),

		/** Cached prompt tokens written count */
		cachedPromptTokensWritten: integer('cached_prompt_tokens'),

		/** Cached prompt tokens read count */
		cachedPromptTokensRead: integer('cached_prompt_tokens_read'),

		/** The time taken to answer */
		timeTaken: integer('time_taken').notNull(),

		/** Timestamp */
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(strftime('%s', 'now'))`),
	},
	t => [
		index('combined_evaluation_idx').on(t.modelVersionId, t.sessionId, t.evaluationPromptVersionId, t.temperature),
		index('session_id_idx').on(t.sessionId),
	]
)

export const sessionEvaluationRelations = relations(sessionEvaluations, ({ one }) => ({
	/** The session this evaluation is for */
	session: one(sessions, {
		fields: [sessionEvaluations.sessionId],
		references: [sessions.id],
	}),

	/** The evaluation prompt version used in this session */
	evaluationPromptVersion: one(promptVersions, {
		fields: [sessionEvaluations.evaluationPromptVersionId],
		references: [promptVersions.id],
	}),

	/** Model version used */
	modelVersion: one(modelVersions, {
		fields: [sessionEvaluations.modelVersionId],
		references: [modelVersions.id],
	}),
}))
