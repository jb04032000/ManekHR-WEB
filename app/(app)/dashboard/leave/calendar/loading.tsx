export default function LeaveCalendarLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-surface-2" />
        <div>
          <div className="mb-2 h-5 w-48 rounded bg-surface-2" />
          <div className="h-3.5 w-72 rounded bg-surface-2" />
        </div>
      </div>
      {/* Controls + stat tiles */}
      <div className="mb-4 flex gap-3">
        <div className="h-8 w-36 rounded-lg bg-surface-2" />
        <div className="h-8 w-56 rounded-lg bg-surface-2" />
      </div>
      <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
        <div className="h-20 rounded-xl bg-surface-2" />
        <div className="h-20 rounded-xl bg-surface-2" />
      </div>
      {/* Grid */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-surface p-4">
        {[1, 2, 3, 4, 5, 6].map((r) => (
          <div key={r} className="mb-3 h-8 w-full rounded bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
