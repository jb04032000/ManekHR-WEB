'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from 'antd';
import { PrintTemplatePicker } from './PrintTemplatePicker';
import {
  buildPreviewInvoice,
  buildFirmProfile,
  buildPartyProfile,
  type PreviewFormInput,
  type PreviewFirmInput,
} from '@/lib/finance/print/buildPreviewVoucher';
import type { TaxComputeResult } from '@/lib/finance/taxComputeClient';
import type { SaleInvoice } from '@/types';

// Live print preview: renders the in-progress invoice with the firm's real print
// themes (PrintTemplatePicker) in a right-side drawer, rebuilt as the editor form
// changes. Reuses the same builders/themes as the saved print page so the preview
// equals the printed document. Cross-link: buildPreviewVoucher (form -> SaleInvoice),
// PrintTemplatePicker (theme renderer), VoucherEditor (owns the toggle).
// sale_invoice only: the builder targets the SaleInvoice shape.
interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  watched: PreviewFormInput;
  taxResult: TaxComputeResult;
  firm: PreviewFirmInput | null;
  firmId: string;
  wsId: string;
}

export function LivePreviewPanel({
  open,
  onClose,
  title,
  watched,
  taxResult,
  firm,
  firmId,
  wsId,
}: Props) {
  // Debounce the heavy work: PrintTemplatePicker regenerates a PDF on every voucher
  // change, so while the panel is open we rebuild the preview object at most every
  // 400ms (first build is immediate so the drawer is not blank on open).
  const [snapshot, setSnapshot] = useState<SaleInvoice | null>(null);
  const firstRef = useRef(true);

  useEffect(() => {
    if (!open) {
      firstRef.current = true;
      return;
    }
    const build = () => setSnapshot(buildPreviewInvoice(watched, taxResult, { firmId, wsId }));
    if (firstRef.current) {
      firstRef.current = false;
      build();
      return;
    }
    const id = setTimeout(build, 400);
    return () => clearTimeout(id);
  }, [open, watched, taxResult, firmId, wsId]);

  const firmProfile = useMemo(() => buildFirmProfile(firm), [firm]);
  const partyProfile = useMemo(
    () => buildPartyProfile(watched.partySnapshot, watched.partyId ?? ''),
    [watched.partySnapshot, watched.partyId],
  );

  return (
    <Drawer title={title} open={open} onClose={onClose} size="large" destroyOnHidden>
      {snapshot && (
        <PrintTemplatePicker
          voucher={snapshot}
          firm={firmProfile}
          party={partyProfile}
          voucherType="sale_invoice"
          firmId={firmId}
        />
      )}
    </Drawer>
  );
}
