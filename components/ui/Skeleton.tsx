'use client';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-skeleton-pulse rounded bg-paragon-border ${className}`}
      aria-hidden="true"
    />
  );
}

export function OutputSkeleton() {
  return (
    <div className="space-y-4 mt-6">
      {/* Statement card skeleton */}
      <div className="card p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-4/5 mb-2" />
        <Skeleton className="h-3 w-3/5" />
      </div>

      {/* Comp band skeleton */}
      <div className="card p-5">
        <Skeleton className="h-4 w-48 mb-4" />
        {[0,1,2,3,4].map(i => (
          <div key={i} className="flex gap-4 mb-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Two half-width skeletons */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <Skeleton className="h-4 w-40 mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {[0,1,2,3].map(i => (
              <div key={i} className="border border-paragon-border rounded-sm p-3">
                <Skeleton className="h-6 w-12 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-32 mb-4" />
          {[0,1,2,3].map(i => (
            <div key={i} className="flex gap-2 items-center mb-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
