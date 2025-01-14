import { text, integer, sqliteTable, unique } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';
import { providers } from './providers.js';
export const models = sqliteTable('models', {
    id: integer('id').primaryKey(),
    /** Internal unique code identifying this model (this does not need to match the model maker's) */
    code: text('code').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql `(strftime('%s', 'now'))`),
});
export const modelRelations = relations(models, ({ many }) => ({
    /** All versions of this model */
    versions: many(modelVersions),
}));
export const modelVersions = sqliteTable('model_versions', {
    id: integer('id').primaryKey(),
    modelId: integer('model_id')
        .notNull()
        .references(() => models.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
    providerId: integer('provider_id')
        .notNull()
        .references(() => providers.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
    providerModelCode: text('provider_model_code').notNull(),
    // This could be anything the provider uses to identify the model beyond the code (ex: a `digest` in Ollama)
    extraIdentifier: text('extra_identifier'),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql `(strftime('%s', 'now'))`),
}, t => ({
    unq: unique().on(t.providerId, t.providerModelCode, t.extraIdentifier),
}));
export const modelVersionRelations = relations(modelVersions, ({ one }) => ({
    /** The model this version belongs to */
    model: one(models, {
        fields: [modelVersions.modelId],
        references: [models.id],
    }),
    /** The provider this version belongs to */
    provider: one(providers, {
        fields: [modelVersions.providerId],
        references: [providers.id],
    }),
}));
