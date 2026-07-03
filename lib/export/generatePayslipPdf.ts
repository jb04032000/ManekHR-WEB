import dayjs from 'dayjs';
import { loadImageAsBase64 } from './imageUtils';
import { calculateComponents } from '@/features/salary/utils/component-calculator';
import { makePdfCurrencyFormatter, type CurrencyConfig } from '@/lib/currency';
import type {
  SalaryRecord,
  TeamMember,
  SalaryAdjustment,
  Payment,
  SalaryComponentTemplate,
} from '@/types';

type JsPdfInstance = InstanceType<typeof import('jspdf').jsPDF>;
type AutoTableFn = typeof import('jspdf-autotable').default;
type JsPdfWithAutoTable = JsPdfInstance & { lastAutoTable?: { finalY?: number } };

let autoTableRenderer: AutoTableFn | null = null;

export interface PayslipBranding {
  includeHeaderLogo: boolean;
  headerLogoUrl?: string;
  includeWatermark: boolean;
  watermarkLogoUrl?: string;
  includeFooter: boolean;
  footerText?: string;
  showExportDate?: boolean;
}

export interface PayslipData {
  record: SalaryRecord & { teamMember?: TeamMember; paidAmount?: number };
  adjustments: SalaryAdjustment[];
  payments: Payment[];
  componentTemplate?: SalaryComponentTemplate | null;
  workspaceName: string;
  branding?: PayslipBranding;
  currencyConfig?: CurrencyConfig;
  /** Informational only: outstanding advance balance for this member. Does NOT affect net salary. */
  advanceOutstanding?: number;
  /** Informational only: outstanding employer loan balance for this member. Does NOT affect net salary. */
  loanOutstanding?: number;
}

export interface PayslipOptions {
  payslips: PayslipData[];
  mode: 'individual' | 'combined';
}

export interface PayslipResult {
  blob: Blob;
  filename: string;
}

interface PreparedPayslipAssets {
  brandColor: [number, number, number];
  headerLogoBase64: string | null;
  watermarkBase64: string | null;
}

interface PageDecorationInfo {
  startPage: number;
  endPage: number;
  brandColor: [number, number, number];
  watermarkBase64: string | null;
  branding?: PayslipBranding;
}

function getAutoTable(): AutoTableFn {
  if (!autoTableRenderer) {
    throw new Error('Payslip PDF renderer is not initialized.');
  }
  return autoTableRenderer;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

function getBrandColor(): [number, number, number] {
  const rawColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--cr-primary')
    .trim();
  const brandHex = rawColor || 'var(--cr-indigo-400)';
  return hexToRgb(brandHex);
}

function formatCategory(cat: string): string {
  return cat
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

function getPeriodLabel(record: SalaryRecord): string {
  return dayjs()
    .year(record.year)
    .month(record.month - 1)
    .date(1)
    .format('MMMM YYYY');
}

function getSalaryBasisLabel(record: SalaryRecord): string {
  if (record.salaryDayBasis === 'calendar_month_days') {
    const basisDays =
      record.totalDays ||
      dayjs()
        .year(record.year)
        .month(record.month - 1)
        .date(1)
        .daysInMonth();
    return `Calendar ${basisDays} days`;
  }

  const fixedDays = record.fixedMonthDays ?? record.totalDays ?? 0;
  return `Fixed ${fixedDays} days`;
}

function getAttendanceModeLabel(record: SalaryRecord): string {
  return record.attendancePayModeApplied === 'disabled' ? 'Ignored' : 'Attendance based';
}

function getExportFilePeriod(record: SalaryRecord): string {
  return getPeriodLabel(record).replace(/\s+/g, '_');
}

function getMemberSnapshot(
  record: SalaryRecord & { teamMember?: TeamMember },
): Partial<TeamMember> & {
  id?: string;
  name?: string;
  designation?: string;
} {
  if (record.teamMember) {
    return record.teamMember;
  }

  if (typeof record.teamMemberId === 'string') {
    return { id: record.teamMemberId };
  }

  return {
    id: record.teamMemberId._id,
    name: record.teamMemberId.name,
    designation: record.teamMemberId.designation,
  };
}

function getEmployeeName(record: SalaryRecord & { teamMember?: TeamMember }): string {
  return getMemberSnapshot(record).name || 'Employee';
}

function getEmployeeIdDisplay(record: SalaryRecord & { teamMember?: TeamMember }): string {
  const member = getMemberSnapshot(record);
  if (member.employeeCode) return member.employeeCode;
  const rawId = member.id || '';
  if (!rawId) return '-';
  return rawId.slice(-6).toUpperCase();
}

async function getImageAspectRatio(imageSrc: string): Promise<number> {
  return new Promise<number>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = () => resolve(3);
    img.src = imageSrc;
  });
}

