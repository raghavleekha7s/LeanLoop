import { Activity, CheckCircle2, AlertTriangle, Wifi } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { getDashboardHealth } from '@/lib/n8n-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const health = await getDashboardHealth();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-brand-subtle">
          Health and activity for your LeanLoop automations.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="n8n engine"
          value={health.n8nReachable ? 'Online' : 'Offline'}
          icon={Wifi}
          tone={health.n8nReachable ? 'good' : 'bad'}
        />
        <StatCard
          label="Active workflows"
          value={health.activeWorkflows}
          icon={CheckCircle2}
          tone="good"
        />
        <StatCard label="Tasks today" value={health.tasksToday} icon={Activity} />
        <StatCard
          label="Failures today"
          value={health.failuresToday}
          icon={AlertTriangle}
          tone={health.failuresToday > 0 ? 'warn' : 'default'}
        />
      </section>

      <section className="rounded-lg border border-brand-line bg-brand-surface p-6">
        <h2 className="text-lg font-semibold text-white">Get started</h2>
        <p className="mt-1 text-sm text-brand-subtle">
          Pick a template, connect your accounts, and activate — that&apos;s it.
        </p>
        <a
          href="/templates"
          className="mt-4 inline-flex items-center rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-black hover:bg-brand-accentHi transition"
        >
          Browse templates
        </a>
      </section>
    </div>
  );
}
