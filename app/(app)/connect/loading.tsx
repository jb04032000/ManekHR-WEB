/**
 * Connect-wide loading fallback - the DEFAULT content skeleton shown while any
 * `/connect/*` page's Server Component resolves.
 *
 * Fills the CONTENT slot only: the shell (`DashboardLayout`) renders ABOVE this
 * Suspense boundary, so the chrome is already painted and must NOT be redrawn
 * here. Routes with their own `loading.tsx` override this. Uses the shared
 * `.skeleton` shimmer (globals.css) - a visible animated fill, NOT the
 * near-invisible cream surface token. Decorative - `aria-hidden`.
 */
export default function ConnectLoading() {
  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}
      aria-hidden
    >
      {/* Page title + subtitle */}
      <div className="skeleton" style={{ width: 180, height: 24 }} />
      <div className="skeleton" style={{ width: 280, height: 13, marginTop: 10 }} />

      {/* Content blocks */}
      <div className="mt-5 flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 120, borderRadius: 'var(--cr-radius-lg)' }}
          />
        ))}
      </div>
    </div>
  );
}
