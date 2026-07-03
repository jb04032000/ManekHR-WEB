import { CheckIcon } from './icons';
import { MarketingButton } from './ui/MarketingButton';

/** A single pricing tier card. `highlighted` marks the recommended plan. */
export function PricingCard({
  name,
  price,
  period,
  desc,
  badge,
  features,
  ctaLabel,
  ctaHref,
  highlighted = false,
}: {
  name: string;
  price: string;
  period: string;
  desc: string;
  badge?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-[16px] border bg-white p-7 sm:p-8 ${
        highlighted
          ? 'border-[var(--cr-indigo-600)] shadow-[0_22px_48px_-22px_rgba(11,110,79,0.35)]'
          : 'border-[var(--cr-neutral-200)]'
      }`}
    >
      <div className="flex items-center gap-3">
        <h3 className="text-[1.3rem]">{name}</h3>
        {badge ? (
          <span className="mkt-mono rounded-full bg-[var(--cr-indigo-50)] px-2.5 py-1 text-[0.66rem] font-semibold tracking-[0.06em] text-[var(--cr-indigo-700)] uppercase">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="flex items-baseline gap-1.5 pt-3">
        <span className="font-[family-name:var(--font-mkt-display)] text-[2.6rem] leading-none font-medium text-[var(--cr-charcoal)]">
          {price}
        </span>
        <span className="text-sm text-[var(--cr-neutral-500)]">{period}</span>
      </p>
      <p className="pt-2.5 text-[0.95rem] leading-relaxed text-[var(--cr-neutral-600)]">{desc}</p>
      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2.5 text-[0.925rem] leading-snug text-[var(--cr-neutral-700)]"
          >
            <CheckIcon className="mt-[3px] h-4 w-4 shrink-0 text-[var(--cr-indigo-600)]" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7">
        <MarketingButton
          href={ctaHref}
          variant={highlighted ? 'solid-indigo' : 'outline'}
          size="md"
          block
        >
          {ctaLabel}
        </MarketingButton>
      </div>
    </div>
  );
}
