'use client';
/**
 * New Sale Order editor page.
 * Route: /dashboard/finance/firms/[firmId]/sales/orders/new
 */
import { use } from 'react';
import { VoucherEditor } from '@/components/finance/sales/VoucherEditor';

export default function NewSaleOrderPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  return <VoucherEditor voucherType="sale_order" firmId={firmId} mode="new" />;
}
