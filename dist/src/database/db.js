import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/node';
import fs from 'node:fs';
import { schema } from './schema.js';
import { envConfig } from '../config/index.js';
if (!fs.existsSync(envConfig.AI_TESTER_SQLITE_DB_PATH)) {
    throw new Error(`The DB at ${envConfig.AI_TESTER_SQLITE_DB_PATH} does not exist. Run your migrations first to create it.`);
}
const sqlite = createClient({
    url: 'file:' + envConfig.AI_TESTER_SQLITE_DB_PATH,
});
export const db = drizzle(sqlite, { schema, logger: false });
// enable foreign key constraints
db.run(sql `PRAGMA foreign_keys = ON`);
