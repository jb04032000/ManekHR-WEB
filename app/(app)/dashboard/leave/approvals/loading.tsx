export default function LeaveApprovalsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-surface-2" />
        <div>
          <div className="mb-2 h-5 w-44 rounded bg-surface-2" />
          <div className="h-3.5 w-72 rounded bg-surface-2" />
        </div>
      </div>
      {/* Filters */}
      <div className="mb-4 flex justify-between">
        <div className="h-8 w-48 rounded-lg bg-surface-2" />
        <div className="h-8 w-64 rounded-lg bg-surface-2" />
      </div>
      {/* Table */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-surface p-4">
        {[1, 2, 3, 4, 5, 6].map((r) => (
          <div key={r} className="mb-3 h-9 w-full rounded bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
