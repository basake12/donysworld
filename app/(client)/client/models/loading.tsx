export default function ModelsLoading() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-48 rounded-lg bg-secondary animate-pulse" />
      <div className="h-10 w-full rounded-lg bg-secondary animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="h-72 bg-secondary shimmer" />
            <div className="p-4 space-y-3">
              <div className="h-5 w-32 rounded bg-secondary animate-pulse" />
              <div className="h-3 w-24 rounded bg-secondary animate-pulse" />
              <div className="grid grid-cols-3 gap-1.5">
                {[1,2,3].map(j => (
                  <div key={j} className="h-12 rounded-xl bg-secondary animate-pulse" />
                ))}
              </div>
              <div className="h-10 w-full rounded-xl bg-secondary animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}