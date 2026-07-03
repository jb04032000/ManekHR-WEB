'use client';
/**
 * New Quotation editor page.
 * Route: /dashboard/finance/firms/[firmId]/sales/quotations/new
 */
import { use } from 'react';
import { VoucherEditor } from '@/components/finance/sales/VoucherEditor';

export default function NewQuotationPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  return <VoucherEditor voucherType="quotation" firmId={firmId} mode="new" />;
}
