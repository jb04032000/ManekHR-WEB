'use client';

/**
 * HowBuyingWorks - the dismissible "how buying works" strip on
 * `/connect/marketplace`. Three plain steps (find -> get a quotation -> talk and
 * close) plus the honest "ManekHR does not handle payment or delivery" note,
 * mirroring the canonical Connect marketplace prototype. Dismissal persists in
 * localStorage so a returning buyer is not re-taught.
 *
 * The dismissed flag is read through `useSyncExternalStore` so the value is
 * SSR-safe (the server snapshot is always "visible", avoiding a hydration
 * mismatch) and same-tab reactive (the dismiss click notifies subscribers).
 */

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, X } from 'lucide-react';

const DISMISS_KEY = 'connect.marketplace.howBuying.dismissed';

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  if (typeof window !== 'undefined') window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    if (typeof window !== 'undefined') window.removeEventListener('storage', callback);
  };
}

/** Client snapshot: true once the buyer has dismissed the strip. */
function getDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Server snapshot: the strip is always visible during SSR and the first paint. */
function getDismissedServer(): boolean {
  return false;
}

function dismissNow(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Ignore a persistence failure; the strip still closes for this session.
  }
  listeners.forEach((l) => l());
}

export default function HowBuyingWorks() {
  const t = useTranslations('connect.marketplace.howBuying');
  const dismissed = useSyncExternalStore(subscribe, getDismissed, getDismissedServer);

  if (dismissed) return null;

  const steps = [t('step1'), t('step2'), t('step3')];

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2"
      style={{
        padding: '11px 16px',
        background: 'var(--cr-wash-indigo, #eef2fb)',
        border: '1px solid var(--cr-indigo-100, #dbe4f7)',
        borderRadius: 'var(--cr-radius-lg)',
      }}
    >
      <ol
        className="m-0 flex flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 p-0"
        style={{ listStyle: 'none' }}
      >
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid place-items-center rounded-full text-[11px] font-extrabold"
              style={{
                width: 20,
                height: 20,
                background: 'var(--cr-primary)',
                color: 'var(--cr-on-primary, #fff)',
              }}
            >
              {i + 1}
            </span>
            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--cr-text-2)' }}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <ArrowRight
                size={15}
                aria-hidden
                style={{ color: 'var(--cr-indigo-200, #b9c6ec)' }}
              />
            )}
          </li>
        ))}
      </ol>
      <span className="text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
        {t('note')}
      </span>
      <button
        type="button"
        aria-label={t('dismiss')}
        onClick={dismissNow}
        className="grid shrink-0 cursor-pointer place-items-center rounded-md border-none bg-transparent p-1"
        style={{ color: 'var(--cr-text-4)' }}
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
