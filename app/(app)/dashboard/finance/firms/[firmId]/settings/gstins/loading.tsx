/**
 * Suspense-level skeleton for the firm multi-GSTIN settings editor.
 * Mirrors gstins/page.tsx: header, info banner, primary-GSTIN card, and a couple of
 * editable GSTIN rows. Cross-link: settings/branding/loading.tsx (same chrome pattern).
 *
 * Server Component - no 'use client', no hooks. aria-label is a plain string (the
 * useTranslations hook needs a Client Component); this is a brief transitional frame.
 */
export default function FirmGstinsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl animate-pulse px-4 py-6 md:px-6"
      role="status"
      aria-busy="true"
      aria-label="Loading GSTIN settings"
    >
      {/* Page header skeleton */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div>
          <div className="mb-2 h-5 w-48 rounded bg-gray-100" />
          <div className="h-3.5 w-72 rounded bg-gray-100" />
        </div>
      </div>

      {/* Info banner skeleton */}
      <div className="mb-6 h-14 w-full rounded-xl bg-gray-100" />

      {/* Primary GSTIN card skeleton */}
      <div className="mb-5 h-16 w-full rounded-xl bg-gray-100" />

      {/* Editable rows */}
      <div className="space-y-3">
        {[1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <div className="h-9 w-60 rounded-lg bg-gray-100" />
            <div className="h-9 w-48 rounded-lg bg-gray-100" />
            <div className="h-9 w-9 rounded-lg bg-gray-100" />
          </div>
        ))}
        <div className="h-9 w-32 rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}
