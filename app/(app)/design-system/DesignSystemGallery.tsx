'use client';

/**
 * DesignSystemGallery - renders shared UI components in isolation.
 * Reached at /design-system (dev-only). Add a <Section> here for each new
 * shared component as it is built. The former Connect showcase was removed
 * with the Connect product; this now holds the ERP/generic primitives.
 */

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import DsButton from '@/components/ui/DsButton';

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--cr-space-2xl)' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: 'var(--cr-text)' }}>
        {title}
      </h2>
      <p style={{ margin: '0 0 var(--cr-space-md)', fontSize: 13, color: 'var(--cr-text-4)' }}>
        {note}
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--cr-space-lg)',
          alignItems: 'flex-start',
          padding: 'var(--cr-space-lg)',
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function DesignSystemGallery() {
  const t = useTranslations('connect.designSystem');

  return (
    <main
      style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--cr-space-xl) var(--cr-space-lg)' }}
    >
      <header style={{ marginBottom: 'var(--cr-space-xl)' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 700, color: 'var(--cr-text)' }}>
          {t('title')}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--cr-text-4)' }}>{t('subtitle')}</p>
      </header>

      <Section
        title="DsButton"
        note="Shared design-system button - variants (primary / ghost / danger) and sizes. Used across app surfaces."
      >
        <DsButton dsVariant="primary" dsSize="sm">
          Primary
        </DsButton>
        <DsButton dsVariant="ghost" dsSize="sm">
          Ghost
        </DsButton>
        <DsButton dsVariant="danger" dsSize="sm">
          Danger
        </DsButton>
        <DsButton dsVariant="primary">Primary (default size)</DsButton>
      </Section>
    </main>
  );
}
