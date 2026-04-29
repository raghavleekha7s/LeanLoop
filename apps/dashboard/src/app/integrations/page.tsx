import { Plug } from 'lucide-react';

const integrations = [
  { key: 'whatsapp', name: 'WhatsApp Business', status: 'Scaffolded' },
  { key: 'razorpay', name: 'Razorpay', status: 'Scaffolded' },
  { key: 'tally', name: 'Tally', status: 'Scaffolded' },
  { key: 'shiprocket', name: 'Shiprocket', status: 'Scaffolded' },
  { key: 'gst-invoice', name: 'GST Invoice', status: 'Scaffolded' },
  { key: 'google-sheets', name: 'Google Sheets', status: 'Built-in (n8n)' },
];

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-white">Integrations</h1>
        <p className="text-sm text-brand-subtle">
          Available services. OAuth connect flow will live here.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {integrations.map((i) => (
          <div
            key={i.key}
            className="flex items-center justify-between rounded-lg border border-brand-line bg-brand-surface p-4"
          >
            <div className="flex items-center gap-3">
              <Plug size={18} className="text-brand-subtle" />
              <span className="text-white">{i.name}</span>
            </div>
            <span className="text-xs text-brand-subtle">{i.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
