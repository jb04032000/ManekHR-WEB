/**
 * Thermal-3inch (80mm wide) theme
 * Adds HSN column, tax breakdown, and signature line vs thermal-2inch.
 */
import type { PrintableVoucher, FirmProfile, PartyProfile, PrintOptions } from '../types';

const VOUCHER_TITLES: Record<string, string> = {
  sale_invoice: 'TAX INVOICE',
  quotation: 'QUOTATION',
  sale_order: 'SALE ORDER',
  proforma: 'PROFORMA',
  delivery_challan: 'DELIVERY CHALLAN',
};

export async function renderThermal3inch(
  voucher: PrintableVoucher,
  firm: FirmProfile,
  party: PartyProfile,
  opts: PrintOptions,
): Promise<unknown> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  // 80mm wide
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 297] });
  const W = doc.internal.pageSize.getWidth();
  const sv = voucher as unknown as Record<string, unknown>;
  const vt = sv.voucherType as string;
  // 2f: seller GSTIN this invoice was issued under (multi-GSTIN firms).
  const sellerGstin = (sv.sellerGstin as string | undefined) ?? firm.gstin;

  let y = 6;

  // Firm name
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(firm.firmName.toUpperCase(), W / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  const firmMeta = [firm.phone, firm.email].filter(Boolean).join(' | ');
  if (firmMeta) {
    doc.text(firmMeta, W / 2, y, { align: 'center' });
    y += 4;
  }
  if (sellerGstin) {
    doc.text(`GSTIN: ${sellerGstin}`, W / 2, y, { align: 'center' });
    y += 4;
  }

  // Voucher title
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text(
    sv.isBillOfSupply && vt === 'sale_invoice'
      ? 'BILL OF SUPPLY'
      : (VOUCHER_TITLES[vt] ?? 'VOUCHER'),
    W / 2,
    y,
    { align: 'center' },
  );
  y += 4;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(3, y, W - 3, y);
  y += 3;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text(`No: ${voucher.voucherNumber ?? '(draft)'}`, 3, y);
  y += 4;
  doc.text(`Date: ${new Date(voucher.voucherDate).toLocaleDateString('en-IN')}`, 3, y);
  y += 4;
  if (sv.dueDate) {
    doc.text(`Due: ${new Date(sv.dueDate as string).toLocaleDateString('en-IN')}`, 3, y);
    y += 4;
  }

  doc.text(`To: ${party.name}`, 3, y);
  y += 4;
  if (party.gstin) {
    doc.text(`GSTIN: ${party.gstin}`, 3, y);
    y += 4;
  }
  if (party.phone) {
    doc.text(`Ph: ${party.phone}`, 3, y);
    y += 4;
  }

  doc.line(3, y, W - 3, y);
  y += 3;

  // invoiceLayout flags: undefined and true both render; only explicit false hides.
  const layout = firm.invoiceLayout;
  const showHsn = layout?.showHsnColumn !== false;
  const showSignature = layout?.showSignature !== false;

  // Line items with optional HSN column (thermal-3inch has no discount or bank-details block)
  const isIntra =
    !!sv.placeOfSupplyStateCode && sv.placeOfSupplyStateCode === (sellerGstin?.slice(0, 2) ?? '');

  const taxCols = isIntra ? ['CGS%', 'SGS%'] : ['IGS%'];
  const lineRows = (voucher.lineItems ?? []).map((l) => {
    const li = l as unknown as Record<string, unknown>;
    const taxValues = isIntra
      ? [
          (((li.cgstPaise as number) ?? 0) / 100).toFixed(0),
          (((li.sgstPaise as number) ?? 0) / 100).toFixed(0),
        ]
      : [(((li.igstPaise as number) ?? 0) / 100).toFixed(0)];
    const row: unknown[] = [((li.itemName as string) ?? '').substring(0, 12)];
    if (showHsn) row.push(((li.hsnSacCode as string) ?? '').substring(0, 8));
    row.push(
      String(li.qty ?? 0),
      (((li.ratePaise as number) ?? 0) / 100).toFixed(0),
      ...taxValues,
      (((li.lineTotalPaise as number) ?? 0) / 100).toFixed(0),
    );
    return row;
  });

  const tableHead: string[] = ['Item'];
  if (showHsn) tableHead.push('HSN');
  tableHead.push('Qty', 'Rate', ...taxCols, 'Amt');

  // Column index after optional HSN: tax cols start at index 3 (with HSN) or 2 (without)
  const colOffset = showHsn ? 0 : -1;
  autoTable(doc, {
    startY: y,
    head: [tableHead],
    body: lineRows as unknown as (string | number)[][],
    styles: {
      fontSize: 6.5,
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
      0: { cellWidth: showHsn ? 22 : 30 },
      ...(showHsn ? { 1: { cellWidth: 14 } } : {}),
      [2 + colOffset]: { cellWidth: 8, halign: 'right' as const },
      [3 + colOffset]: { cellWidth: 10, halign: 'right' as const },
      ...(isIntra
        ? {
            [4 + colOffset]: { cellWidth: 8, halign: 'right' as const },
            [5 + colOffset]: { cellWidth: 8, halign: 'right' as const },
            [6 + colOffset]: { cellWidth: 10, halign: 'right' as const },
          }
        : {
            [4 + colOffset]: { cellWidth: 8, halign: 'right' as const },
            [5 + colOffset]: { cellWidth: 10, halign: 'right' as const },
          }),
    },
    margin: { left: 3, right: 3 },
    tableWidth: W - 6,
  });

  const tableResult = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  y = (tableResult?.finalY ?? y + 20) + 3;

  // Tax breakdown
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.line(3, y, W - 3, y);
  y += 4;

  const subtotalRow = (label: string, value: string, bold = false) => {
    if (bold) doc.setFont('courier', 'bold');
    doc.text(label, 3, y);
    doc.text(value, W - 3, y, { align: 'right' });
    if (bold) doc.setFont('courier', 'normal');
    y += 4;
  };

  subtotalRow('Subtotal', '₹' + (((sv.subtotalPaise as number) ?? 0) / 100).toFixed(2));
  if (((sv.totalDiscountPaise as number) ?? 0) > 0) {
    subtotalRow('Discount', '- ₹' + (((sv.totalDiscountPaise as number) ?? 0) / 100).toFixed(2));
  }
  subtotalRow('Taxable', '₹' + (((sv.taxableValuePaise as number) ?? 0) / 100).toFixed(2));

  if (isIntra) {
    subtotalRow('CGST', '₹' + (((sv.cgstPaise as number) ?? 0) / 100).toFixed(2));
    subtotalRow('SGST', '₹' + (((sv.sgstPaise as number) ?? 0) / 100).toFixed(2));
  } else {
    subtotalRow('IGST', '₹' + (((sv.igstPaise as number) ?? 0) / 100).toFixed(2));
  }
  // Reverse-charge declaration (mandatory note when tax is payable by the recipient).
  if (sv.isReverseCharge) {
    doc.setFont('courier', 'bold');
    doc.text('** Reverse charge: tax payable by recipient **', W / 2, y, {
      align: 'center',
      maxWidth: W - 6,
    });
    doc.setFont('courier', 'normal');
    y += 8;
  }

  // Bill of Supply declaration (composition dealer cannot collect tax).
  if (sv.isBillOfSupply) {
    doc.setFontSize(6.5);
    doc.text('Composition taxable person, not eligible to collect tax on supplies.', W / 2, y, {
      align: 'center',
      maxWidth: W - 6,
    });
    doc.setFontSize(7.5);
    y += 8;
  }

  if (((sv.cessPaise as number) ?? 0) > 0) {
    subtotalRow('Cess', '₹' + (((sv.cessPaise as number) ?? 0) / 100).toFixed(2));
  }
  if (((sv.tcsPaise as number) ?? 0) > 0) {
    subtotalRow('TCS', '₹' + (((sv.tcsPaise as number) ?? 0) / 100).toFixed(2));
  }
  if (((sv.roundOffPaise as number) ?? 0) !== 0) {
    const rp = sv.roundOffPaise as number;
    subtotalRow('Round', (rp > 0 ? '+' : '-') + '₹' + (Math.abs(rp) / 100).toFixed(2));
  }

  doc.line(3, y, W - 3, y);
  y += 3;
  subtotalRow('TOTAL', '₹' + (((sv.grandTotalPaise as number) ?? 0) / 100).toFixed(2), true);
  y += 3;

  // UPI QR
  if (opts.qrBase64) {
    try {
      doc.addImage(opts.qrBase64, 'PNG', W / 2 - 14, y, 28, 28);
      y += 30;
      if (firm.brandProfile?.upiId) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.text(`UPI: ${firm.brandProfile.upiId}`, W / 2, y, { align: 'center' });
        y += 4;
      }
    } catch {
      /* ignore */
    }
  }

  // Signature line (showSignature flag; undefined and true both render)
  if (showSignature) {
    doc.setDrawColor(0);
    doc.line(W - 40, y + 8, W - 3, y + 8);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text('Authorised Signatory', W - 3, y + 12, { align: 'right' });
    y += 16;
  }

  // Footer
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your business!', W / 2, y, { align: 'center' });

  void party;
  return doc;
}
