import knex from 'knex';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = process.env.DB_CLIENT ?? 'better-sqlite3';
const isSqlite = client === 'better-sqlite3' || client === 'sqlite3';

const db = knex({
  client,
  connection: isSqlite
    ? { filename: process.env.DB_FILENAME ?? path.join(__dirname, '..', 'scores.db') }
    : process.env.DB_CONNECTION,
  useNullAsDefault: isSqlite,
});

await db.schema.createTableIfNotExists('scores', (table) => {
  table.increments('id');
  table.string('game').notNullable().index();
  table.string('player').notNullable();
  table.integer('score').notNullable();
  table.timestamp('created_at').defaultTo(db.fn.now());
  table.index(['game', 'score']);
});

export default db;
