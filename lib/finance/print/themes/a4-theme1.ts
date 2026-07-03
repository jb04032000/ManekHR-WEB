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

export async function renderA4Theme1(
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
  // 2f: show + reason about the seller GSTIN this invoice was issued under.
  const sellerGstin = (sv.sellerGstin as string | undefined) ?? firm.gstin;

  // Header band
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, W, 30, 'F');

  // Logo top-left
  if (firm.brandProfile?.logoUrl) {
    try {
      doc.addImage(firm.brandProfile.logoUrl, 'PNG', 10, 8, 16, 16);
    } catch {
      /* ignore if image fails */
    }
  }

  // Firm name + info in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(firm.firmName, 30, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const firmMeta = [
    firm.brandProfile?.upiId ? `UPI: ${firm.brandProfile.upiId}` : null,
    sellerGstin ? `GSTIN: ${sellerGstin}` : null,
    firm.phone ?? null,
    firm.email ?? null,
  ]
    .filter(Boolean)
    .join(' · ');
  if (firmMeta) doc.text(firmMeta, 30, 21);

  // Address line in header
  const addrParts = [firm.addressLine, firm.city, firm.state, firm.pincode]
    .filter(Boolean)
    .join(', ');
  if (addrParts) doc.text(addrParts, 30, 26);

  doc.setTextColor(0, 0, 0);

  // Voucher title (Bill of Supply overrides the tax-invoice title for composition / exempt sales)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const title =
    sv.isBillOfSupply && vt === 'sale_invoice'
      ? 'BILL OF SUPPLY'
      : (VOUCHER_TITLES[vt] ?? 'VOUCHER');
  doc.text(title, W / 2, 38, { align: 'center' });

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(10, 41, W - 10, 41);

  // Bill-To block (left column)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 10, 48);
  doc.setFont('helvetica', 'normal');
  const partyLines: string[] = [
    party.name,
    party.gstin ? `GSTIN: ${party.gstin}` : null,
    party.address?.line1 ?? null,
    party.address?.line2 ?? null,
    [party.address?.city, party.address?.state, party.address?.pincode].filter(Boolean).join(', '),
    party.phone ?? null,
  ].filter((l): l is string => !!l);
  partyLines.forEach((l, i) => doc.text(l, 10, 54 + i * 5));

  // Voucher meta (right column)
  const metaX = W - 85;
  doc.setFont('helvetica', 'bold');
  doc.text(`Voucher No:`, metaX, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(voucher.voucherNumber ?? '(draft)', metaX + 28, 48);
  doc.setFont('helvetica', 'bold');
  doc.text(`Date:`, metaX, 54);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(voucher.voucherDate).toLocaleDateString('en-IN'), metaX + 28, 54);
  if (sv.dueDate) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Due Date:`, metaX, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(sv.dueDate as string).toLocaleDateString('en-IN'), metaX + 28, 60);
  }
  if (sv.placeOfSupplyStateCode) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Place of Supply:`, metaX, 66);
    doc.setFont('helvetica', 'normal');
    doc.text(sv.placeOfSupplyStateCode as string, metaX + 40, 66);
  }

  // Line items table
  const isIntra =
    !!sv.placeOfSupplyStateCode && sv.placeOfSupplyStateCode === (sellerGstin?.slice(0, 2) ?? '');

  // invoiceLayout flags: undefined and true both render; only explicit false hides.
  const layout = firm.invoiceLayout;
  const showHsn = layout?.showHsnColumn !== false;
  const showDisc = layout?.showDiscountColumn !== false;

  const lineRows = (voucher.lineItems ?? []).map((l, idx) => {
    const li = l as unknown as Record<string, unknown>;
    const taxColumns = isIntra
      ? [
          (((li.cgstPaise as number) ?? 0) / 100).toFixed(2),
          (((li.sgstPaise as number) ?? 0) / 100).toFixed(2),
        ]
      : [(((li.igstPaise as number) ?? 0) / 100).toFixed(2)];
    // R11: append the textile dual-unit breakdown to the item name when present, e.g.
    // "Cotton fabric (5 than x 100)". qty/unit columns still show the billing total.
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
      ...taxColumns,
      (((li.lineTotalPaise as number) ?? 0) / 100).toFixed(2),
    );
    return row;
  });

  const taxColumns = isIntra ? ['CGST', 'SGST'] : ['IGST'];
  const tableHead: string[] = ['#', 'Item'];
  if (showHsn) tableHead.push('HSN/SAC');
  tableHead.push('Qty', 'Unit', 'Rate');
  if (showDisc) tableHead.push('Disc%');
  tableHead.push('Tax%', ...taxColumns, 'Amount');

  // Column index helper - tax/amount columns shift when HSN or Disc are hidden.
  const taxColStart = tableHead.indexOf(taxColumns[0]);
  const amtColIdx = tableHead.length - 1;
  const colStyles: Record<number, { halign: 'right' }> = {};
  for (let c = taxColStart; c <= amtColIdx; c++) colStyles[c] = { halign: 'right' as const };

  autoTable(doc, {
    startY: 80,
    head: [tableHead],
    body: lineRows as unknown as (string | number)[][],
    styles: { fontSize: 9 },
    headStyles: {
      fillColor: [pr, pg, pb] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
    },
    columnStyles: {
      0: { cellWidth: 8 },
      ...colStyles,
    },
    margin: { left: 10, right: 10 },
  });

  // Totals
  const tableResult = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  let finalY = (tableResult?.finalY ?? 120) + 6;
  const totalsX = W - 90;

  const row = (label: string, value: string) => {
    doc.text(label, totalsX, finalY);
    doc.text(value, W - 12, finalY, { align: 'right' });
    finalY += 5;
  };

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  row('Subtotal', '₹' + (((sv.subtotalPaise as number) ?? 0) / 100).toFixed(2));
  if (((sv.totalDiscountPaise as number) ?? 0) > 0) {
    row('Discount', '- ₹' + (((sv.totalDiscountPaise as number) ?? 0) / 100).toFixed(2));
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

  // Grand total (bold, larger)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setFillColor(245, 245, 245);
  doc.rect(totalsX - 4, finalY - 4, W - totalsX - 8, 7, 'F');
  doc.text('Grand Total', totalsX, finalY);
  doc.text('₹' + (((sv.grandTotalPaise as number) ?? 0) / 100).toFixed(2), W - 12, finalY, {
    align: 'right',
  });
  finalY += 7;

  // Amount in words
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(amountInWords((sv.grandTotalPaise as number) ?? 0), 10, finalY);
  doc.setTextColor(0, 0, 0);
  finalY += 10;

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

  // IRP e-Invoice QR (CGST Rule 48) - drawn left of UPI QR / signature block
  const eiv = sv.eInvoice as Record<string, unknown> | undefined;
  if (opts.irpQrBase64 && eiv?.irn) {
    try {
      // Place IRP QR at left side of footer area, beside bank details
      const irpQrX = 10;
      const irpQrY = finalY - 2;
      const irpQrSize = 22;
      doc.addImage(opts.irpQrBase64, 'PNG', irpQrX, irpQrY, irpQrSize, irpQrSize);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      doc.text('e-Invoice QR (CGST Rule 48)', irpQrX, irpQrY + irpQrSize + 3, {
        maxWidth: irpQrSize + 10,
      });
      const irnStr = eiv.irn as string;
      doc.text(`IRN: ${irnStr.slice(0, 20)}...`, irpQrX, irpQrY + irpQrSize + 7, { maxWidth: 60 });
      doc.setTextColor(0, 0, 0);
    } catch {
      /* ignore - non-fatal */
    }
  }

  // Bank details + UPI QR (showBankDetails flag; undefined and true both render)
  if (layout?.showBankDetails !== false && firm.brandProfile?.bankAccountNumber) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Bank Details:', 10, finalY);
    doc.setFont('helvetica', 'normal');
    finalY += 5;
    doc.text(
      `${firm.brandProfile.bankName ?? ''} · A/C ${firm.brandProfile.bankAccountNumber} · IFSC ${firm.brandProfile.bankIfsc ?? ''}`,
      10,
      finalY,
    );
  }

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

  // Footer T&C (showTermsAndConditions flag; undefined and true both render)
  if (layout?.showTermsAndConditions !== false && firm.brandProfile?.termsAndConditions) {
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(firm.brandProfile.termsAndConditions, 10, pageH - 10, {
      maxWidth: W - 20,
    });
  }

  return doc;
}
