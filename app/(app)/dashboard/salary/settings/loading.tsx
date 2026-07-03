/**
 * Suspense-level skeleton for the Salary Settings page.
 * Mirrors the page layout: header, tab bar, and stacked form-card
 * skeletons matching the settings form chrome.
 *
 * Server Component - no 'use client'. aria-label uses a plain string
 * (not useTranslations()) because that hook requires a Client Component.
 */
export default function SalarySettingsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl animate-pulse p-6"
      role="status"
      aria-busy="true"
      aria-label="Loading salary settings"
    >
      {/* Page header skeleton */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div>
          <div className="mb-2 h-5 w-48 rounded bg-gray-100" />
          <div className="h-3.5 w-80 rounded bg-gray-100" />
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className="mb-6 flex gap-6 border-b border-[var(--cr-border)] pb-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-28 rounded-t bg-gray-100" />
        ))}
      </div>

      {/* Form card skeletons */}
      <div className="flex flex-col gap-6">
        <div className="max-w-[42rem] rounded-xl border border-[var(--cr-border-light)] bg-white p-6">
          <div className="mb-5 h-4 w-40 rounded bg-gray-100" />
          <div className="flex flex-col gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="h-3.5 w-36 rounded bg-gray-100" />
                <div className="h-10 w-full rounded-lg bg-gray-100" />
              </div>
            ))}
          </div>
          <div className="mt-6 h-10 w-32 rounded-lg bg-gray-100" />
        </div>

        <div className="max-w-[42rem] rounded-xl border border-[var(--cr-border-light)] bg-white p-6">
          <div className="mb-5 h-4 w-48 rounded bg-gray-100" />
          <div className="flex flex-col gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="h-3.5 w-44 rounded bg-gray-100" />
                  <div className="h-3 w-64 rounded bg-gray-100" />
                </div>
                <div className="h-6 w-11 rounded-full bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
