export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-xl bg-secondary" />
          <div className="h-3.5 w-56 rounded-lg bg-secondary/60" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-secondary" />
      </div>

      {/* Wallet hero */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-secondary" />
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-3 w-32 rounded bg-secondary" />
              <div className="h-9 w-36 rounded-xl bg-secondary" />
              <div className="h-3 w-24 rounded bg-secondary/60" />
            </div>
            <div className="h-14 w-14 rounded-2xl bg-secondary" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-10 rounded-xl bg-secondary" />
            <div className="flex-1 h-10 rounded-xl bg-secondary/60" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="h-8 w-8 rounded-xl bg-secondary" />
            <div className="space-y-1">
              <div className="h-5 w-10 rounded bg-secondary" />
              <div className="h-3 w-16 rounded bg-secondary/60" />
            </div>
          </div>
        ))}
      </div>

      {/* Recent offers */}
      <div className="space-y-2">
        <div className="h-5 w-28 rounded-lg bg-secondary" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-secondary shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-28 rounded bg-secondary" />
              <div className="h-3 w-40 rounded bg-secondary/60" />
              <div className="h-3 w-20 rounded bg-secondary/40" />
            </div>
            <div className="h-6 w-20 rounded-lg bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}