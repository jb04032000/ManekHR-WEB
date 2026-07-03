'use client';
/**
 * New Tax Invoice editor page.
 * Route: /dashboard/finance/firms/[firmId]/sales/invoices/new
 *
 * Phase 17 / Plan 07 - D-04 non-blocking blacklist warning when the selected
 * party (passed via ?partyId= query param) is on the workspace blacklist.
 * The warning is informational; voucher submission proceeds normally.
 */
import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store';
import BlacklistedPartyWarning from '@/components/parties/BlacklistedPartyWarning';
import { VoucherEditor } from '@/components/finance/sales/VoucherEditor';

export default function NewInvoicePage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const searchParams = useSearchParams();
  const partyId = searchParams?.get('partyId') ?? undefined;
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  return (
    <div>
      {/* Phase 17 / D-04 - intelligence.blacklisted non-blocking warning. */}
      {wsId && partyId ? <BlacklistedPartyWarning wsId={wsId} partyId={partyId} /> : null}
      <VoucherEditor voucherType="sale_invoice" firmId={firmId} mode="new" />
    </div>
  );
}
