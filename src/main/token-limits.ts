import { and, eq, isNull, lt } from 'drizzle-orm'

import { schema } from '../database/schema.js'

type DbWithUpdates = {
	update: typeof import('../database/db.js').db.update
}

export const refreshSessionTokenLimitState = async (db: DbWithUpdates, maxOutputTokens: number) => {
	const { sessions } = schema

	await db
		.update(sessions)
		.set({
			finishReason: 'length',
			maxOutputTokens,
		})
		.where(and(isNull(sessions.finishReason), eq(sessions.completionTokens, maxOutputTokens)))

	await db
		.update(sessions)
		.set({ active: false })
		.where(
			and(
				eq(sessions.active, true),
				eq(sessions.finishReason, 'length'),
				lt(sessions.maxOutputTokens, maxOutputTokens)
			)
		)
}

export const refreshEvaluationTokenLimitState = async (db: DbWithUpdates, maxOutputTokens: number) => {
	const { sessionEvaluations } = schema

	await db
		.update(sessionEvaluations)
		.set({
			finishReason: 'length',
			maxOutputTokens,
		})
		.where(and(isNull(sessionEvaluations.finishReason), eq(sessionEvaluations.completionTokens, maxOutputTokens)))

	await db
		.update(sessionEvaluations)
		.set({ active: false })
		.where(
			and(
				eq(sessionEvaluations.active, true),
				eq(sessionEvaluations.finishReason, 'length'),
				lt(sessionEvaluations.maxOutputTokens, maxOutputTokens)
			)
		)
}
