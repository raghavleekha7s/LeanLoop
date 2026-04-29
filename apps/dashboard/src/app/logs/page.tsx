import { getHumanReadableLogs } from '@/lib/n8n-client';

export const dynamic = 'force-dynamic';

function QueueBadge({ queue }: { queue: 'retry' | 'dead-letter' | null | undefined }) {
  if (!queue) return null;
  const cls =
    queue === 'retry'
      ? 'bg-yellow-900/40 text-brand-warn'
      : 'bg-red-900/40 text-brand-danger';
  const label = queue === 'retry' ? 'Retry queue' : 'Dead letter';
  return <span className={`text-xs px-2 py-1 rounded-md ${cls}`}>{label}</span>;
}

export default async function LogsPage() {
  const logs = await getHumanReadableLogs(50).catch(() => []);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-white">Logs</h1>
        <p className="text-sm text-brand-subtle">
          Human-readable execution history, newest first.
        </p>
      </header>

      {logs.length === 0 ? (
        <div className="rounded-lg border border-brand-line bg-brand-surface p-6 text-sm text-brand-subtle">
          No executions yet — activate a template to see activity here.
        </div>
      ) : (
        <div className="rounded-lg border border-brand-line bg-brand-surface divide-y divide-brand-line">
          {logs.map((l) => (
            <div key={l.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-white">{l.humanMessage}</div>
                <div className="text-xs text-brand-subtle">
                  {new Date(l.startedAt).toLocaleString()}
                </div>
              </div>
              <QueueBadge queue={l.queue} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
