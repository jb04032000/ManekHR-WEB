/**
 * Suspense-level skeleton for the invoice numbering editor.
 * Mirrors the branding loading.tsx layout: header, info banner, and a
 * table-row skeleton matching the numbering page chrome.
 *
 * Server Component - no 'use client'. aria-label uses a plain string (not
 * useTranslations()) because that hook requires a Client Component; this is a
 * brief transitional frame only.
 */
export default function FirmNumberingLoading() {
  return (
    <div
      className="mx-auto w-full max-w-4xl animate-pulse px-4 py-6 md:px-6"
      role="status"
      aria-busy="true"
      aria-label="Loading numbering settings"
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

      {/* Table header skeleton */}
      <div className="mb-2 flex items-center gap-3">
        {[180, 80, 90, 90, 120, 70].map((w, i) => (
          <div key={i} className="h-3.5 rounded bg-gray-100" style={{ width: w }} />
        ))}
      </div>

      {/* Table row skeletons */}
      <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-4 w-44 rounded bg-gray-100" />
            <div className="h-8 w-20 rounded bg-gray-100" />
            <div className="h-8 w-20 rounded bg-gray-100" />
            <div className="h-8 w-20 rounded bg-gray-100" />
            <div className="h-4 w-28 rounded bg-gray-100" />
            <div className="h-8 w-16 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
