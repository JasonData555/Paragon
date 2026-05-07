'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Database, LayoutDashboard, Settings, Target, TrendingUp } from 'lucide-react';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Target,          label: 'Intake',    href: '/intake' },
  { icon: TrendingUp,      label: 'Offer',     href: '/offer' },
  { icon: Database,        label: 'Data',      href: '/coverage' },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-16 bg-paragon-sidebar flex flex-col items-center py-4 z-40">
      {/* Logo mark */}
      <div className="w-8 h-8 rounded-sm bg-paragon-accent-hover flex items-center justify-center mb-6">
        <BarChart3 size={16} className="text-white" />
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const active = pathname.startsWith(href);
          return (
            <SidebarItem key={href} href={href} label={label} active={active}>
              <Icon size={20} />
            </SidebarItem>
          );
        })}
      </nav>

      {/* Settings — pinned bottom */}
      <SidebarItem href="/settings" label="Settings" active={pathname.startsWith('/settings')}>
        <Settings size={20} />
      </SidebarItem>
    </aside>
  );
}

interface SidebarItemProps {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}

function SidebarItem({ href, label, active, children }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={`
        group relative flex items-center justify-center w-10 h-10 rounded-sm transition-colors duration-150
        ${active
          ? 'bg-white/15 text-white'
          : 'text-white/50 hover:bg-white/10 hover:text-white/80'}
      `}
      title={label}
    >
      {children}
      {/* Tooltip */}
      <span className="pointer-events-none absolute left-full ml-3 px-2 py-1 text-xs text-white bg-paragon-text-primary rounded-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
        {label}
      </span>
    </Link>
  );
}
