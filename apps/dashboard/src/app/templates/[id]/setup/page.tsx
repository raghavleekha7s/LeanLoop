import { notFound } from 'next/navigation';
import { getTemplate } from '@/lib/templates';
import { TemplateSetupWizard } from '@/components/TemplateSetupWizard';

export const dynamic = 'force-dynamic';

export default async function TemplateSetupPage({
  params,
}: {
  params: { id: string };
}) {
  const template = await getTemplate(params.id);
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="text-xs uppercase tracking-wider text-brand-subtle">
          {template.category}
        </div>
        <h1 className="text-3xl font-semibold text-white">{template.name}</h1>
        <p className="text-sm text-brand-subtle">{template.description}</p>
      </header>

      <TemplateSetupWizard
        templateId={template.id}
        templateName={template.name}
        requiredAccounts={template.requiredAccounts}
        variables={template.variables ?? []}
      />
    </div>
  );
}
