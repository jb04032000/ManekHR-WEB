'use client';
/**
 * New Delivery Challan editor page.
 * Route: /dashboard/finance/firms/[firmId]/sales/delivery-challans/new
 */
import { use } from 'react';
import { VoucherEditor } from '@/components/finance/sales/VoucherEditor';

export default function NewDeliveryChallanPage({
  params,
}: {
  params: Promise<{ firmId: string }>;
}) {
  const { firmId } = use(params);
  return <VoucherEditor voucherType="delivery_challan" firmId={firmId} mode="new" />;
}
