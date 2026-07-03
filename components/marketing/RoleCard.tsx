import { ICONS } from './icons';

/**
 * One audience ("persona") card in the Roles section - icon tile that
 * inverts on hover, ordinal, a hairline divider, and dotted bullets.
 * Strings arrive pre-translated.
 */
export function RoleCard({
  no,
  icon,
  title,
  bullets,
}: {
  no: string;
  icon: string;
  title: string;
  bullets: string[];
}) {
  const Ic = ICONS[icon];
  return (
    <article className="group flex h-full flex-col rounded-[16px] border border-[var(--cr-neutral-200)] bg-white p-6 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[var(--cr-indigo-200)] hover:shadow-[0_18px_40px_-18px_rgba(11,110,79,0.28)]">
      <div className="flex items-start justify-between">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--cr-indigo-50)] text-[var(--cr-indigo-600)] transition-colors duration-200 group-hover:bg-[var(--cr-indigo-600)] group-hover:text-white">
          {Ic ? <Ic className="h-[23px] w-[23px]" /> : null}
        </span>
        <span className="mkt-mono text-[0.78rem] font-semibold text-[var(--cr-neutral-300)]">
          {no}
        </span>
      </div>
      <h3 className="pt-4 text-[1.18rem]">{title}</h3>
      <div className="my-[14px] border-t border-[var(--cr-neutral-200)]" aria-hidden="true" />
      <ul className="flex flex-col gap-2.5">
        {bullets.map((bullet) => (
          <li
            key={bullet}
            className="relative pl-[18px] text-[0.9rem] leading-snug text-[var(--cr-neutral-600)]"
          >
            <span
              className="absolute top-[0.5em] left-0 h-[7px] w-[7px] rounded-full"
              style={{ background: 'var(--cr-gold-500)' }}
              aria-hidden="true"
            />
            {bullet}
          </li>
        ))}
      </ul>
    </article>
  );
}
