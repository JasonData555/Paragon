import { AuditLogTable } from '@/components/admin/AuditLog';

export const runtime = 'nodejs';

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-paragon-text-primary">Audit Log</h1>
        <p className="text-sm text-paragon-text-muted mt-1">
          Immutable record of all admin actions. Cannot be edited or deleted.
        </p>
      </div>
      <AuditLogTable />
    </div>
  );
}
