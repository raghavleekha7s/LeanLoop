// Postgres-backed retry + dead-letter queue for failed n8n executions.
//
// Classification rules (matches n8n-client.ts):
//   status === 'error'   → retry queue   (up to MAX_RETRIES attempts)
//   status === 'crashed' → dead-letter queue (no automatic retry)
//
// Connectivity failures (ENOTFOUND / ECONNREFUSED / ETIMEDOUT) are always
// retried regardless of status — per LeanLoop's WhatsApp-native resiliency goal.

import type { HumanReadableLogEntry } from '@/types';
import { runMigrations, withClient } from '@/lib/db';

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 30_000;

export interface QueueEntry {
  executionId: string;
  workflowId: string;
  workflowName: string;
  status: string;
  startedAt: string;
  attempts: number;
  nextAttemptAt: string | null;
  queue: 'retry' | 'dead-letter';
  lastError?: string;
  alerted: boolean;
}

function rowToEntry(r: Record<string, unknown>): QueueEntry {
  return {
    executionId: r.execution_id as string,
    workflowId: r.workflow_id as string,
    workflowName: r.workflow_name as string,
    status: r.status as string,
    startedAt: (r.started_at as Date).toISOString(),
    attempts: r.attempts as number,
    nextAttemptAt: r.next_attempt_at
      ? (r.next_attempt_at as Date).toISOString()
      : null,
    queue: r.queue as 'retry' | 'dead-letter',
    lastError: (r.last_error as string) ?? undefined,
    alerted: r.alerted as boolean,
  };
}

export async function getQueueSnapshot(): Promise<QueueEntry[]> {
  await runMigrations();
  return withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT * FROM leanloop_queue ORDER BY started_at DESC LIMIT 200`,
    );
    return rows.map(rowToEntry);
  });
}

export async function enqueueFailure(
  log: HumanReadableLogEntry & { workflowId: string },
): Promise<QueueEntry | null> {
  if (!log.queue) return null;
  await runMigrations();
  return withClient(async (c) => {
    // ON CONFLICT DO NOTHING — don't re-enqueue an execution we already know
    // about (would reset attempt counters).
    const nextAttemptAt = new Date(Date.now() + BASE_BACKOFF_MS);
    const { rows } = await c.query(
      `INSERT INTO leanloop_queue
         (execution_id, workflow_id, workflow_name, status, started_at, queue, next_attempt_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (execution_id) DO NOTHING
       RETURNING *`,
      [
        log.id,
        log.workflowId,
        log.workflowName,
        log.status,
        log.startedAt,
        log.queue,
        log.queue === 'retry' ? nextAttemptAt : null,
      ],
    );
    if (rows.length === 0) {
      const existing = await c.query(
        `SELECT * FROM leanloop_queue WHERE execution_id = $1`,
        [log.id],
      );
      return existing.rows[0] ? rowToEntry(existing.rows[0]) : null;
    }
    return rowToEntry(rows[0]);
  });
}

export async function recordRetryOutcome(
  executionId: string,
  outcome: 'success' | 'failed',
  error?: string,
): Promise<QueueEntry | null> {
  await runMigrations();
  return withClient(async (c) => {
    if (outcome === 'success') {
      await c.query(`DELETE FROM leanloop_queue WHERE execution_id = $1`, [executionId]);
      return null;
    }
    const { rows: current } = await c.query(
      `SELECT attempts FROM leanloop_queue WHERE execution_id = $1`,
      [executionId],
    );
    if (current.length === 0) return null;

    const newAttempts = (current[0].attempts as number) + 1;
    const promotedToDlq = newAttempts >= MAX_RETRIES;
    const nextAt = promotedToDlq
      ? null
      : new Date(Date.now() + BASE_BACKOFF_MS * Math.pow(2, newAttempts));

    const { rows } = await c.query(
      `UPDATE leanloop_queue
         SET attempts = $2,
             last_error = $3,
             queue = $4,
             next_attempt_at = $5
       WHERE execution_id = $1
       RETURNING *`,
      [
        executionId,
        newAttempts,
        error ?? null,
        promotedToDlq ? 'dead-letter' : 'retry',
        nextAt,
      ],
    );
    return rows[0] ? rowToEntry(rows[0]) : null;
  });
}

export async function markAlerted(executionId: string): Promise<void> {
  await withClient((c) =>
    c.query(`UPDATE leanloop_queue SET alerted = TRUE WHERE execution_id = $1`, [
      executionId,
    ]),
  );
}

export function isConnectivityError(message: string | undefined): boolean {
  if (!message) return false;
  return /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|EAI_AGAIN/.test(message);
}

// Convenience for /api/queue/process — returns execution IDs that are in the
// retry queue and due for another attempt.
export async function getDueRetries(): Promise<QueueEntry[]> {
  await runMigrations();
  return withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT * FROM leanloop_queue
        WHERE queue = 'retry'
          AND next_attempt_at <= NOW()
        ORDER BY next_attempt_at ASC
        LIMIT 50`,
    );
    return rows.map(rowToEntry);
  });
}
