import { Sidebar } from '@/components/shared/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex bg-paragon-surface-primary" style={{ height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main className="flex-1 ml-16" style={{ height: '100vh', overflow: 'hidden' }}>
        {children}
      </main>
    </div>
  );
}
