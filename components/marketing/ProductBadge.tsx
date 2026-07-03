/**
 * Pill badge marking a product section. The two products carry distinct
 * colours throughout the site - Connect = indigo, ERP = gold - matching
 * the dotted product links in the navbar.
 */
export function ProductBadge({ label, tone }: { label: string; tone: 'connect' | 'erp' }) {
  const isConnect = tone === 'connect';
  return (
    <span
      className="mkt-mono inline-flex items-center gap-2 rounded-full px-3.5 py-[7px] text-[0.75rem] font-semibold tracking-[0.06em] uppercase"
      style={{
        background: isConnect ? 'var(--cr-indigo-600)' : 'var(--cr-gold-500)',
        color: isConnect ? '#ffffff' : 'var(--cr-indigo-800)',
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: isConnect ? 'var(--cr-gold-400)' : 'var(--cr-indigo-700)' }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
