// Loads LeanLoop template definitions.
// Templates are bundled under src/data/templates so serverless deploys (Vercel)
// can resolve them without needing to trace sibling monorepo folders.
// For self-hosted Docker, LEANLOOP_TEMPLATES_DIR can override to read from
// a bind-mounted path.

import fs from 'node:fs/promises';
import path from 'node:path';
import type { LeanLoopTemplate } from '@/types';

import razorpayToTally from '@/data/templates/razorpay-to-tally.json';
import shiprocketTracking from '@/data/templates/shiprocket-tracking.json';
import whatsappOrderToSheets from '@/data/templates/whatsapp-order-to-sheets.json';

const BUNDLED: LeanLoopTemplate[] = [
  razorpayToTally as LeanLoopTemplate,
  shiprocketTracking as LeanLoopTemplate,
  whatsappOrderToSheets as LeanLoopTemplate,
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
