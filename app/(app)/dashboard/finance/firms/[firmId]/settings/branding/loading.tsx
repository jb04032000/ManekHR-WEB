/**
 * Suspense-level skeleton for the finance branding editor.
 * Mirrors the page layout: header, info banner, and stacked section/form
 * skeletons matching the branding form chrome.
 *
 * Server Component - no 'use client'. aria-label uses a plain string (not
 * useTranslations()) because that hook requires a Client Component; this is a
 * brief transitional frame only.
 */
export default function FirmBrandingLoading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl animate-pulse px-4 py-6 md:px-6"
      role="status"
      aria-busy="true"
      aria-label="Loading branding settings"
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

      {/* Section skeletons */}
      <div className="flex flex-col gap-9">
        {[1, 2, 3].map((section) => (
          <div key={section} className="space-y-4">
            <div className="space-y-1.5">
              <div className="h-3 w-28 rounded bg-gray-100" />
              <div className="h-4 w-44 rounded bg-gray-100" />
              <div className="h-3 w-72 rounded bg-gray-100" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[1, 2].map((field) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <div className="h-3.5 w-32 rounded bg-gray-100" />
                  <div className="h-10 w-full rounded-lg bg-gray-100" />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Save bar skeleton */}
        <div className="mt-1 h-10 w-32 rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}
