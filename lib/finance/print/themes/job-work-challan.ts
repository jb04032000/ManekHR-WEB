/**
 * Job-Work Challan theme
 * Title: JOB-WORK CHALLAN
 * Principal party block, material description table.
 * Columns: Bardaan No | Lot Ref | Material | Weight (kg) | HSN (9988) | Job-Work Charge
 * HSN 9988 (Manufacturing Services) @ 5% GST
 */
import type { PrintableVoucher, FirmProfile, PartyProfile, PrintOptions } from '../types';
import { amountInWords } from '../../amountInWords';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

export async function renderJobWorkChallan(
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

  // Header band
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, W, 26, 'F');

  if (firm.brandProfile?.logoUrl) {
    try {
      doc.addImage(firm.brandProfile.logoUrl, 'PNG', 10, 7, 14, 14);
    } catch {
      /* ignore */
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(firm.firmName, 28, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const firmMeta = [firm.gstin ? `GSTIN: ${firm.gstin}` : null, firm.phone ?? null]
    .filter(Boolean)
    .join(' · ');
  if (firmMeta) doc.text(firmMeta, 28, 20);

  doc.setTextColor(0, 0, 0);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('JOB-WORK CHALLAN', W / 2, 34, { align: 'center' });

  // Thin line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(10, 37, W - 10, 37);

  // Challan No + Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Challan No: ${voucher.voucherNumber ?? '(draft)'}`, 10, 44);
  doc.text(`Date: ${new Date(voucher.voucherDate).toLocaleDateString('en-IN')}`, W - 10, 44, {
    align: 'right',
  });

  // Principal Party block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Principal Party (From):', 10, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const partyLines: string[] = [
    party.name,
    party.gstin ? `GSTIN: ${party.gstin}` : null,
    party.address?.line1 ?? null,
    [party.address?.city, party.address?.state, party.address?.pincode].filter(Boolean).join(', '),
    party.phone ?? null,
  ].filter((l): l is string => !!l);
  partyLines.forEach((l, i) => doc.text(l, 10, 57 + i * 4.5));

  // Job-worker block (right side - this firm is the job worker)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Job Worker (To):', W / 2 + 4, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const jwLines: string[] = [
    firm.firmName,
    firm.gstin ? `GSTIN: ${firm.gstin}` : null,
    [firm.addressLine, firm.city, firm.state].filter(Boolean).join(', '),
    firm.phone ?? null,
  ].filter((l): l is string => !!l);
  jwLines.forEach((l, i) => doc.text(l, W / 2 + 4, 57 + i * 4.5));

  // Material description table
  // Map line items to job-work columns. The voucher line items are repurposed:
  //   itemName → Material description
  //   hsnSacCode → HSN (default 9988 if blank)
  //   qty → Weight (kg) or qty
  //   unit → unit
  //   ratePaise → Job-Work Charge (per unit)
  //   custom fields via item notes if available
  const lineRows = (voucher.lineItems ?? []).map((l, idx) => {
    const li = l as unknown as Record<string, unknown>;
    // Bardaan No from item note prefix like "B001" or use idx+1
    const bardaanNo = String(idx + 1);
    // Lot ref from itemId prefix or empty
    const lotRef = ((li.itemId as string) ?? '').substring(0, 10);
    const material = (li.itemName as string) ?? '';
    const weight = String(li.qty ?? 0);
    const hsn = (li.hsnSacCode as string) || '9988'; // default HSN for manufacturing services
    const charge = (((li.lineTotalPaise as number) ?? 0) / 100).toFixed(2);
    return [bardaanNo, lotRef, material, weight, hsn, charge];
  });

  autoTable(doc, {
    startY: 78,
    head: [
      [
        'Bardaan No',
        'Lot Ref',
        'Material Description',
        'Weight (kg)',
        'HSN',
        'Job-Work Charge (₹)',
      ],
    ],
    body: lineRows,
    styles: { fontSize: 9 },
    headStyles: {
      fillColor: [pr, pg, pb] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 20 },
      2: { cellWidth: 'auto' as unknown as number },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 16 },
      5: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: 10, right: 10 },
  });

  const tableResult = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  let finalY = (tableResult?.finalY ?? 120) + 6;

  // Totals (no GST split - HSN 9988 @5% is stated as a single tax line)
  const totalsX = W - 90;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const row = (label: string, value: string, bold = false) => {
    if (bold) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
    }
    doc.text(label, totalsX, finalY);
    doc.text(value, W - 12, finalY, { align: 'right' });
    if (bold) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
    }
    finalY += bold ? 6 : 5;
  };

  row('Subtotal (Job-Work Charges)', '₹' + (((sv.subtotalPaise as number) ?? 0) / 100).toFixed(2));
  row(
    'GST @5% (HSN 9988)',
    '₹' +
      (
        (((sv.cgstPaise as number) ?? 0) +
          ((sv.sgstPaise as number) ?? 0) +
          ((sv.igstPaise as number) ?? 0)) /
        100
      ).toFixed(2),
  );
  if (((sv.cessPaise as number) ?? 0) > 0) {
    row('Cess', '₹' + (((sv.cessPaise as number) ?? 0) / 100).toFixed(2));
  }
  if (((sv.roundOffPaise as number) ?? 0) !== 0) {
    const rp = sv.roundOffPaise as number;
    row('Round-off', (rp > 0 ? '+' : '-') + '₹' + (Math.abs(rp) / 100).toFixed(2));
  }
  row('Grand Total', '₹' + (((sv.grandTotalPaise as number) ?? 0) / 100).toFixed(2), true);

  // Amount in words
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(amountInWords((sv.grandTotalPaise as number) ?? 0), 10, finalY);
  doc.setTextColor(0, 0, 0);
  finalY += 10;

  // UPI QR
  if (opts.qrBase64) {
    try {
      doc.addImage(opts.qrBase64, 'PNG', W - 34, finalY - 4, 22, 22);
    } catch {
      /* ignore */
    }
  }

  // Signatures
  finalY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Prepared by:', 10, finalY + 12);
  doc.setDrawColor(100, 100, 100);
  doc.line(10, finalY + 10, 60, finalY + 10);
  doc.line(W - 60, finalY + 10, W - 10, finalY + 10);
  doc.text('Authorised Signatory', W - 10, finalY + 14, { align: 'right' });

  if (firm.brandProfile?.signatureUrl) {
    try {
      doc.addImage(firm.brandProfile.signatureUrl, 'PNG', W - 52, finalY, 22, 9);
    } catch {
      /* ignore */
    }
  }

  // Footer
  if (firm.brandProfile?.termsAndConditions) {
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(firm.brandProfile.termsAndConditions, 10, pageH - 10, { maxWidth: W - 20 });
  }

  void opts;
  return doc;
}
