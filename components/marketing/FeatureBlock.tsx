import { CheckIcon } from './icons';

/** Expanded pillar card used on the Connect and ERP product pages. */
export function FeatureBlock({
  no,
  title,
  desc,
  bullets,
}: {
  no: string;
  title: string;
  desc: string;
  bullets: string[];
}) {
  return (
    <div className="flex h-full flex-col rounded-[16px] border border-[var(--cr-neutral-200)] bg-white p-7 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(11,110,79,0.28)] sm:p-8">
      <span className="mkt-mono text-[0.8rem] font-semibold tracking-[0.06em] text-[var(--cr-gold-700)]">
        {no}
      </span>
      <h3 className="pt-3 text-[1.25rem]">{title}</h3>
      <p className="pt-2 text-[0.975rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
        {desc}
      </p>
      <ul className="mt-5 flex flex-col gap-3">
        {bullets.map((bullet) => (
          <li
            key={bullet}
            className="flex items-start gap-2.5 text-[0.925rem] leading-snug text-[var(--cr-neutral-700)]"
          >
            <CheckIcon className="mt-[3px] h-4 w-4 shrink-0 text-[var(--cr-indigo-600)]" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
