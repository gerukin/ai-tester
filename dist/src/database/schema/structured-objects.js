import { sqliteTable, integer, text, unique } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';
/**
 * Table of structured objects (like prompts, but for structured data)
 * Each object can have multiple versions.
 */
export const structuredObjects = sqliteTable('structured_objects', {
    id: integer('id').primaryKey(),
    /** Internal code for identifying this object (all revisions should share the same code) */
    code: text('code').notNull().unique(),
});
export const structuredObjectRelations = relations(structuredObjects, ({ many }) => ({
    versions: many(structuredObjectVersions),
}));
export const structuredObjectVersions = sqliteTable('structured_object_versions', {
    id: integer('id').primaryKey(),
    structuredObjectId: integer('structured_object_id')
        .notNull()
        .references(() => structuredObjects.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
    /** Whether the version is active */
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** SHA-256 hash of the content, encoded as a hex string, to detect changes */
    hash: text('hash').notNull(),
    /** The actual structured object, stored as JSON */
    schema: text('schema', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql `(strftime('%s', 'now'))`),
}, t => ({
    unq: unique().on(t.structuredObjectId, t.hash),
}));
export const structuredObjectVersionRelations = relations(structuredObjectVersions, ({ one }) => ({
    /** The structured object this version belongs to */
    structuredObject: one(structuredObjects, {
        fields: [structuredObjectVersions.structuredObjectId],
        references: [structuredObjects.id],
    }),
}));
