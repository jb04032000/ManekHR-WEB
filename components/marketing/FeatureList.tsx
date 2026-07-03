/**
 * Numbered feature rows used inside the Connect / ERP product sections.
 * Each row nudges right on hover.
 */
export function FeatureList({ items }: { items: { no: string; title: string; desc: string }[] }) {
  return (
    <div className="mt-7 border-t border-[var(--cr-neutral-200)]">
      {items.map((item) => (
        <div
          key={item.no}
          className="flex gap-[18px] border-b border-[var(--cr-neutral-200)] py-5 transition-[padding-left] duration-200 hover:pl-2"
        >
          <span className="mkt-mono shrink-0 pt-1 text-[0.8rem] font-semibold text-[var(--cr-gold-700)]">
            {item.no}
          </span>
          <div>
            <h3 className="text-[1.1rem]">{item.title}</h3>
            <p className="pt-1.5 text-[0.95rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
              {item.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
