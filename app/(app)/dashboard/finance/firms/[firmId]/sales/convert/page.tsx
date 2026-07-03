'use client';
/**
 * Deep-link entry page for ConvertWizard.
 * Opened when a user clicks "Convert" from a single voucher's detail page.
 * Reads ?sourceType=...&sourceIds=... (comma-separated) from URL query params.
 */
import { use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ConvertWizard } from '@/components/finance/sales/ConvertWizard';
import { useTranslations } from 'next-intl';
import type { VoucherType } from '@/types';

type SourceType = 'quotation' | 'sale_order' | 'proforma' | 'delivery_challan';

const VALID_SOURCE_TYPES: SourceType[] = [
  'quotation',
  'sale_order',
  'proforma',
  'delivery_challan',
];

export default function ConvertPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.sales');
  const search = useSearchParams();
  const router = useRouter();

  const rawSourceType = search.get('sourceType') as SourceType | null;
  const rawSourceIds = search.get('sourceIds');
  const sourceIds = rawSourceIds ? rawSourceIds.split(',').filter(Boolean) : [];

  const isValid =
    rawSourceType !== null && VALID_SOURCE_TYPES.includes(rawSourceType) && sourceIds.length > 0;

  if (!isValid) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--cr-text-3)' }}>
        {t('convert.invalidRequest')}
      </div>
    );
  }

  return (
    <ConvertWizard
      open={true}
      sourceType={rawSourceType as SourceType}
      sourceIds={sourceIds}
      firmId={firmId}
      onClose={() => router.back()}
    />
  );
}
