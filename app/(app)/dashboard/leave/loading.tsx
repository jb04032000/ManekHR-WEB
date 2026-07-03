export default function LeaveIndexLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse p-6" aria-busy="true">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-surface-2" />
        <div>
          <div className="mb-2 h-5 w-40 rounded bg-surface-2" />
          <div className="h-3.5 w-64 rounded bg-surface-2" />
        </div>
      </div>
      {/* Body */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-surface p-4">
        {[1, 2, 3, 4].map((r) => (
          <div key={r} className="mb-3 h-9 w-full rounded bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
