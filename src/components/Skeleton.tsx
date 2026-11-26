export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-tile bg-[var(--ef-hover)] ${className}`} aria-hidden="true" />
  );
}



export function SkeletonStat() {
  return (
    <div className="ef-card p-7" aria-hidden="true">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}
