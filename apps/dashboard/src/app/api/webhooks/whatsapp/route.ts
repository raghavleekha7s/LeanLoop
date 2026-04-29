// Meta WhatsApp Cloud API webhook receiver.
// Two responsibilities:
//   1. GET — Meta's subscription handshake. Must echo `hub.challenge` if our
//      `hub.verify_token` matches the one configured in .env.
//   2. POST — forward the message payload to the n8n webhook so the activated
//      workflow can process it. We don't process messages here; we just relay
//      so all per-template logic stays inside n8n where it belongs.
//
// Meta delivers all webhooks for a Phone Number ID to the same URL — fan-out
// to multiple templates is handled by routing inside n8n (Switch node) once
// we have more than one WhatsApp-receive template.

import { NextRequest, NextResponse } from 'next/server';

const N8N_INTERNAL_URL = process.env.N8N_INTERNAL_URL ?? 'http://n8n:5678';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? '';
// Path of the webhook node inside the activated n8n workflow (matches the
// `path` field in packages/templates/whatsapp-order-to-sheets.json).
const N8N_WEBHOOK_PATH = process.env.WHATSAPP_N8N_PATH ?? 'whatsapp-order';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (!VERIFY_TOKEN) {
    return new NextResponse(
      'WHATSAPP_VERIFY_TOKEN not configured in dashboard env',
      { status: 500 },
    );
  }
  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    // Meta expects the challenge echoed back as plain text.
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return new NextResponse('forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  // Read the raw body so we can forward verbatim and keep a copy for logs.
  const body = await req.text();

  // Forward to n8n's webhook endpoint. n8n accepts both /webhook/<path>
  // (production) and /webhook-test/<path> (test mode). Try production first
  // and fall back if the workflow isn't activated yet — that gives a useful
  // dev signal in the n8n UI without a 404 here.
  const target = `${N8N_INTERNAL_URL}/webhook/${N8N_WEBHOOK_PATH}`;

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': req.headers.get('content-type') ?? 'application/json',
        // Pass through Meta signature header so n8n can verify if it wants.
        'X-Hub-Signature-256': req.headers.get('x-hub-signature-256') ?? '',
      },
      body,
      // Meta retries if we don't ack within ~20s — never block the response.
      signal: AbortSignal.timeout(15_000),
    });

    // Meta only cares about the HTTP status — return 200 unless n8n itself
    // failed in a way we can't recover from.
    if (!upstream.ok && upstream.status !== 404) {
      console.warn(
        `[whatsapp-webhook] n8n ${target} → ${upstream.status} ${upstream.statusText}`,
      );
    }
  } catch (err) {
    console.warn('[whatsapp-webhook] forward failed:', err);
    // Still return 200 — Meta will retry, and we don't want to be marked
    // unreachable for transient n8n outages. The retry queue will catch
    // missed executions.
  }

  return NextResponse.json({ ok: true });
}
