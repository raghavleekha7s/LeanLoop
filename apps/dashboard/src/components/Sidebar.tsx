import Link from 'next/link';
import { Home, LayoutTemplate, Plug, ScrollText } from 'lucide-react';

const nav = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/integrations', label: 'Integrations', icon: Plug },
  { href: '/logs', label: 'Logs', icon: ScrollText },
];

export function Sidebar() {
  return (
    <aside className="border-r border-brand-line bg-brand-surface p-6 flex flex-col gap-8">
      <div>
        <div className="text-2xl font-bold tracking-tight text-white">LeanLoop</div>
        <div className="text-xs text-brand-subtle">Low-code automation</div>
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-brand-text hover:bg-brand-muted transition"
          >
            <Icon size={18} className="text-brand-subtle" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
