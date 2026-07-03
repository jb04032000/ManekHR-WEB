export default function LeaveSettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-surface-2" />
        <div>
          <div className="mb-2 h-5 w-44 rounded bg-surface-2" />
          <div className="h-3.5 w-72 rounded bg-surface-2" />
        </div>
      </div>
      {/* Two cards */}
      {[5, 4].map((rows, i) => (
        <div key={i} className="mb-6 rounded-xl border border-[var(--cr-border)] bg-surface p-5">
          <div className="mb-3 h-4 w-40 rounded bg-surface-2" />
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="mb-2.5 h-8 w-full rounded bg-surface-2" />
          ))}
        </div>
      ))}
    </div>
  );
}
