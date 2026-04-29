// Minimal WhatsApp Business API client for operator alerts.
// Uses Meta's Cloud API — https://developers.facebook.com/docs/whatsapp/cloud-api
// Server-side only.

const TOKEN = process.env.WHATSAPP_API_TOKEN ?? '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
const RECIPIENT = process.env.WHATSAPP_ALERT_RECIPIENT ?? '';
const API_VERSION = 'v20.0';

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendWhatsAppAlert(message: string): Promise<SendResult> {
  if (!TOKEN || !PHONE_NUMBER_ID || !RECIPIENT) {
    // Keep the dashboard functional even when the alert channel is not
    // configured — operators can wire it up later.
    return { ok: false, skipped: true, error: 'WhatsApp credentials not configured' };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: RECIPIENT,
          type: 'text',
          text: { body: message },
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `WhatsApp API ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Formats an execution failure into a short, human message suitable for a
// phone notification. Kept under ~300 chars — WhatsApp displays the preview.
export function formatFailureMessage(opts: {
  workflowName: string;
  status: string;
  queue: 'retry' | 'dead-letter';
  startedAt: string;
  executionId: string;
}): string {
  const when = new Date(opts.startedAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
  });
  const queueLabel = opts.queue === 'retry' ? 'retry queue' : 'dead-letter queue';
  return (
    `⚠️ LeanLoop alert\n` +
    `${opts.workflowName} — ${opts.status}\n` +
    `Moved to ${queueLabel}.\n` +
    `At ${when} IST · #${opts.executionId}`
  );
}