function drawPageDecorations(
  doc: JsPdfInstance,
  pageNumber: number,
  totalPages: number,
  brandColor: [number, number, number],
  watermarkBase64: string | null,
  branding?: PayslipBranding,
): void {
  const [r, g, b] = brandColor;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const footerReserved = 8;

  if (watermarkBase64) {
    const wmProps = doc.getImageProperties(watermarkBase64);
    const wmAspect = wmProps.width / wmProps.height;
    const wmSize = Math.min(pageWidth, pageHeight) * 0.45;
    const wmW = wmAspect >= 1 ? wmSize : wmSize * wmAspect;
    const wmH = wmAspect >= 1 ? wmSize / wmAspect : wmSize;
    const wmX = (pageWidth - wmW) / 2;
    const wmY = (pageHeight - wmH) / 2;
    const gs = new (
      doc as unknown as { GState: new (opts: { opacity: number }) => unknown }
    ).GState({ opacity: 0.08 });

    doc.saveGraphicsState();
    doc.setGState(gs);
    doc.addImage(watermarkBase64, 'PNG', wmX, wmY, wmW, wmH);
    doc.restoreGraphicsState();
  }

  const footerLineY = pageHeight - footerReserved;

  doc.setFillColor(248, 249, 250);
  doc.rect(0, footerLineY - 1, pageWidth, footerReserved + 1, 'F');

  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.4);
  doc.line(0, footerLineY - 1, pageWidth, footerLineY - 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);

  if (branding?.includeFooter && branding.footerText) {
    doc.text(branding.footerText, marginX, footerLineY + 4, {
      maxWidth: pageWidth * 0.45,
    });
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(140, 140, 140);
  doc.text(
    'This is a computer-generated document and does not require a signature.',
    pageWidth / 2,
    footerLineY + 4,
    { align: 'center' },
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - marginX, footerLineY + 4, {
    align: 'right',
  });
}

function applyPageDecorations(doc: JsPdfInstance, pageDecorations: PageDecorationInfo[]): void {
  const totalPages = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const match = pageDecorations.find(
      (decoration) => pageNumber >= decoration.startPage && pageNumber <= decoration.endPage,
    );

    if (!match) continue;

    doc.setPage(pageNumber);
    drawPageDecorations(
      doc,
      pageNumber,
      totalPages,
      match.brandColor,
      match.watermarkBase64,
      match.branding,
    );
  }
}

function getPayslipFilename(data: PayslipData): string {
  const employeeName = sanitizeFilenamePart(getEmployeeName(data.record));
  const period = getExportFilePeriod(data.record);
  return `Payslip_${employeeName}_${period}.pdf`;
}

async function prepareAssets(
  branding: PayslipBranding | undefined,
): Promise<PreparedPayslipAssets> {
  const brandColor = getBrandColor();

  if (!branding) {
    return {
      brandColor,
      headerLogoBase64: null,
      watermarkBase64: null,
    };
  }

  const [headerLogoBase64, watermarkBase64] = await Promise.all([
    branding.includeHeaderLogo && branding.headerLogoUrl
      ? loadImageAsBase64(branding.headerLogoUrl)
      : Promise.resolve(null),
    branding.includeWatermark && branding.watermarkLogoUrl
      ? loadImageAsBase64(branding.watermarkLogoUrl)
      : Promise.resolve(null),
  ]);

  return {
    brandColor,
    headerLogoBase64,
    watermarkBase64,
  };
}

