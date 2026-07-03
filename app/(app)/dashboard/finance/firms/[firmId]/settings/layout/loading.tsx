/**
 * Suspense-level skeleton for the invoice layout settings editor.
 * Mirrors the branding loading.tsx layout: header, info banner, and toggle
 * row skeletons matching the layout settings form chrome.
 *
 * Server Component - no 'use client'. aria-label uses a plain string (not
 * useTranslations()) because that hook requires a Client Component; this is a
 * brief transitional frame only.
 */
export default function FirmLayoutSettingsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl animate-pulse px-4 py-6 md:px-6"
      role="status"
      aria-busy="true"
      aria-label="Loading layout settings"
    >
      {/* Page header skeleton */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div>
          <div className="mb-2 h-5 w-52 rounded bg-gray-100" />
          <div className="h-3.5 w-80 rounded bg-gray-100" />
        </div>
      </div>

      {/* Info banner skeleton */}
      <div className="mb-6 h-12 w-full rounded-xl bg-gray-100" />

      {/* Toggle row skeletons */}
      <div className="flex flex-col gap-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-4 py-3">
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 rounded bg-gray-100" />
              <div className="h-3 w-72 rounded bg-gray-100" />
            </div>
            <div className="h-6 w-11 rounded-full bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Save bar skeleton */}
      <div className="mt-6 h-10 w-32 rounded-lg bg-gray-100" />
    </div>
  );
}
