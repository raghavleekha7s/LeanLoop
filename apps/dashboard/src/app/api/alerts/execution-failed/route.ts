import { NextResponse } from 'next/server';
import { formatFailureMessage, sendWhatsAppAlert } from '@/lib/whatsapp';

// POST /api/alerts/execution-failed
// Called from an n8n "Error Workflow" or from the internal queue processor
// whenever an execution lands in the retry or dead-letter queue.
//
// Body: {
//   executionId: string,
//   workflowName: string,
//   status: string,
//   startedAt: string (ISO),
//   queue: 'retry' | 'dead-letter'
// }

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    executionId?: string;
    workflowName?: string;
    status?: string;
    startedAt?: string;
    queue?: 'retry' | 'dead-letter';
  } | null;

  if (
    !body ||
    !body.executionId ||
    !body.workflowName ||
    !body.status ||
    !body.startedAt ||
    !body.queue
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const message = formatFailureMessage({
    executionId: body.executionId,
    workflowName: body.workflowName,
    status: body.status,
    startedAt: body.startedAt,
    queue: body.queue,
  });

  const result = await sendWhatsAppAlert(message);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
