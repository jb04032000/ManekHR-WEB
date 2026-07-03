'use client';

/**
 * CompanyDirectorySearchBand - the prominent keyword search for `/connect/companies`.
 *
 * Deliberately SUBMIT-based (button click or Enter), NOT debounced-on-type: a
 * live per-keystroke search hammers the FE + BE (a request + a federated query per
 * character). Submitting sets `?q=` once, which re-runs the server page. The draft
 * re-syncs when the URL `q` changes externally (a chip removal, Clear all).
 */

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';

export default function CompanyDirectorySearchBand() {
  const t = useTranslations('connect.companies');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get('q') ?? '';
  const [draft, setDraft] = useState(urlQ);
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    setDraft(urlQ);
  }

  const submit = () => {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = draft.trim();
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mb-4 flex items-center gap-2 rounded-[var(--cr-radius-lg)] p-1 ps-3 transition-colors focus-within:border-[var(--cr-primary)]"
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        boxShadow: 'var(--cr-shadow-sm)',
      }}
    >
      <Search size={16} aria-hidden style={{ color: 'var(--cr-text-4)', flex: 'none' }} />
      <input
        type="search"
        aria-label={t('searchAria')}
        placeholder={t('searchPlaceholder')}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[13.5px] outline-none"
        style={{ color: 'var(--cr-text)' }}
      />
      <DsButton dsVariant="primary" dsSize="sm" htmlType="submit">
        {t('searchButton')}
      </DsButton>
    </form>
  );
}
