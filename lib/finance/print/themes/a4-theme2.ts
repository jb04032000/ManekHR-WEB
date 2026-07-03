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

export async function renderA4Theme2(
  voucher: PrintableVoucher,
  firm: FirmProfile,
  party: PartyProfile,
  opts: PrintOptions,
): Promise<unknown> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const primaryHex = firm.brandProfile?.primaryColor ?? '#0B6E4F';
  const [pr, pg, pb] = hexToRgb(primaryHex);
  const sv = voucher as unknown as Record<string, unknown>;
  const vt = sv.voucherType as string;
  // 2f: seller GSTIN this invoice was issued under (multi-GSTIN firms).
  const sellerGstin = (sv.sellerGstin as string | undefined) ?? firm.gstin;

  // No header band - clean white start
  // Logo centered top
  let cursorY = 12;
  if (firm.brandProfile?.logoUrl) {
    try {
      doc.addImage(firm.brandProfile.logoUrl, 'PNG', W / 2 - 12, cursorY, 24, 16);
      cursorY += 20;
    } catch {
      cursorY += 0;
    }
  }

  // Firm name centered
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(firm.firmName, W / 2, cursorY, { align: 'center' });
  cursorY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const firmMeta = [
    sellerGstin ? `GSTIN: ${sellerGstin}` : null,
    firm.phone ?? null,
    firm.email ?? null,
    [firm.addressLine, firm.city, firm.state].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join('  |  ');
  if (firmMeta) {
    doc.text(firmMeta, W / 2, cursorY, { align: 'center' });
    cursorY += 5;
  }

  // Thin accent line
  doc.setDrawColor(pr, pg, pb);
  doc.setLineWidth(0.5);
  doc.line(10, cursorY, W - 10, cursorY);
  cursorY += 6;

  // Voucher title + number row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  const title =
    sv.isBillOfSupply && vt === 'sale_invoice'
      ? 'BILL OF SUPPLY'
      : (VOUCHER_TITLES[vt] ?? 'VOUCHER');
  doc.text(title, 10, cursorY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date(voucher.voucherDate).toLocaleDateString('en-IN');
  doc.text(`${voucher.voucherNumber ?? '(draft)'}  ·  ${dateStr}`, W - 10, cursorY, {
    align: 'right',
  });
  cursorY += 8;

  // Party + meta block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('BILL TO', 10, cursorY);
  cursorY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(party.name, 10, cursorY);
  cursorY += 4;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  if (party.gstin) {
    doc.text(`GSTIN: ${party.gstin}`, 10, cursorY);
    cursorY += 4;
  }
  const partyAddr = [
    party.address?.line1,
    party.address?.city,
    party.address?.state,
    party.address?.pincode,
  ]
    .filter(Boolean)
    .join(', ');
  if (partyAddr) {
    doc.text(partyAddr, 10, cursorY);
    cursorY += 4;
  }
  if (party.phone) {
    doc.text(party.phone, 10, cursorY);
    cursorY += 4;
  }

  // Due date right side
  if (sv.dueDate) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Due: ${new Date(sv.dueDate as string).toLocaleDateString('en-IN')}`,
      W - 10,
      cursorY - 8,
      { align: 'right' },
    );
  }

  cursorY += 4;

  // Line items table - borderless with alternating rows
  const isIntra =
    !!sv.placeOfSupplyStateCode && sv.placeOfSupplyStateCode === (sellerGstin?.slice(0, 2) ?? '');

  // invoiceLayout flags: undefined and true both render; only explicit false hides.
  const layout = firm.invoiceLayout;
  const showHsn = layout?.showHsnColumn !== false;
  const showDisc = layout?.showDiscountColumn !== false;

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
    if (showHsn) row.push(li.hsnSacCode ?? '');
    row.push(li.qty ?? 0, li.unit ?? '', (((li.ratePaise as number) ?? 0) / 100).toFixed(2));
    if (showDisc) row.push(`${li.discountPct ?? 0}%`);
    row.push(
      `${li.taxRate ?? 0}%`,
      ...taxValues,
      (((li.lineTotalPaise as number) ?? 0) / 100).toFixed(2),
    );
    return row;
  });

  const tableHead2: string[] = ['#', 'Item'];
  if (showHsn) tableHead2.push('HSN/SAC');
  tableHead2.push('Qty', 'Unit', 'Rate');
  if (showDisc) tableHead2.push('Disc%');
  tableHead2.push('Tax%', ...taxCols, 'Amount');

  const taxColStart2 = tableHead2.indexOf(taxCols[0]);
  const amtColIdx2 = tableHead2.length - 1;
  const colStyles2: Record<number, { halign: 'right' | 'center' }> = {
    0: { halign: 'center' as const },
  };
  for (let c = taxColStart2; c <= amtColIdx2; c++) colStyles2[c] = { halign: 'right' as const };

  autoTable(doc, {
    startY: cursorY,
    head: [tableHead2],
    body: lineRows as unknown as (string | number)[][],
    styles: {
      fontSize: 8.5,
      lineWidth: 0, // borderless
    },
    headStyles: {
      fillColor: [240, 240, 240] as [number, number, number],
      textColor: [30, 30, 30] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] as [number, number, number],
    },
    bodyStyles: {
      textColor: [40, 40, 40] as [number, number, number],
    },
    columnStyles: colStyles2,
    margin: { left: 10, right: 10 },
  });

  const tableResult = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  let finalY = (tableResult?.finalY ?? cursorY + 30) + 6;

  // Thin accent line before totals
  doc.setDrawColor(pr, pg, pb);
  doc.setLineWidth(0.3);
  doc.line(W / 2, finalY, W - 10, finalY);
  finalY += 5;

  const totalsX = W - 90;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);

  const row = (label: string, value: string, bold = false) => {
    if (bold) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
    }
    doc.text(label, totalsX, finalY);
    doc.text(value, W - 12, finalY, { align: 'right' });
    if (bold) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
    }
    finalY += bold ? 7 : 5;
  };

  row('Subtotal', '₹' + (((sv.subtotalPaise as number) ?? 0) / 100).toFixed(2));
  if (((sv.totalDiscountPaise as number) ?? 0) > 0) {
    row('Discount', '- ₹' + (((sv.totalDiscountPaise as number) ?? 0) / 100).toFixed(2));
    // Reverse-charge declaration (mandatory note when tax is payable by the recipient).
    if (sv.isReverseCharge) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Tax payable under reverse charge: Yes', 10, finalY);
      doc.setFont('helvetica', 'normal');
      finalY += 7;
    }

    // Bill of Supply declaration (composition dealer cannot collect tax - Rule 49 / Rule 5(1)(f)).
    if (sv.isBillOfSupply) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.text('Composition taxable person, not eligible to collect tax on supplies.', 10, finalY, {
        maxWidth: W - 20,
      });
      doc.setFont('helvetica', 'normal');
      finalY += 7;
    }
  }
  row('Taxable Value', '₹' + (((sv.taxableValuePaise as number) ?? 0) / 100).toFixed(2));
  if (isIntra) {
    row('CGST', '₹' + (((sv.cgstPaise as number) ?? 0) / 100).toFixed(2));
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

  row('Grand Total', '₹' + (((sv.grandTotalPaise as number) ?? 0) / 100).toFixed(2), true);

  // Amount in words
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text(amountInWords((sv.grandTotalPaise as number) ?? 0), 10, finalY);
  doc.setTextColor(0, 0, 0);
  finalY += 10;

  // IRP e-Invoice QR (CGST Rule 48)
  const eiv = sv.eInvoice as Record<string, unknown> | undefined;
  if (opts.irpQrBase64 && eiv?.irn) {
    try {
      const irpQrSize = 22;
      // Place IRP QR at left, UPI QR at right - both in the same footer band
      doc.addImage(opts.irpQrBase64, 'PNG', 10, finalY - 4, irpQrSize, irpQrSize);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(120, 120, 120);
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

  // UPI QR code
  if (opts.qrBase64) {
    try {
      doc.addImage(opts.qrBase64, 'PNG', W - 34, finalY - 4, 22, 22);
    } catch {
      /* ignore */
    }
  }

  // Footer T&C (showTermsAndConditions flag; undefined and true both render)
  if (layout?.showTermsAndConditions !== false && firm.brandProfile?.termsAndConditions) {
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text(firm.brandProfile.termsAndConditions, 10, pageH - 10, { maxWidth: W - 20 });
  }

  void opts; // acknowledge opts (qrBase64 used above)
  return doc;
}
