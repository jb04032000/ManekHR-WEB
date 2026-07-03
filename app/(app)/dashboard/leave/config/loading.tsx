export default function LeaveConfigLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-surface-2" />
        <div>
          <div className="mb-2 h-5 w-48 rounded bg-surface-2" />
          <div className="h-3.5 w-80 rounded bg-surface-2" />
        </div>
      </div>
      {/* Leave-type cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--cr-border)] bg-surface p-4">
            <div className="mb-3 h-4 w-32 rounded bg-surface-2" />
            {[1, 2, 3].map((r) => (
              <div key={r} className="mb-2 h-3.5 w-full rounded bg-surface-2" />
            ))}
            <div className="mt-4 h-8 w-full rounded-lg bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
