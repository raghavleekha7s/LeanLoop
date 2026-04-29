// Loads LeanLoop template definitions.
// Templates are bundled under src/data/templates so serverless deploys (Vercel)
// can resolve them without needing to trace sibling monorepo folders.
// For self-hosted Docker, LEANLOOP_TEMPLATES_DIR can override to read from
// a bind-mounted path.

import fs from 'node:fs/promises';
import path from 'node:path';
import type { LeanLoopTemplate } from '@/types';

import customerFeedback from '@/data/templates/customer-feedback.json';
import dailySalesSummary from '@/data/templates/daily-sales-summary.json';
import demoFormToSheets from '@/data/templates/demo-form-to-sheets.json';
import gstFilingReminder from '@/data/templates/gst-filing-reminder.json';
import leadCapture from '@/data/templates/lead-capture.json';
import lowStockAlert from '@/data/templates/low-stock-alert.json';
import razorpayToTally from '@/data/templates/razorpay-to-tally.json';
import scheduledFactLogger from '@/data/templates/scheduled-fact-logger.json';
import shiprocketTracking from '@/data/templates/shiprocket-tracking.json';
import whatsappOrderToSheets from '@/data/templates/whatsapp-order-to-sheets.json';

// Order matters — the dashboard renders templates in this order. Demo
// templates first (zero-prep), then real MSME use cases, then templates that
// need extra accounts (WhatsApp, Razorpay, Tally, Shiprocket).
const BUNDLED: LeanLoopTemplate[] = [
  // Easy demos
  demoFormToSheets as LeanLoopTemplate,
  scheduledFactLogger as LeanLoopTemplate,
  // Real MSME use cases (Sheets only)
  leadCapture as LeanLoopTemplate,
  customerFeedback as LeanLoopTemplate,
  dailySalesSummary as LeanLoopTemplate,
  lowStockAlert as LeanLoopTemplate,
  gstFilingReminder as LeanLoopTemplate,
  // External integrations (need extra accounts)
  whatsappOrderToSheets as LeanLoopTemplate,
  razorpayToTally as LeanLoopTemplate,
  shiprocketTracking as LeanLoopTemplate,
];

async function loadFromDir(dir: string): Promise<LeanLoopTemplate[] | null> {
  const entries = await fs.readdir(dir).catch(() => null);
  if (!entries) return null;
  const out: LeanLoopTemplate[] = [];
  for (const file of entries) {
    if (!file.endsWith('.json')) continue;
    const raw = await fs.readFile(path.join(dir, file), 'utf8');
    out.push(JSON.parse(raw) as LeanLoopTemplate);
  }
  return out;
}

export async function listTemplates(): Promise<LeanLoopTemplate[]> {
  const override = process.env.LEANLOOP_TEMPLATES_DIR;
  if (override) {
    const fromDisk = await loadFromDir(override);
    if (fromDisk && fromDisk.length) return fromDisk;
  }
  return BUNDLED;
}

export async function getTemplate(id: string): Promise<LeanLoopTemplate | null> {
  const all = await listTemplates();
  return all.find((t) => t.id === id) ?? null;
}
