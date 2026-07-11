import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Answerspot',
  description: 'AI answer-monitoring for local service businesses',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <a href="/" className="text-lg font-bold tracking-tight text-slate-900">
              Answerspot
            </a>
            <nav className="flex gap-4 text-sm text-slate-600">
              <a href="/onboard" className="hover:text-slate-900">
                Free scan
              </a>
              <a href="/pricing" className="hover:text-slate-900">
                Pricing
              </a>
              <a href="/login" className="hover:text-slate-900">
                Login
              </a>
              <a href="/dashboard" className="hover:text-slate-900">
                Dashboard
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
