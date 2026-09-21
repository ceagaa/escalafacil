export function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} aria-hidden="true" />
  );
}

export function SkeletonCard({ lines = 3, className = "" }) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-card ${className}`} aria-hidden="true">
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        {lines > 0 && <Skeleton className="h-3 w-full" />}
        {lines > 1 && <Skeleton className="h-3 w-5/6" />}
        {lines > 2 && <Skeleton className="h-3 w-2/3" />}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={`h-4 ${j === 0 ? "w-1/4" : "w-1/6"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="rounded-card bg-white p-9 shadow-card" aria-hidden="true">
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
