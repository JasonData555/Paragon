import { UploadStepper } from '@/components/admin/UploadStepper';

export default function AdminUploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-paragon-text-primary">Upload Dataset</h1>
        <p className="text-sm text-paragon-text-muted mt-1">
          Import a new survey dataset (.xlsx or .csv, max 50MB)
        </p>
      </div>
      <UploadStepper />
    </div>
  );
}
