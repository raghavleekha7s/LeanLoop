import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { LeanLoopTemplate } from '@/types';

export function TemplateCard({ template }: { template: LeanLoopTemplate }) {
  return (
    <div className="rounded-lg border border-brand-line bg-brand-surface p-5 flex flex-col gap-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-brand-subtle">
          {template.category}
        </div>
        <h3 className="mt-1 text-lg font-semibold text-white">{template.name}</h3>
        <p className="mt-1 text-sm text-brand-subtle">{template.description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {template.requiredAccounts.map((a) => (
          <span
            key={a.key}
            className="text-xs px-2 py-1 rounded-md bg-brand-muted text-brand-text"
          >
            {a.label}
          </span>
        ))}
      </div>
      <Link
        href={`/templates/${template.id}/setup`}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-black hover:bg-brand-accentHi transition"
      >
        Set up <ArrowRight size={16} />
      </Link>
    </div>
  );
}
