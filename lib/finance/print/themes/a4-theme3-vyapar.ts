/**
 * A4-Theme3: GST Theme 1 - Vyapar parity
 * Pixel-faithful recreation of Vyapar's most popular GST Invoice template.
 * Key differentials:
 *  - Bordered table, light-grey header (not colored), black text in header
 *  - Fixed-position bottom bank-details box
 *  - Firm GSTIN + PAN prominently displayed
 *  - All amounts right-aligned with tabular-nums
 */
import type { PrintableVoucher, FirmProfile, PartyProfile, PrintOptions } from '../types';
import { amountInWords } from '../../amountInWords';

const VOUCHER_TITLES: Record<string, string> = {
  sale_invoice: 'TAX INVOICE',
  quotation: 'QUOTATION',
  sale_order: 'SALE ORDER',
  proforma: 'PROFORMA INVOICE',
  delivery_challan: 'DELIVERY CHALLAN',
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

export async function renderA4Theme3Vyapar(
  voucher: PrintableVoucher,
  firm: FirmProfile,
  party: PartyProfile,
  opts: PrintOptions,
): Promise<unknown> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const primaryHex = firm.brandProfile?.primaryColor ?? '#0B6E4F';
  const [pr, pg, pb] = hexToRgb(primaryHex);
  const sv = voucher as unknown as Record<string, unknown>;
  const vt = sv.voucherType as string;
  // 2f: seller GSTIN this invoice was issued under (multi-GSTIN firms).
  const sellerGstin = (sv.sellerGstin as string | undefined) ?? firm.gstin;

  // Outer border
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.rect(8, 8, W - 16, H - 16);

  // Header block: firm name top-center, contact details below
  let cursorY = 14;

  if (firm.brandProfile?.logoUrl) {
    try {
      doc.addImage(firm.brandProfile.logoUrl, 'PNG', 12, cursorY, 20, 14);
    } catch {
      /* ignore */
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text(firm.firmName, W / 2, cursorY + 6, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const firmContact = [firm.phone, firm.email].filter(Boolean).join('  |  ');
  if (firmContact) doc.text(firmContact, W / 2, cursorY + 11, { align: 'center' });

  const firmAddr = [firm.addressLine, firm.city, firm.state, firm.pincode]
    .filter(Boolean)
    .join(', ');
  if (firmAddr) doc.text(firmAddr, W / 2, cursorY + 15, { align: 'center' });

  cursorY += 20;

  // GSTIN + PAN band (light background)
  doc.setFillColor(245, 245, 245);
  doc.rect(8, cursorY, W - 16, 8, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  const gstinStr = sellerGstin ? `GSTIN: ${sellerGstin}` : '';
  const panStr = firm.pan ? `PAN: ${firm.pan}` : '';
  const taxIds = [gstinStr, panStr].filter(Boolean).join('   ·   ');
  if (taxIds) doc.text(taxIds, W / 2, cursorY + 5, { align: 'center' });
  cursorY += 10;

  // Horizontal line
  doc.setDrawColor(180, 180, 180);
  doc.line(8, cursorY, W - 8, cursorY);
  cursorY += 3;

  // Voucher title + number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  const title =
    sv.isBillOfSupply && vt === 'sale_invoice'
      ? 'BILL OF SUPPLY'
      : (VOUCHER_TITLES[vt] ?? 'VOUCHER');
  doc.text(title, W / 2, cursorY + 6, { align: 'center' });
  cursorY += 10;

  // Two-column party / invoice details
  doc.setDrawColor(180, 180, 180);
  doc.line(8, cursorY, W - 8, cursorY);

  const col1X = 10;
  const col2X = W / 2 + 4;
  const colW = W / 2 - 14;

  // Bill To (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text('Bill To:', col1X, cursorY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 30, 30);
  doc.text(party.name, col1X, cursorY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  let pty = cursorY + 14;
  if (party.gstin) {
    doc.text(`GSTIN: ${party.gstin}`, col1X, pty);
    pty += 4;
  }
  if (party.address?.line1) {
    doc.text(party.address.line1, col1X, pty);
    pty += 4;
  }
  const partyCity = [party.address?.city, party.address?.state, party.address?.pincode]
    .filter(Boolean)
    .join(', ');
  if (partyCity) {
    doc.text(partyCity, col1X, pty);
    pty += 4;
  }
  if (party.phone) {
    doc.text(`Ph: ${party.phone}`, col1X, pty);
  }

  // Invoice details (right)
  const metaItems: [string, string][] = [
    ['Invoice No.', voucher.voucherNumber ?? '(draft)'],
    ['Date', new Date(voucher.voucherDate).toLocaleDateString('en-IN')],
  ];
  if (sv.dueDate) {
    metaItems.push(['Due Date', new Date(sv.dueDate as string).toLocaleDateString('en-IN')]);
  }
  if (sv.placeOfSupplyStateCode) {
    metaItems.push(['Place of Supply', sv.placeOfSupplyStateCode as string]);
  }

  let mty = cursorY + 5;
  metaItems.forEach(([lbl, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`${lbl}:`, col2X, mty);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(val, col2X + colW, mty, { align: 'right' });
    mty += 5;
  });

  cursorY += 32;

  // Line items table - Vyapar style: bordered, light-grey header, black header text
  const isIntra =
    !!sv.placeOfSupplyStateCode && sv.placeOfSupplyStateCode === (sellerGstin?.slice(0, 2) ?? '');

  // invoiceLayout flags: undefined and true both render; only explicit false hides.
  const layout = firm.invoiceLayout;
  const showHsn3 = layout?.showHsnColumn !== false;
  const showDisc3 = layout?.showDiscountColumn !== false;

  const taxCols = isIntra ? ['CGST', 'SGST'] : ['IGST'];
  const lineRows = (voucher.lineItems ?? []).map((l, idx) => {
    const li = l as unknown as Record<string, unknown>;
    const taxValues = isIntra
      ? [
          (((li.cgstPaise as number) ?? 0) / 100).toFixed(2),
          (((li.sgstPaise as number) ?? 0) / 100).toFixed(2),
        ]
      : [(((li.igstPaise as number) ?? 0) / 100).toFixed(2)];
    // R11: textile dual-unit breakdown appended to the item name when present.
    const du =
      li.secondaryQty && li.conversionFactor
        ? ` (${li.secondaryQty} ${(li.secondaryUnit as string) ?? ''} x ${li.conversionFactor})`
        : '';
    const row: unknown[] = [idx + 1, `${li.itemName ?? ''}${du}`];
    if (showHsn3) row.push(li.hsnSacCode ?? '');
    row.push(li.qty ?? 0, li.unit ?? '', (((li.ratePaise as number) ?? 0) / 100).toFixed(2));
    if (showDisc3) row.push(`${li.discountPct ?? 0}%`);
    row.push(
      `${li.taxRate ?? 0}%`,
      ...taxValues,
      (((li.lineTotalPaise as number) ?? 0) / 100).toFixed(2),
    );
    return row;
  });

  const tableHead3: string[] = ['#', 'Item Description'];
  if (showHsn3) tableHead3.push('HSN/SAC');
  tableHead3.push('Qty', 'Unit', 'Rate');
  if (showDisc3) tableHead3.push('Disc%');
  tableHead3.push('Tax%', ...taxCols, 'Amount');

  const taxColStart3 = tableHead3.indexOf(taxCols[0]);
  const amtColIdx3 = tableHead3.length - 1;
  const colStyles3: Record<number, { cellWidth?: number; halign?: 'right' | 'center' }> = {
    0: { cellWidth: 8, halign: 'center' },
  };
  for (let c = taxColStart3; c <= amtColIdx3; c++) colStyles3[c] = { halign: 'right' };

  // Reserve space at bottom for bank details box (25mm)
  const bottomReserve = 35;

  autoTable(doc, {
    startY: cursorY,
    head: [tableHead3],
    body: lineRows as unknown as (string | number)[][],
    styles: {
      fontSize: 8.5,
      lineWidth: 0.3,
      lineColor: [180, 180, 180] as [number, number, number],
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    headStyles: {
      fillColor: [235, 235, 235] as [number, number, number], // light grey - Vyapar signature
      textColor: [30, 30, 30] as [number, number, number], // black text - Vyapar signature
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: colStyles3,
    margin: { left: 10, right: 10, bottom: bottomReserve },
  });

  const tableResult = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  let finalY = (tableResult?.finalY ?? cursorY + 30) + 4;

  // Totals section (right-aligned)
  const totalsX = W - 90;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);

  const row = (label: string, value: string, isBold = false) => {
    if (isBold) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
    }
    doc.text(label, totalsX, finalY);
    doc.text(value, W - 12, finalY, { align: 'right' });
    if (isBold) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    }
    finalY += isBold ? 6 : 5;
  };

  row('Subtotal', '₹' + (((sv.subtotalPaise as number) ?? 0) / 100).toFixed(2));
  if (((sv.totalDiscountPaise as number) ?? 0) > 0) {
    row('Discount', '- ₹' + (((sv.totalDiscountPaise as number) ?? 0) / 100).toFixed(2));
  }
  row('Taxable Value', '₹' + (((sv.taxableValuePaise as number) ?? 0) / 100).toFixed(2));
  if (isIntra) {
    row('CGST', '₹' + (((sv.cgstPaise as number) ?? 0) / 100).toFixed(2));
    // Reverse-charge declaration (mandatory note when tax is payable by the recipient).
    if (sv.isReverseCharge) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text('Tax payable under reverse charge: Yes', 10, finalY);
      doc.setFont('helvetica', 'normal');
      finalY += 6;
    }

    // Bill of Supply declaration (composition dealer cannot collect tax - Rule 49 / Rule 5(1)(f)).
    if (sv.isBillOfSupply) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text('Composition taxable person, not eligible to collect tax on supplies.', 10, finalY, {
        maxWidth: W - 20,
      });
      doc.setFont('helvetica', 'normal');
      finalY += 6;
    }

    row('SGST', '₹' + (((sv.sgstPaise as number) ?? 0) / 100).toFixed(2));
  } else {
    row('IGST', '₹' + (((sv.igstPaise as number) ?? 0) / 100).toFixed(2));
  }
  if (((sv.cessPaise as number) ?? 0) > 0) {
    row('Cess', '₹' + (((sv.cessPaise as number) ?? 0) / 100).toFixed(2));
  }
  if (((sv.tcsPaise as number) ?? 0) > 0) {
    row('TCS 206C(1H)', '₹' + (((sv.tcsPaise as number) ?? 0) / 100).toFixed(2));
  }
  if (((sv.roundOffPaise as number) ?? 0) !== 0) {
    const rp = sv.roundOffPaise as number;
    row('Round-off', (rp > 0 ? '+ ' : '- ') + '₹' + (Math.abs(rp) / 100).toFixed(2));
  }

  // Grand total with colored background
  doc.setFillColor(pr, pg, pb);
  doc.rect(totalsX - 4, finalY - 4, W - totalsX - 4, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Grand Total', totalsX, finalY);
  doc.text('₹' + (((sv.grandTotalPaise as number) ?? 0) / 100).toFixed(2), W - 12, finalY, {
    align: 'right',
  });
  doc.setTextColor(30, 30, 30);
  finalY += 7;

  // Amount in words
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(amountInWords((sv.grandTotalPaise as number) ?? 0), 10, finalY);
  doc.setTextColor(0, 0, 0);

  // IRP e-Invoice QR (CGST Rule 48) - left side of footer area
  const eiv = sv.eInvoice as Record<string, unknown> | undefined;
  if (opts.irpQrBase64 && eiv?.irn) {
    try {
      const irpQrSize = 22;
      doc.addImage(opts.irpQrBase64, 'PNG', 10, finalY - 4, irpQrSize, irpQrSize);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text('e-Invoice QR (CGST Rule 48)', 10, finalY - 4 + irpQrSize + 3, {
        maxWidth: irpQrSize + 10,
      });
      const irnStr = eiv.irn as string;
      doc.text(`IRN: ${irnStr.slice(0, 20)}...`, 10, finalY - 4 + irpQrSize + 7, { maxWidth: 60 });
      doc.setTextColor(0, 0, 0);
    } catch {
      /* ignore - non-fatal */
    }
  }

  // UPI QR
  if (opts.qrBase64) {
    try {
      doc.addImage(opts.qrBase64, 'PNG', W - 34, finalY - 4, 22, 22);
    } catch {
      /* ignore */
    }
  }

  // Signature (showSignature flag; undefined and true both render)
  if (layout?.showSignature !== false && firm.brandProfile?.signatureUrl) {
    try {
      doc.addImage(firm.brandProfile.signatureUrl, 'PNG', W - 62, finalY + 5, 22, 11);
    } catch {
      /* ignore */
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Authorised Signatory', W - 62, finalY + 19);
  }

  // Fixed-position bottom bank details box - Vyapar signature layout
  // (showBankDetails flag; undefined and true both render)
  const bankBoxY = H - bottomReserve;
  if (layout?.showBankDetails !== false) {
    doc.setFillColor(245, 245, 245);
    doc.rect(8, bankBoxY, W - 16, bottomReserve - 10, 'F');
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(8, bankBoxY, W - 16, bottomReserve - 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text('Bank Details:', 12, bankBoxY + 5);
    doc.setFont('helvetica', 'normal');
    if (firm.brandProfile?.bankName) {
      doc.text(`Bank: ${firm.brandProfile.bankName}`, 12, bankBoxY + 10);
    }
    if (firm.brandProfile?.bankAccountNumber) {
      doc.text(`A/C No: ${firm.brandProfile.bankAccountNumber}`, 12, bankBoxY + 15);
    }
    if (firm.brandProfile?.bankIfsc) {
      doc.text(`IFSC: ${firm.brandProfile.bankIfsc}`, 12, bankBoxY + 20);
    }
  }

  // T&C in bottom right of bank box (showTermsAndConditions flag; undefined and true both render)
  if (layout?.showTermsAndConditions !== false && firm.brandProfile?.termsAndConditions) {
    const tcBoxY = layout?.showBankDetails !== false ? bankBoxY : H - bottomReserve;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(firm.brandProfile.termsAndConditions, W / 2 + 4, tcBoxY + 5, {
      maxWidth: W / 2 - 16,
    });
  }

  return doc;
}