function drawInfoRow(
  doc: JsPdfInstance,
  label: string,
  value: string,
  x: number,
  y: number,
  valueOffset: number,
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(95, 99, 104);
  doc.text(label, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(25, 25, 25);
  doc.text(value, x + valueOffset, y);
}

function formatPaymentMode(paymentMode?: string): string {
  return titleCase(paymentMode || 'cash');
}

function getPaymentStatus(payment: Payment): string {
  return titleCase(payment.status || 'active');
}

function getNetPay(record: SalaryRecord, additionsTotal: number, deductionsTotal: number): number {
  if (Number.isFinite(record.netSalary)) {
    return record.netSalary;
  }

  return (record.baseSalary || 0) + additionsTotal - deductionsTotal;
}

function getPaidAmount(
  record: SalaryRecord & { paidAmount?: number },
  payments: Payment[],
): number {
  if (typeof record.paidAmount === 'number') {
    return record.paidAmount;
  }

  return payments
    .filter((payment) => payment.status !== 'reversed')
    .reduce((sum, payment) => sum + payment.amount + (payment.commission || 0), 0);
}

async function renderPayslip(
  doc: JsPdfInstance,
  data: PayslipData,
  pageIndex: number,
  brandColor: [number, number, number],
  headerLogoBase64: string | null,
  watermarkBase64: string | null,
): Promise<void> {
  void pageIndex;
  void watermarkBase64;

  const autoTable = getAutoTable();
  const [r, g, b] = brandColor;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const footerReserved = 8;
  const contentBottom = pageHeight - footerReserved - 6;
  const periodLabel = getPeriodLabel(data.record);
  const member = getMemberSnapshot(data.record);
  const designation = member.designation || '-';
  const salaryMode = titleCase(member.salaryType || 'monthly');
  const employeeName = getEmployeeName(data.record);
  const additions = data.adjustments.filter(
    (adjustment) => adjustment.type === 'addition' && adjustment.status === 'active',
  );
  const deductions = data.adjustments.filter(
    (adjustment) => adjustment.type === 'deduction' && adjustment.status === 'active',
  );
  const activePayments = data.payments.filter((payment) => payment.status !== 'reversed');
  const currencyFmt = makePdfCurrencyFormatter(data.currencyConfig);

  let cursorY = 10;

  if (headerLogoBase64) {
    cursorY = 1;
    const aspectRatio = await getImageAspectRatio(headerLogoBase64);
    const maxLogoW = pageWidth * 0.85;
    let displayW = maxLogoW;
    let displayH = displayW / aspectRatio;
    const maxLogoH = 30;

    if (displayH > maxLogoH) {
      displayH = maxLogoH;
      displayW = displayH * aspectRatio;
    }

    const logoX = (pageWidth - displayW) / 2;
    const logoY = cursorY;

    doc.addImage(headerLogoBase64, 'PNG', logoX, logoY, displayW, displayH, undefined, 'FAST');

    cursorY = logoY + displayH + 2;
    doc.setFillColor(r, g, b);
    doc.rect(marginX, cursorY, pageWidth - 2 * marginX, 0.5, 'F');
    cursorY += 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(25, 25, 25);
  doc.text('PAYSLIP', pageWidth / 2, cursorY, { align: 'center' });

  // Status badge (right-aligned next to title)
  const statusLabel = titleCase(data.record.status || 'pending');
  const statusColors: Record<string, [number, number, number]> = {
    paid: [22, 163, 74],
    partial: [217, 119, 6],
    pending: [220, 38, 38],
    advance: [37, 99, 235],
  };
  const statusClr = statusColors[data.record.status] ?? [100, 100, 100];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...statusClr);
  doc.text(statusLabel, pageWidth - marginX, cursorY, { align: 'right' });

  cursorY += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(25, 25, 25);
  doc.text(data.workspaceName, marginX, cursorY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(periodLabel, pageWidth - marginX, cursorY, { align: 'right' });

  if (data.branding?.showExportDate ?? true) {
    const exportedAt = dayjs().format('DD MMM YYYY, hh:mm A');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${exportedAt}`, pageWidth - marginX, cursorY + 4.5, {
      align: 'right',
    });
  }

  cursorY += 10;

  const infoBoxY = cursorY;
  const columnGap = 10;
  const infoBoxW = pageWidth - 2 * marginX;
  const columnW = (infoBoxW - columnGap) / 2;
  const leftX = marginX + 4;
  const rightX = marginX + columnW + columnGap + 4;
  const rowH = 8;
  const valueOffset = 21;

  // Build info rows dynamically - only show rows with data
  const infoRows: Array<{ left: [string, string]; right: [string, string] }> = [
    { left: ['Employee', employeeName], right: ['Designation', designation] },
    {
      left: ['Employee ID', getEmployeeIdDisplay(data.record)],
      right: ['Pay Period', periodLabel],
    },
    {
      left: ['Salary Mode', salaryMode],
      right: ['Salary Basis', getSalaryBasisLabel(data.record)],
    },
  ];
  if (member.email || member.mobile) {
    infoRows.push({
      left: ['Email', member.email || '-'],
      right: ['Phone', member.mobile || '-'],
    });
  }

  const infoBoxH = 4 + infoRows.length * rowH;

  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(230, 233, 238);
  doc.roundedRect(marginX, infoBoxY, infoBoxW, infoBoxH, 2, 2, 'FD');

  infoRows.forEach((row, i) => {
    const y = infoBoxY + 7 + i * rowH;
    drawInfoRow(doc, row.left[0], row.left[1], leftX, y, valueOffset);
    drawInfoRow(doc, row.right[0], row.right[1], rightX, y, valueOffset);
  });

  cursorY = infoBoxY + infoBoxH + 8;

  let earningsRows: { label: string; amount: number }[] = [];

  if (member.ctcAmount && member.componentTemplateId && data.componentTemplate) {
    const { breakdown } = calculateComponents(
      member.ctcAmount,
      data.componentTemplate.components,
      member.componentOverrides || [],
    );

    earningsRows = breakdown
      .filter((component) => component.includedInCtc)
      .map((component) => ({
        label: component.name,
        amount: component.calculatedAmount,
      }));

    const aboveCtc = breakdown.filter((component) => !component.includedInCtc);
    for (const component of aboveCtc) {
      earningsRows.push({
        label: `${component.name} (Employer)`,
        amount: component.calculatedAmount,
      });
    }
  } else {
    earningsRows = [{ label: 'Base Pay', amount: data.record.baseSalary || 0 }];
  }

  additions.forEach((adjustment) => {
    earningsRows.push({
      label: adjustment.reasonTitle || formatCategory(adjustment.category),
      amount: adjustment.amount,
    });
  });

  const deductionRows = deductions.map((adjustment) => ({
    label: adjustment.reasonTitle || formatCategory(adjustment.category),
    amount: adjustment.amount,
  }));

  const totalEarnings = earningsRows.reduce((sum, row) => sum + row.amount, 0);
  const totalDeductions = deductionRows.reduce((sum, row) => sum + row.amount, 0);

  const tableStartY = cursorY;
  const centerX = pageWidth / 2;
  const tableGap = 4;
  const leftTableWidth = centerX - marginX - tableGap;
  const rightTableX = centerX + tableGap;
  const rightTableWidth = pageWidth - marginX - rightTableX;

  const sectionHeadStyles = {
    fillColor: [r, g, b] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: 'bold' as const,
    fontSize: 8.5,
    halign: 'left' as const,
    cellPadding: { top: 3.2, bottom: 3.2, left: 4, right: 4 },
  };

  const commonBodyStyles = {
    fontSize: 8,
    textColor: [40, 40, 40] as [number, number, number],
    cellPadding: { top: 2.8, bottom: 2.8, left: 4, right: 4 },
    font: 'helvetica',
    fontStyle: 'normal' as const,
  };

  // Build table body arrays then pad the shorter side so both have equal rows
  const earningsBody: (string | { content: string; styles?: Record<string, unknown> })[][] =
    earningsRows.map((row) => [row.label, currencyFmt.full(row.amount)]);
  earningsBody.push([
    { content: 'Total Earnings', styles: { fontStyle: 'bold' } },
    { content: currencyFmt.full(totalEarnings), styles: { fontStyle: 'bold', halign: 'right' } },
  ]);

  const deductionsBody: (string | { content: string; styles?: Record<string, unknown> })[][] =
    deductionRows.length > 0
      ? [
          ...deductionRows.map((row) => [row.label, currencyFmt.full(row.amount)]),
          [
            { content: 'Total Deductions', styles: { fontStyle: 'bold' } },
            {
              content: currencyFmt.full(totalDeductions),
              styles: { fontStyle: 'bold', halign: 'right' },
            },
          ],
        ]
      : [
          [
            { content: 'No deductions', styles: { textColor: [150, 150, 150] } },
            {
              content: currencyFmt.full(0),
              styles: { textColor: [150, 150, 150], halign: 'right' },
            },
          ],
          [
            { content: 'Total Deductions', styles: { fontStyle: 'bold' } },
            { content: currencyFmt.full(0), styles: { fontStyle: 'bold', halign: 'right' } },
          ],
        ];

  // Pad shorter table with empty rows for visual balance
  while (earningsBody.length < deductionsBody.length)
    earningsBody.splice(earningsBody.length - 1, 0, ['', '']);
  while (deductionsBody.length < earningsBody.length)
    deductionsBody.splice(deductionsBody.length - 1, 0, ['', '']);

  autoTable(doc, {
    startY: tableStartY,
    head: [['EARNINGS', 'AMOUNT']],
    body: earningsBody,
    tableWidth: leftTableWidth,
    margin: {
      left: marginX,
      right: pageWidth - marginX - leftTableWidth,
      bottom: footerReserved + 2,
    },
    headStyles: sectionHeadStyles,
    bodyStyles: commonBodyStyles,
    alternateRowStyles: { fillColor: [246, 248, 251] as [number, number, number] },
    styles: {
      overflow: 'linebreak',
      lineColor: [215, 218, 224] as [number, number, number],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: leftTableWidth * 0.63 },
      1: { cellWidth: leftTableWidth * 0.37, halign: 'right' },
    },
  });
  const leftFinalY = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? tableStartY;

  autoTable(doc, {
    startY: tableStartY,
    head: [['DEDUCTIONS', 'AMOUNT']],
    body: deductionsBody,
    tableWidth: rightTableWidth,
    margin: { left: rightTableX, right: marginX, bottom: footerReserved + 2 },
    headStyles: sectionHeadStyles,
    bodyStyles: commonBodyStyles,
    alternateRowStyles: { fillColor: [246, 248, 251] as [number, number, number] },
    styles: {
      overflow: 'linebreak',
      lineColor: [215, 218, 224] as [number, number, number],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: rightTableWidth * 0.63 },
      1: { cellWidth: rightTableWidth * 0.37, halign: 'right' },
    },
  });
  const rightFinalY = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? tableStartY;

  cursorY = Math.max(leftFinalY, rightFinalY) + 9;

  const summaryHeight = 30;
  if (cursorY + summaryHeight > contentBottom) {
    doc.addPage();
    cursorY = 16;
  }

  const baseEarned = data.record.baseSalary || 0;
  const additionsTotal = additions.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  const deductionsTotal = deductions.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  const netPay = getNetPay(data.record, additionsTotal, deductionsTotal);
  const paidAmount = getPaidAmount(data.record, data.payments);
  const remainingAmount = Math.max(netPay - paidAmount, 0);
  const summaryY = cursorY;
  const summaryH = 34;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.45);
  doc.roundedRect(marginX, summaryY, pageWidth - 2 * marginX, summaryH, 2, 2, 'FD');

  doc.setFillColor(r, g, b);
  doc.roundedRect(marginX, summaryY, pageWidth - 2 * marginX, 8.5, 2, 2, 'F');
  doc.rect(marginX, summaryY + 6.5, pageWidth - 2 * marginX, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('NET PAY SUMMARY', marginX + 4, summaryY + 5.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text(
    `Attendance Mode: ${getAttendanceModeLabel(data.record)} | Credited Days: ${data.record.presentDays}/${data.record.totalDays}`,
    marginX + 4,
    summaryY + 13,
  );
  doc.text(`Base Earned: ${currencyFmt.full(baseEarned)}`, marginX + 4, summaryY + 18.5);
  doc.text(`+ Additions: ${currencyFmt.full(additionsTotal)}`, marginX + 4, summaryY + 24);
  doc.text(`- Deductions: ${currencyFmt.full(deductionsTotal)}`, marginX + 4, summaryY + 29.5);

  doc.setDrawColor(220, 223, 228);
  doc.setLineWidth(0.25);
  doc.line(pageWidth / 2, summaryY + 11, pageWidth / 2, summaryY + summaryH - 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(r, g, b);
  doc.text('NET PAY', pageWidth / 2 + 6, summaryY + 16);

  doc.setFontSize(18);
  doc.text(currencyFmt.full(netPay), pageWidth / 2 + 6, summaryY + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text(
    `Paid: ${currencyFmt.full(paidAmount)} | Remaining: ${currencyFmt.full(remainingAmount)}`,
    pageWidth / 2 + 6,
    summaryY + 30,
  );

  cursorY = summaryY + summaryH + 10;

  if (activePayments.length > 0) {
    if (cursorY + 18 > contentBottom) {
      doc.addPage();
      cursorY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(60, 60, 60);
    doc.text('PAYMENT HISTORY', marginX, cursorY);
    cursorY += 4.5;

    autoTable(doc, {
      startY: cursorY,
      head: [['Date', 'Method', 'Amount', 'Reference', 'Status']],
      body: activePayments.map((payment) => [
        dayjs(payment.paymentDate).format('DD MMM YYYY'),
        formatPaymentMode(payment.paymentMode),
        currencyFmt.full(payment.amount + (payment.commission || 0)),
        payment.referenceNo || '-',
        getPaymentStatus(payment),
      ]),
      tableWidth: pageWidth - 2 * marginX,
      margin: { left: marginX, right: marginX, bottom: footerReserved + 2 },
      headStyles: sectionHeadStyles,
      bodyStyles: commonBodyStyles,
      alternateRowStyles: { fillColor: [246, 248, 251] as [number, number, number] },
      styles: {
        overflow: 'linebreak',
        lineColor: [215, 218, 224] as [number, number, number],
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 32 },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 50 },
        4: { cellWidth: 24, halign: 'center' },
      },
    });
    cursorY = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? cursorY;
  }

  // ── Advance Outstanding Note (informational only) ─────────────────────────
  // Rendered after all tables. Does NOT affect net salary.
  if (data.advanceOutstanding && data.advanceOutstanding > 0) {
    cursorY += 6;
    if (cursorY + 8 > contentBottom) {
      doc.addPage();
      cursorY = 16;
    }
    const noteH = 7;
    // blue-50 background, blue-300 border, blue-700 text
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(147, 197, 253);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, cursorY, pageWidth - 2 * marginX, noteH, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(29, 78, 216);
    doc.text(
      `Advance outstanding (as of this payslip): ${currencyFmt.full(data.advanceOutstanding)}`,
      marginX + 3,
      cursorY + 4.8,
    );
    cursorY += noteH;
  }

  // ── Loan Outstanding Note (informational only) ────────────────────────────
  // Rendered after all tables. Does NOT affect net salary.
  if (data.loanOutstanding && data.loanOutstanding > 0) {
    cursorY += 3;
    if (cursorY + 8 > contentBottom) {
      doc.addPage();
      cursorY = 16;
    }
    const loanNoteH = 7;
    // green-50 background, green-300 border, green-700 text
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(134, 239, 172);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, cursorY, pageWidth - 2 * marginX, loanNoteH, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(21, 128, 61);
    doc.text(
      `Loan outstanding (as of this payslip): ${currencyFmt.full(data.loanOutstanding)}`,
      marginX + 3,
      cursorY + 4.8,
    );
  }
}

export async function generatePayslipPdf(options: PayslipOptions): Promise<PayslipResult[]> {
  if (options.payslips.length === 0) {
    return [];
  }

  const { jsPDF } = await import('jspdf');
  autoTableRenderer = (await import('jspdf-autotable')).default;

  if (options.mode === 'combined') {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pageDecorations: PageDecorationInfo[] = [];

    for (const [index, payslip] of options.payslips.entries()) {
      const assets = await prepareAssets(payslip.branding);

      if (index > 0) {
        doc.addPage();
      }

      doc.setPage(doc.getNumberOfPages());
      const startPage = doc.getNumberOfPages();

      await renderPayslip(
        doc,
        payslip,
        index,
        assets.brandColor,
        assets.headerLogoBase64,
        assets.watermarkBase64,
      );

      pageDecorations.push({
        startPage,
        endPage: doc.getNumberOfPages(),
        brandColor: assets.brandColor,
        watermarkBase64: assets.watermarkBase64,
        branding: payslip.branding,
      });
    }

    applyPageDecorations(doc, pageDecorations);

    const filename =
      options.payslips.length === 1
        ? getPayslipFilename(options.payslips[0])
        : `Payslips_${getExportFilePeriod(options.payslips[0].record)}.pdf`;

    doc.save(filename);
    return [];
  }

  const results: PayslipResult[] = [];

  for (const [index, payslip] of options.payslips.entries()) {
    const assets = await prepareAssets(payslip.branding);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    await renderPayslip(
      doc,
      payslip,
      index,
      assets.brandColor,
      assets.headerLogoBase64,
      assets.watermarkBase64,
    );

    applyPageDecorations(doc, [
      {
        startPage: 1,
        endPage: doc.getNumberOfPages(),
        brandColor: assets.brandColor,
        watermarkBase64: assets.watermarkBase64,
        branding: payslip.branding,
      },
    ]);

    results.push({
      blob: doc.output('blob'),
      filename: getPayslipFilename(payslip),
    });
  }

  return results;
}

function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }

  return btoa(binary);
}

export async function generatePayslipBase64(data: PayslipData): Promise<string> {
  const [result] = await generatePayslipPdf({
    payslips: [data],
    mode: 'individual',
  });

  if (!result) {
    throw new Error('Payslip PDF could not be generated.');
  }

  const arrayBuffer = await result.blob.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}

export async function downloadSinglePayslip(data: PayslipData): Promise<void> {
  await generatePayslipPdf({
    payslips: [data],
    mode: 'combined',
  });
}
