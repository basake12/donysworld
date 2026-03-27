export default function AdminDashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-secondary" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-secondary" />
            <div className="h-8 w-20 rounded bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}