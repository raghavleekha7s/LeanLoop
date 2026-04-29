// Next.js instrumentation hook — runs once per server boot, outside the
// request lifecycle. We use it to:
//   1. Run DB migrations (idempotent).
//   2. Start a cron that polls n8n for failures every 60 seconds.
//
// Only runs in the Node.js runtime (not Edge).

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.LEANLOOP_DISABLE_CRON === '1') return;

  // Hide the imports from webpack's static analyzer — pg has Node-only
  // dependencies that webpack tries to bundle otherwise. At runtime Node
  // resolves these normally. Function() constructor breaks the import graph.
  const dynImport: (p: string) => Promise<any> = Function(
    'p',
    'return import(p)',
  ) as any;
  const { runMigrations } = await dynImport('./lib/db');
  const cron = (await dynImport('node-cron')).default;

  try {
    await runMigrations();
  } catch (e) {
    console.warn('[instrumentation] migration at boot failed:', e);
  }

  const selfUrl =
    process.env.LEANLOOP_SELF_URL ??
    `http://localhost:${process.env.PORT ?? 3000}`;

  // Every minute — cheap enough, catches failures quickly.
  cron.schedule('* * * * *', async () => {
    try {
      const res = await fetch(`${selfUrl}/api/queue/process`, { cache: 'no-store' });
      if (!res.ok) {
        console.warn(`[cron] queue process returned ${res.status}`);
      }
    } catch (e) {
      // Expected during boot if port isn't listening yet, or if n8n is down.
      if (process.env.LEANLOOP_DEBUG_CRON === '1') {
        console.warn('[cron] queue process error:', e);
      }
    }
  });

  console.log('[instrumentation] queue processor cron scheduled (every 1m)');
}
