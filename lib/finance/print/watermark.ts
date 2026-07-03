import type { PrintableVoucher, WatermarkText } from './types';

export function deriveWatermark(voucher: PrintableVoucher, override?: WatermarkText): WatermarkText {
  if (override !== undefined) return override;
  if ((voucher as { voucherType?: string }).voucherType === 'proforma') return 'PRO-FORMA';
  if (voucher.state === 'draft') return 'DRAFT';
  if (voucher.state === 'void') return 'VOID';
  const ps = (voucher as { paymentStatus?: string }).paymentStatus;
  if (ps === 'paid') return 'PAID';
  if (ps === 'overdue') return 'OVERDUE';
  return null;
}

export function applyWatermark(doc: {
  getNumberOfPages: () => number;
  setPage: (n: number) => void;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  saveGraphicsState: () => void;
  setGState: (gs: unknown) => void;
  GState: new (opts: { opacity: number }) => unknown;
  setFont: (font: string, style: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  text: (text: string, x: number, y: number, opts?: Record<string, unknown>) => void;
  restoreGraphicsState: () => void;
}, text: WatermarkText) {
  if (!text) return;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.18 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(72);
    doc.setTextColor(150, 150, 150);
    const angle = -45;
    doc.text(text, pageWidth / 2, pageHeight / 2, { align: 'center', angle });
    doc.restoreGraphicsState();
  }
}
