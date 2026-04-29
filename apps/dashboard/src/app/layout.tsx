import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'LeanLoop',
  description: 'Template-first workflow automation for Indian SMEs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen grid grid-cols-[240px_1fr]">
          <Sidebar />
          <main className="p-8 max-w-6xl w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}
