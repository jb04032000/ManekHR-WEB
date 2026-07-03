'use client';
// Shared error state for finance list pages. Renders a designed "could not load" panel
// with a Retry button instead of letting a failed fetch fall through to the empty state
// (which wrongly reads as "no records"). Cross-link: used by app/.../finance/.../sales/*/page.tsx
// list pages. Watch: keep visual parity with DsEmptyState (components/ui/DsBadge.tsx) so the
// error/empty/loading states feel like one family. Strings are passed in already-translated
// by the caller (these pages own the finance.sales i18n namespace).
import DsButton from '@/components/ui/DsButton';
import { ReloadOutlined } from '@ant-design/icons';

export function ListErrorState({
  title,
  body,
  retryLabel,
  onRetry,
}: {
  title: string;
  body: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>
        ⚠️
      </div>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--cr-text)',
          margin: '0 0 6px',
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: 13,
          color: 'var(--cr-text-4)',
          margin: '0 0 20px',
          maxWidth: 320,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {body}
      </p>
      <DsButton dsVariant="secondary" icon={<ReloadOutlined />} onClick={onRetry}>
        {retryLabel}
      </DsButton>
    </div>
  );
}
