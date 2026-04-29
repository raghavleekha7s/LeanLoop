import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-brand-accent'
      : tone === 'warn'
      ? 'text-brand-warn'
      : tone === 'bad'
      ? 'text-brand-danger'
      : 'text-white';

  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-brand-subtle">{label}</span>
        <Icon size={16} className="text-brand-subtle" />
      </div>
      <div className={`mt-3 text-3xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
