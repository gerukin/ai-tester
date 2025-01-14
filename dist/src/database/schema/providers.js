import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { modelVersions } from './models.js';
export const providers = sqliteTable('providers', {
    id: integer('id').primaryKey(),
    /** The code of the vendor */
    code: text('code').notNull().unique(),
    /** The name of the vendor */
    name: text('name').notNull().unique(),
});
export const vendorModelVersionsRelation = relations(providers, ({ many }) => ({
    /** All model versions by this vendor */
    modelVersions: many(modelVersions),
}));
