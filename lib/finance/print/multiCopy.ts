import type { PrintableVoucher } from './types';

export function deriveCopyLabels(
  voucher: PrintableVoucher,
): ('Original' | 'Duplicate' | 'Triplicate')[] {
  const vt = (voucher as { voucherType?: string }).voucherType;
  if (vt === 'sale_invoice') {
    // SAC codes start with 99 - services invoice
    const isServices = (voucher.lineItems ?? []).every((l: { hsnSacCode?: string }) =>
      /^99/.test(l.hsnSacCode ?? ''),
    );
    return isServices
      ? ['Original', 'Duplicate'] // services: 2 copies (CGST Rule 48)
      : ['Original', 'Duplicate', 'Triplicate']; // goods: 3 copies (CGST Rule 48)
  }
  if (vt === 'delivery_challan') return ['Original', 'Duplicate'];
  // Quotation / Sale Order / Proforma: single copy
  return ['Original'];
}

export function addCopyStamp(
  doc: {
    internal: { pageSize: { getWidth: () => number } };
    saveGraphicsState: () => void;
    setFont: (font: string, style: string) => void;
    setFontSize: (size: number) => void;
    setTextColor: (r: number, g: number, b: number) => void;
    text: (text: string, x: number, y: number, opts?: Record<string, unknown>) => void;
    restoreGraphicsState: () => void;
  },
  label: 'Original' | 'Duplicate' | 'Triplicate',
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.saveGraphicsState();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const fullLabel =
    label === 'Original'
      ? 'Original for Recipient'
      : label === 'Duplicate'
        ? 'Duplicate for Transporter'
        : 'Triplicate for Supplier';
  doc.text(fullLabel, pageWidth - 14, 12, { align: 'right' });
  doc.restoreGraphicsState();
}
