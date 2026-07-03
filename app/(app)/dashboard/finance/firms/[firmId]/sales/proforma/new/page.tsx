'use client';
/**
 * New Proforma Invoice editor page.
 * Route: /dashboard/finance/firms/[firmId]/sales/proforma/new
 */
import { use } from 'react';
import { VoucherEditor } from '@/components/finance/sales/VoucherEditor';

export default function NewProformaPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  return <VoucherEditor voucherType="proforma" firmId={firmId} mode="new" />;
}
