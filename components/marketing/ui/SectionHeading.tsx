import type { ReactNode } from 'react';
import { Eyebrow } from './Eyebrow';

/**
 * Section header: optional numbered kicker + serif heading + optional
 * sub-paragraph. Font family, weight, colour and leading come from the
 * `.mkt-root` foundation (`globals.css`) - this only picks size and
 * layout. On dark bands the parent carries `.mkt-on-dark`, which flips
 * heading + body colour automatically.
 */
export function SectionHeading({
  eyebrow,
  eyebrowNo,
  title,
  sub,
  tone = 'light',
  align = 'left',
  level = 'h2',
  id,
}: {
  eyebrow?: ReactNode;
  eyebrowNo?: string;
  title: ReactNode;
  sub?: ReactNode;
  tone?: 'light' | 'dark';
  align?: 'left' | 'center';
  level?: 'h1' | 'h2';
  id?: string;
}) {
  const Tag = level;
  return (
    <div
      className={`max-w-[680px] ${align === 'center' ? 'mx-auto flex flex-col items-center text-center' : ''}`}
    >
      {eyebrow ? (
        <div className="mb-[18px]">
          <Eyebrow no={eyebrowNo} tone={tone}>
            {eyebrow}
          </Eyebrow>
        </div>
      ) : null}
      <Tag
        id={id}
        className={`mkt-anchor text-balance ${
          level === 'h1'
            ? 'text-[clamp(2.4rem,1.4rem+3.4vw,3.85rem)]'
            : 'text-[clamp(2rem,1.3rem+2.5vw,3.1rem)]'
        }`}
      >
        {title}
      </Tag>
      {sub ? (
        <p
          className={`max-w-[58ch] pt-4 text-[1.075rem] leading-[1.65] text-pretty ${
            tone === 'dark' ? 'text-white/70' : 'text-[var(--cr-neutral-600)]'
          }`}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
