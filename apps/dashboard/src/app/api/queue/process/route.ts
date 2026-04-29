import { NextResponse } from 'next/server';
import { getHumanReadableLogs, listWorkflows, retryExecution } from '@/lib/n8n-client';
import {
  enqueueFailure,
  getDueRetries,
  getQueueSnapshot,
  markAlerted,
  recordRetryOutcome,
} from '@/lib/queue';
import { formatFailureMessage, sendWhatsAppAlert } from '@/lib/whatsapp';

// GET /api/queue/process
// Polled on a cron (every 60s via instrumentation.ts) — pulls recent n8n
// failures, puts them on the retry / dead-letter queue, fires a WhatsApp
// alert for each new entry, and kicks off any retries that are due.
//
// GET /api/queue/process?peek=1 — snapshot only, no side effects.

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('peek') === '1') {
    return NextResponse.json({ queue: await getQueueSnapshot() });
  }

  try {
    const [logs, workflows] = await Promise.all([
      getHumanReadableLogs(100),
      listWorkflows().catch(() => [] as { id: string; name: string }[]),
    ]);
    const workflowIdByName = new Map(workflows.map((w) => [w.name, w.id]));

    // 1. Ingest any newly failed executions from n8n.
    const alerted: string[] = [];
    for (const log of logs) {
      if (!log.queue) continue;
      const workflowId = workflowIdByName.get(log.workflowName) ?? '';
      const entry = await enqueueFailure({ ...log, workflowId });
      if (entry && !entry.alerted) {
        const message = formatFailureMessage({
          executionId: entry.executionId,
          workflowName: entry.workflowName,
          status: entry.status,
          startedAt: entry.startedAt,
          queue: entry.queue,
        });
        await sendWhatsAppAlert(message);
        await markAlerted(entry.executionId);
        alerted.push(entry.executionId);
      }
    }

    // 2. Fire retries for anything due.
    const due = await getDueRetries();
    const retried: string[] = [];
    for (const entry of due) {
      try {
        await retryExecution(entry.executionId);
        await recordRetryOutcome(entry.executionId, 'success');
        retried.push(entry.executionId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await recordRetryOutcome(entry.executionId, 'failed', msg);
      }
    }

    return NextResponse.json({
      processed: logs.length,
      alerted: alerted.length,
      retried: retried.length,
      queue: await getQueueSnapshot(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
