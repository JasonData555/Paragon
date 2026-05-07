'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, LogOut } from 'lucide-react';

const NAV_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/upload',    label: 'Upload' },
  { href: '/admin/manage',    label: 'Manage' },
  { href: '/admin/audit',     label: 'Audit Log' },
];

export default function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-paragon-border px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-paragon-sidebar flex items-center justify-center">
              <BarChart3 size={14} className="text-white" />
            </div>
            <span className="text-sm font-medium text-paragon-text-primary">Paragon Admin</span>
          </div>

          <nav className="flex gap-1 ml-4">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 text-xs rounded-sm transition-colors ${
                  pathname.startsWith(href)
                    ? 'bg-paragon-mint-chip text-paragon-accent-primary font-medium'
                    : 'text-paragon-text-secondary hover:text-paragon-text-primary hover:bg-gray-100'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-paragon-text-muted hover:text-paragon-text-primary transition-colors"
        >
          <LogOut size={14} />
          Logout
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
