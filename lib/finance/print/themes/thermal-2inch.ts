/**
 * Thermal-2inch (58mm wide) theme
 * Monospace font, minimal columns, UPI QR at bottom.
 * Designed for thermal receipt printers at retail counters.
 */
import type { PrintableVoucher, FirmProfile, PartyProfile, PrintOptions } from '../types';

const VOUCHER_TITLES: Record<string, string> = {
  sale_invoice: 'TAX INVOICE',
  quotation: 'QUOTATION',
  sale_order: 'SALE ORDER',
  proforma: 'PROFORMA',
  delivery_challan: 'DELIVERY CHALLAN',
};

export async function renderThermal2inch(
  voucher: PrintableVoucher,
  firm: FirmProfile,
  party: PartyProfile,
  opts: PrintOptions,
): Promise<unknown> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  // 58mm wide, height=297mm (will auto-trim on thermal printer)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, 297] });
  const W = doc.internal.pageSize.getWidth(); // 58mm
  const sv = voucher as unknown as Record<string, unknown>;
  const vt = sv.voucherType as string;

  let y = 6;

  // Firm name
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(firm.firmName.toUpperCase(), W / 2, y, { align: 'center' });
  y += 5;

  // Voucher title
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.text(VOUCHER_TITLES[vt] ?? 'VOUCHER', W / 2, y, { align: 'center' });
  y += 4;

  // Divider
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(3, y, W - 3, y);
  y += 3;

  // Invoice number + date
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.text(`No: ${voucher.voucherNumber ?? '(draft)'}`, 3, y);
  y += 4;
  doc.text(`Date: ${new Date(voucher.voucherDate).toLocaleDateString('en-IN')}`, 3, y);
  y += 4;

  // Party name
  doc.text(`To: ${party.name}`, 3, y);
  y += 4;
  if (party.phone) {
    doc.text(`Ph: ${party.phone}`, 3, y);
    y += 4;
  }

  // Divider
  doc.line(3, y, W - 3, y);
  y += 3;

  // Line items - only Item | Qty | Rate | Total (thermal 2" is too narrow for HSN/tax)
  const lineRows = (voucher.lineItems ?? []).map((l) => {
    const li = l as unknown as Record<string, unknown>;
    return [
      ((li.itemName as string) ?? '').substring(0, 14),
      String(li.qty ?? 0),
      (((li.ratePaise as number) ?? 0) / 100).toFixed(0),
      (((li.lineTotalPaise as number) ?? 0) / 100).toFixed(0),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Qty', 'Rate', 'Amt']],
    body: lineRows,
    styles: {
      fontSize: 7,
      font: 'courier',
      lineWidth: 0,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
    },
    headStyles: {
      fillColor: [220, 220, 220] as [number, number, number],
      textColor: [0, 0, 0] as [number, number, number],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 8, halign: 'right' },
      2: { cellWidth: 10, halign: 'right' },
      3: { cellWidth: 10, halign: 'right' },
    },
    margin: { left: 3, right: 3 },
    tableWidth: W - 6,
  });

  const tableResult = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  y = (tableResult?.finalY ?? y + 20) + 3;

  // Totals
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.line(3, y, W - 3, y);
  y += 4;

  const totalRow = (label: string, value: string, bold = false) => {
    if (bold) doc.setFont('courier', 'bold');
    doc.text(label, 3, y);
    doc.text(value, W - 3, y, { align: 'right' });
    if (bold) doc.setFont('courier', 'normal');
    y += 4;
  };

  const grandTotal = (sv.grandTotalPaise as number) ?? 0;
  const taxableValue = (sv.taxableValuePaise as number) ?? 0;

  totalRow('Taxable', '₹' + (taxableValue / 100).toFixed(0));

  // Compact tax line (just show total tax)
  const totalTax =
    ((sv.cgstPaise as number) ?? 0) +
    ((sv.sgstPaise as number) ?? 0) +
    ((sv.igstPaise as number) ?? 0) +
    ((sv.cessPaise as number) ?? 0);
  if (totalTax > 0) {
    totalRow('Tax', '₹' + (totalTax / 100).toFixed(0));
  }
  if (((sv.roundOffPaise as number) ?? 0) !== 0) {
    const rp = sv.roundOffPaise as number;
    totalRow('Round', (rp > 0 ? '+' : '-') + '₹' + (Math.abs(rp) / 100).toFixed(0));
  }

  doc.line(3, y, W - 3, y);
  y += 3;
  totalRow('TOTAL', '₹' + (grandTotal / 100).toFixed(2), true);
  y += 2;

  // UPI QR
  if (opts.qrBase64) {
    try {
      doc.addImage(opts.qrBase64, 'PNG', W / 2 - 12, y, 24, 24);
      y += 26;
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      if (firm.brandProfile?.upiId) {
        doc.text(`UPI: ${firm.brandProfile.upiId}`, W / 2, y, { align: 'center' });
        y += 4;
      }
    } catch {
      /* ignore */
    }
  }

  // Footer
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you!', W / 2, y + 2, { align: 'center' });

  void party;
  return doc;
}
