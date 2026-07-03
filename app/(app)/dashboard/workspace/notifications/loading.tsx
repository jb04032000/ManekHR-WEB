// Co-located route skeleton for the workspace notification-policy page (AC-3.5,
// binding rule in crewroster-web/CLAUDE.md). Mirrors the page: header (title +
// subtitle), then one settings card with a section heading row, a master toggle
// row, three channel rows, and an actions row. Server-only; aria-hidden.
export default function NotificationSettingsLoading() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      {/* Page header */}
      <div className="mb-8">
        <div className="mb-2 h-7 w-52 rounded bg-gray-100" />
        <div className="h-4 w-72 max-w-full rounded bg-gray-100" />
      </div>

      {/* Settings card */}
      <div className="mb-6 rounded-xl border border-[var(--cr-border)] bg-white p-7 shadow-card">
        {/* Section heading with icon */}
        <div className="mb-5 flex items-start gap-3">
          <div className="h-9 w-9 flex-shrink-0 rounded-[8px] bg-gray-100" />
          <div className="flex-1">
            <div className="mb-2 h-4 w-48 rounded bg-gray-100" />
            <div className="h-3 w-64 max-w-full rounded bg-gray-100" />
          </div>
        </div>
        <div className="mb-5 h-px w-full bg-gray-100" />

        {/* Master toggle row */}
        <div className="flex items-start justify-between gap-4 pb-3">
          <div className="flex-1">
            <div className="mb-2 h-4 w-40 rounded bg-gray-100" />
            <div className="h-3 w-56 max-w-full rounded bg-gray-100" />
          </div>
          <div className="h-6 w-11 rounded-full bg-gray-100" />
        </div>

        {/* Channel rows */}
        <div className="mt-4 flex flex-col gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-3">
              <div className="flex-1">
                <div className="h-4 w-28 rounded bg-gray-100" />
              </div>
              <div className="h-5 w-9 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>

        <div className="my-5 h-px w-full bg-gray-100" />
        {/* Actions */}
        <div className="h-10 w-28 rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}
