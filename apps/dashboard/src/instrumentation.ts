// Next.js instrumentation hook — runs once per server boot, outside the
// request lifecycle. We use it to:
//   1. Run DB migrations (idempotent).
//   2. Start a cron that polls /api/queue/process every minute.
//
// Notes for the bundler:
//   - Only runs in the Node.js runtime (not Edge).
//   - All side-effecting imports happen *inside* register() so the bundler
//     doesn't pull pg/node-cron into the Edge runtime bundle. We don't need
//     the Function() trick because pg + node-cron are in
//     `serverComponentsExternalPackages` (next.config.mjs), so they're
//     resolved at runtime instead of bundled.
//   - Set LEANLOOP_DISABLE_CRON=1 to skip the cron entirely (Vercel /
//     serverless deploys). Migrations still run.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Migrations are safe to run anywhere a DB is reachable — keep them
  // outside the cron gate so a one-shot `next start` still applies them.
  try {
    const { runMigrations } = await import('@/lib/db');
    await runMigrations();
    console.log('[instrumentation] migrations applied');
  } catch (e) {
    console.warn('[instrumentation] migration at boot skipped:', (e as Error).message);
  }

  if (process.env.LEANLOOP_DISABLE_CRON === '1') {
    console.log('[instrumentation] cron disabled via LEANLOOP_DISABLE_CRON=1');
    return;
  }

  let cron: typeof import('node-cron');
  try {
    cron = await import('node-cron');
  } catch (e) {
    console.warn('[instrumentation] node-cron unavailable, skipping queue cron:', (e as Error).message);
    return;
  }

  const selfUrl =
    process.env.LEANLOOP_SELF_URL ??
    `http://localhost:${process.env.PORT ?? 3000}`;

  // Every minute — cheap, catches failures quickly.
  cron.schedule('* * * * *', async () => {
    try {
      const res = await fetch(`${selfUrl}/api/queue/process`, { cache: 'no-store' });
      if (!res.ok) {
        console.warn(`[cron] queue process returned ${res.status}`);
      }
    } catch (e) {
      if (process.env.LEANLOOP_DEBUG_CRON === '1') {
        console.warn('[cron] queue process error:', e);
      }
    }
  });

  console.log('[instrumentation] queue processor cron scheduled (every 1m)');
}
