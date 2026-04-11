export default function AdminDashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-xl bg-secondary" />
          <div className="h-3.5 w-52 rounded-lg bg-secondary/60" />
        </div>
        <div className="h-10 w-40 rounded-xl bg-secondary" />
      </div>

      {/* Revenue card */}
      <div className="rounded-2xl border border-border bg-card h-36" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="h-9 w-9 rounded-xl bg-secondary" />
            <div className="space-y-1.5">
              <div className="h-5 w-14 rounded bg-secondary" />
              <div className="h-3 w-20 rounded bg-secondary/60" />
            </div>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        <div className="h-5 w-36 rounded-lg bg-secondary" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-secondary shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 rounded bg-secondary" />
              <div className="h-3 w-44 rounded bg-secondary/60" />
            </div>
            <div className="h-8 w-20 rounded-xl bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}