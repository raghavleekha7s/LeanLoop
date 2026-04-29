import { TemplateCard } from '@/components/TemplateCard';
import { listTemplates } from '@/lib/templates';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const templates = await listTemplates();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-white">Templates</h1>
        <p className="text-sm text-brand-subtle">
          Pre-configured automations — pick one, connect accounts, activate.
        </p>
      </header>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-brand-line bg-brand-surface p-6 text-sm text-brand-subtle">
          No templates found. Drop JSON files into{' '}
          <code className="text-brand-text">packages/templates/</code>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}
