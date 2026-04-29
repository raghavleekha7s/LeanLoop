// Postgres pool singleton — shared by the queue, credentials cache, and any
// other durable state the dashboard owns. Points at the same DB n8n uses.
//
// Running migrations on boot is safe because the statements are idempotent
// (CREATE TABLE IF NOT EXISTS). For bigger schemas we'd move to a proper
// migration tool like node-pg-migrate.

import { Pool, type PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  pool = new Pool({
    host: process.env.DB_POSTGRESDB_HOST ?? 'postgres',
    port: Number(process.env.DB_POSTGRESDB_PORT ?? 5432),
    database: process.env.DB_POSTGRESDB_DATABASE ?? 'n8n',
    user: process.env.DB_POSTGRESDB_USER ?? 'n8n',
    password: process.env.DB_POSTGRESDB_PASSWORD ?? '',
    max: 10,
  });
  pool.on('error', (err) => {
    console.error('[db] idle client error', err);
  });
  return pool;
}

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

let migrated = false;
export async function runMigrations(): Promise<void> {
  if (migrated) return;
  const sql = `
    CREATE TABLE IF NOT EXISTS leanloop_queue (
      execution_id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      workflow_name TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ,
      queue TEXT NOT NULL CHECK (queue IN ('retry','dead-letter')),
      last_error TEXT,
      alerted BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS leanloop_queue_next_attempt_idx
      ON leanloop_queue (queue, next_attempt_at) WHERE queue = 'retry';

    CREATE TABLE IF NOT EXISTS leanloop_activations (
      id SERIAL PRIMARY KEY,
      template_id TEXT NOT NULL,
      n8n_workflow_id TEXT NOT NULL,
      credentials JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await withClient((c) => c.query(sql));
  migrated = true;
}
