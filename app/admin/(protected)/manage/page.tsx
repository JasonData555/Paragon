import { RecordTable } from '@/components/admin/RecordTable';

export default function AdminManagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-paragon-text-primary">Manage Records</h1>
        <p className="text-sm text-paragon-text-muted mt-1">
          Browse, filter, and delete survey records
        </p>
      </div>
      <RecordTable />
    </div>
  );
}
