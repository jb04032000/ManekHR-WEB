import dayjs from 'dayjs';
import type { Form16Data } from '@/types';

type JsPdfInstance = InstanceType<typeof import('jspdf').jsPDF>;
type AutoTableFn = typeof import('jspdf-autotable').default;
type JsPdfWithAutoTable = JsPdfInstance & { lastAutoTable?: { finalY?: number } };

let autoTableRenderer: AutoTableFn | null = null;

type TaxBreakdown = {
  grossIncome: number;
  previousEmployerGross: number;
  standardDeduction: number;
  hraExemption: number;
  totalExemptions: number;
  grossTaxableIncome: number;
  chapterViaTotal: number;
  netTaxableIncome: number;
  taxOnIncome: number;
  cess: number;
  rebate: number;
  finalTax: number;
  previousEmployerTds: number;
  totalTdsDeducted: number;
  balance: number;
  hasPan: boolean;
};

function getAutoTable(): AutoTableFn {
  if (!autoTableRenderer) {
    throw new Error('Form 16 PDF renderer is not initialized.');
  }

  return autoTableRenderer;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

function createCurrencyFormatter(locale?: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale || 'en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
  } catch {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
  }
}

function formatCurrency(
  formatter: Intl.NumberFormat,
  amount: number | undefined | null,
): string {
  return formatter.format(Number(amount || 0));
}

function formatBalance(
  formatter: Intl.NumberFormat,
  amount: number,
): string {
  if (amount < 0) {
    return `(${formatCurrency(formatter, Math.abs(amount))})`;
  }

  return formatCurrency(formatter, amount);
}

function getMonthLabel(month: number, year: number): string {
  return dayjs()
    .year(year)
    .month(month - 1)
    .date(1)
    .format('MMM YYYY');
}

function getRegimeLabel(regime: 'old' | 'new'): string {
  return regime === 'old' ? 'Old Regime' : 'New Regime';
}

function computeOldRegimeBaseTax(taxableIncome: number): number {
  if (taxableIncome <= 250000) return 0;
  if (taxableIncome <= 500000) return (taxableIncome - 250000) * 0.05;
  if (taxableIncome <= 1000000) {
    return 12500 + (taxableIncome - 500000) * 0.2;
  }

  return 112500 + (taxableIncome - 1000000) * 0.3;
}

function computeNewRegimeBaseTax(taxableIncome: number): number {
  if (taxableIncome <= 300000) return 0;
  if (taxableIncome <= 700000) return (taxableIncome - 300000) * 0.05;
  if (taxableIncome <= 1000000) {
    return 20000 + (taxableIncome - 700000) * 0.1;
  }
  if (taxableIncome <= 1200000) {
    return 50000 + (taxableIncome - 1000000) * 0.15;
  }
  if (taxableIncome <= 1500000) {
    return 80000 + (taxableIncome - 1200000) * 0.2;
  }

  return 140000 + (taxableIncome - 1500000) * 0.3;
}

function applySurcharge(baseTax: number, taxableIncome: number): number {
  if (taxableIncome > 10000000) {
    return baseTax * 1.15;
  }

  if (taxableIncome > 5000000) {
    return baseTax * 1.1;
  }

  return baseTax;
}

function computeTaxBreakdown(data: Form16Data): TaxBreakdown {
  const declaration = data.declaration;
  const regime = data.taxRegime;
  const previousEmployerGross = Number(
    declaration?.previousEmployerGross || 0,
  );
  const previousEmployerTds = Number(declaration?.previousEmployerTds || 0);
  const standardDeduction =
    declaration?.standardDeduction || (regime === 'new' ? 75000 : 50000);
  const hraExemption =
    regime === 'old' ? Number(declaration?.hraExemption || 0) : 0;
  const grossIncome = Number(data.totalGrossSalary || 0) + previousEmployerGross;
  const totalExemptions = standardDeduction + hraExemption;
  const grossTaxableIncome = Math.max(grossIncome - totalExemptions, 0);
  const chapterViaTotal =
    regime === 'old'
      ? Number(declaration?.deduction80C || 0) +
        Number(declaration?.deduction80D || 0) +
        Number(declaration?.deduction80CCD1B || 0) +
        Number(declaration?.deduction80G || 0) +
        Number(declaration?.deduction80TTA || 0) +
        Number(declaration?.otherDeductions || 0)
      : 0;
  const netTaxableIncome = Math.max(grossTaxableIncome - chapterViaTotal, 0);
  const hasPan = Boolean(data.employeePan?.trim());

  if (!hasPan) {
    const taxOnIncome = Math.round(netTaxableIncome * 0.2);
    const totalTdsDeducted =
      Number(data.totalTdsDeducted || 0) + previousEmployerTds;

    return {
      grossIncome,
      previousEmployerGross,
      standardDeduction,
      hraExemption,
      totalExemptions,
      grossTaxableIncome,
      chapterViaTotal,
      netTaxableIncome,
      taxOnIncome,
      cess: 0,
      rebate: 0,
      finalTax: taxOnIncome,
      previousEmployerTds,
      totalTdsDeducted,
      balance: taxOnIncome - totalTdsDeducted,
      hasPan,
    };
  }

  const baseTax =
    regime === 'new'
      ? computeNewRegimeBaseTax(netTaxableIncome)
      : computeOldRegimeBaseTax(netTaxableIncome);
  const taxOnIncome = Math.round(applySurcharge(baseTax, netTaxableIncome));
  const cess = Math.round(taxOnIncome * 0.04);
  const rebateEligible =
    (regime === 'new' && netTaxableIncome <= 700000) ||
    (regime === 'old' && netTaxableIncome <= 500000);
  const rebate = rebateEligible ? taxOnIncome + cess : 0;
  const finalTax = Math.max(taxOnIncome + cess - rebate, 0);
  const totalTdsDeducted =
    Number(data.totalTdsDeducted || 0) + previousEmployerTds;

  return {
    grossIncome,
    previousEmployerGross,
    standardDeduction,
    hraExemption,
    totalExemptions,
    grossTaxableIncome,
    chapterViaTotal,
    netTaxableIncome,
    taxOnIncome,
    cess,
    rebate,
    finalTax,
    previousEmployerTds,
    totalTdsDeducted,
    balance: finalTax - totalTdsDeducted,
    hasPan,
  };
}

function drawInfoBlock(
  doc: JsPdfWithAutoTable,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: Array<{ label: string; value: string }>,
): void {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, width, 36, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(title, x + 4, y + 7);

  doc.setFontSize(9);
  let rowY = y + 13;
  rows.forEach((row) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${row.label}:`, x + 4, rowY);
    doc.setFont('helvetica', 'normal');
    doc.text(row.value || '-', x + 36, rowY);
    rowY += 5.5;
  });
}

function applyFooter(
  doc: JsPdfWithAutoTable,
  employerName: string,
  generatedOn: string,
): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerText = `Generated by ${employerName || 'Employer'} | ${generatedOn} | For income tax filing purposes only`;

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(footerText, pageWidth / 2, pageHeight - 8, {
      align: 'center',
    });
  }
}

export async function generateForm16Pdf(data: Form16Data): Promise<void> {
  const { jsPDF } = await import('jspdf');
  autoTableRenderer = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as JsPdfWithAutoTable;
  const autoTable = getAutoTable();
  const pageWidth = doc.internal.pageSize.getWidth();
  const formatter = createCurrencyFormatter(data.currencyLocale);
  const generatedOn = dayjs().format('DD MMM YYYY');
  const taxBreakdown = computeTaxBreakdown(data);
  const monthlyRows = data.monthlyBreakdown
    .filter((row) =>
      [
        row.baseSalary,
        row.additions,
        row.deductions,
        row.netSalary,
        row.paidAmount,
        row.pf,
        row.esi,
        row.pt,
        row.tds,
      ].some((value) => Number(value || 0) !== 0),
    )
    .map((row) => {
      const grossSalary = Number(row.baseSalary || 0) + Number(row.additions || 0);

      return [
        getMonthLabel(row.month, row.year),
        formatCurrency(formatter, grossSalary),
        formatCurrency(formatter, row.pf),
        formatCurrency(formatter, row.esi),
        formatCurrency(formatter, row.pt),
        formatCurrency(formatter, row.tds),
        formatCurrency(formatter, row.netSalary),
        formatCurrency(formatter, row.paidAmount),
      ];
    });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('SALARY TDS CERTIFICATE', pageWidth / 2, 18, {
    align: 'center',
  });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Financial Year: ${data.fyLabel} (April ${data.financialYear} - March ${data.financialYear + 1})`,
    pageWidth / 2,
    25,
    { align: 'center' },
  );
  doc.text(
    'This certificate is issued by the employer for income tax filing purposes.',
    pageWidth / 2,
    31,
    { align: 'center' },
  );
  doc.text(
    'This is not an official Form 16 Part A from TRACES.',
    pageWidth / 2,
    36,
    { align: 'center' },
  );

  drawInfoBlock(doc, 14, 44, 88, 'Employer', [
    { label: 'Employer Name', value: data.employerName || '-' },
    { label: 'Certificate Generated', value: generatedOn },
  ]);
  drawInfoBlock(doc, 108, 44, 88, 'Employee', [
    { label: 'Employee Name', value: data.employeeName || '-' },
    { label: 'Designation', value: data.employeeDesignation || '-' },
    { label: 'PAN', value: data.employeePan?.trim() || 'Not Provided' },
    { label: 'Tax Regime', value: getRegimeLabel(data.taxRegime) },
  ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('SECTION A - Monthly Salary & Deduction Summary', 14, 88);

  autoTable(doc, {
    startY: 93,
    head: [[
      'Month',
      'Gross Salary',
      'PF',
      'ESI',
      'PT',
      'TDS',
      'Net Salary',
      'Paid',
    ]],
    body:
      monthlyRows.length > 0
        ? monthlyRows
        : [[
            'No salary records for this financial year',
            '-',
            '-',
            '-',
            '-',
            '-',
            '-',
            '-',
          ]],
    foot: [[
      'TOTAL',
      formatCurrency(formatter, data.totalGrossSalary),
      formatCurrency(formatter, data.totalPfDeducted),
      formatCurrency(formatter, data.totalEsiDeducted),
      formatCurrency(formatter, data.totalPtDeducted),
      formatCurrency(formatter, data.totalTdsDeducted),
      formatCurrency(formatter, data.totalNetSalary),
      formatCurrency(formatter, data.totalPaidAmount),
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { halign: 'right', cellWidth: 23 },
      2: { halign: 'right', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 18 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 22 },
    },
  });

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`INCOME TAX COMPUTATION - FY ${data.fyLabel}`, 14, 18);

  let sectionBY = 25;
  if (!data.declaration) {
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(14, sectionBY, 182, 11, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(146, 64, 14);
    doc.text(
      'No investment declarations recorded for this financial year. Tax computation below uses standard deduction only.',
      17,
      sectionBY + 7,
    );
    sectionBY += 16;
  }

  if (!taxBreakdown.hasPan) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(248, 113, 113);
    doc.roundedRect(14, sectionBY, 182, 11, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(153, 27, 27);
    doc.text(
      'PAN not provided. Tax is shown using a flat 20% rate per Section 206AA.',
      17,
      sectionBY + 7,
    );
    sectionBY += 16;
  }

  const taxTableRows: string[][] = [
    ['GROSS INCOME', ''],
    ['Gross Salary from this employer', formatCurrency(formatter, data.totalGrossSalary)],
    ['Previous Employer Gross (Form 12B)', formatCurrency(formatter, taxBreakdown.previousEmployerGross)],
    ['Total Gross Income', formatCurrency(formatter, taxBreakdown.grossIncome)],
    ['EXEMPTIONS & DEDUCTIONS', ''],
    ['Standard Deduction', formatCurrency(formatter, taxBreakdown.standardDeduction)],
  ];

  if (data.taxRegime === 'old') {
    taxTableRows.push([
      'HRA Exemption (Sec 10(13A))',
      formatCurrency(formatter, taxBreakdown.hraExemption),
    ]);
  }

  taxTableRows.push(
    ['Total Exemptions', formatCurrency(formatter, taxBreakdown.totalExemptions)],
    ['GROSS TAXABLE INCOME', formatCurrency(formatter, taxBreakdown.grossTaxableIncome)],
  );

  if (data.taxRegime === 'old') {
    taxTableRows.push(
      ['CHAPTER VI-A DEDUCTIONS', ''],
      ['80C - PF / ELSS / LIC', formatCurrency(formatter, data.declaration?.deduction80C || 0)],
      ['80D - Health Insurance', formatCurrency(formatter, data.declaration?.deduction80D || 0)],
      ['80CCD(1B) - NPS Additional', formatCurrency(formatter, data.declaration?.deduction80CCD1B || 0)],
      ['80G - Donations', formatCurrency(formatter, data.declaration?.deduction80G || 0)],
      ['80TTA - Savings Interest', formatCurrency(formatter, data.declaration?.deduction80TTA || 0)],
      ['Other Deductions', formatCurrency(formatter, data.declaration?.otherDeductions || 0)],
      ['Total Chapter VI-A', formatCurrency(formatter, taxBreakdown.chapterViaTotal)],
    );
  }

  taxTableRows.push(
    ['NET TAXABLE INCOME', formatCurrency(formatter, taxBreakdown.netTaxableIncome)],
    ['TAX LIABILITY', ''],
    ['Tax on above income', formatCurrency(formatter, taxBreakdown.taxOnIncome)],
    ['Add: Health & Education Cess (4%)', formatCurrency(formatter, taxBreakdown.cess)],
    ['Less: Rebate u/s 87A', formatCurrency(formatter, taxBreakdown.rebate)],
    ['Total Tax Liability', formatCurrency(formatter, taxBreakdown.finalTax)],
    ['TDS DEDUCTED', ''],
    ['TDS by this employer', formatCurrency(formatter, data.totalTdsDeducted)],
    ['TDS by previous employer (Form 12B)', formatCurrency(formatter, taxBreakdown.previousEmployerTds)],
    ['Total TDS Deducted', formatCurrency(formatter, taxBreakdown.totalTdsDeducted)],
    ['BALANCE TAX PAYABLE / (REFUNDABLE)', formatBalance(formatter, taxBreakdown.balance)],
  );

  autoTable(doc, {
    startY: sectionBY,
    head: [['Particulars', 'Amount']],
    body: taxTableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
    },
    styles: {
      cellPadding: 2.2,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 122 },
      1: { cellWidth: 56, halign: 'right' },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;

      const rawRow = hookData.row.raw;
      const label =
        Array.isArray(rawRow) && rawRow.length > 0
          ? String(rawRow[0] || '')
          : '';
      const emphasisRows = new Set([
        'GROSS INCOME',
        'EXEMPTIONS & DEDUCTIONS',
        'GROSS TAXABLE INCOME',
        'CHAPTER VI-A DEDUCTIONS',
        'NET TAXABLE INCOME',
        'TAX LIABILITY',
        'TDS DEDUCTED',
        'BALANCE TAX PAYABLE / (REFUNDABLE)',
        'Total Gross Income',
        'Total Exemptions',
        'Total Chapter VI-A',
        'Total Tax Liability',
        'Total TDS Deducted',
      ]);

      if (emphasisRows.has(label)) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [248, 250, 252];
      }
    },
  });

  const statutoryStartY = (doc.lastAutoTable?.finalY || sectionBY) + 10;
  if (statutoryStartY > 245) {
    doc.addPage();
  }

  const statutoryHeaderY = doc.lastAutoTable && statutoryStartY <= 245
    ? statutoryStartY
    : 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('SECTION C - Statutory Deductions Summary', 14, statutoryHeaderY);

  autoTable(doc, {
    startY: statutoryHeaderY + 5,
    head: [['Deduction', 'Annual Amount', 'Note']],
    body: [
      [
        'PF Employee Contribution',
        formatCurrency(formatter, data.totalPfDeducted),
        '12% of basic salary, capped at INR 15,000 wage ceiling per month',
      ],
      [
        'ESI Employee Contribution',
        formatCurrency(formatter, data.totalEsiDeducted),
        '0.75% of gross salary',
      ],
      [
        'Professional Tax',
        formatCurrency(formatter, data.totalPtDeducted),
        'As per applicable state slab',
      ],
      [
        'Income Tax (TDS)',
        formatCurrency(formatter, data.totalTdsDeducted),
        'Section 192 monthly deduction',
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
    },
    styles: {
      cellPadding: 2.2,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: 34, halign: 'right' },
      2: { cellWidth: 90 },
    },
  });

  const totalStatutoryDeductions =
    Number(data.totalPfDeducted || 0) +
    Number(data.totalEsiDeducted || 0) +
    Number(data.totalPtDeducted || 0) +
    Number(data.totalTdsDeducted || 0);
  const statutoryFooterY = (doc.lastAutoTable?.finalY || statutoryHeaderY + 10) + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Total Statutory Deductions: ${formatCurrency(formatter, totalStatutoryDeductions)}`,
    14,
    statutoryFooterY,
  );

  applyFooter(doc, data.employerName, generatedOn);

  const employeeName = sanitizeFilenamePart(data.employeeName || 'Employee');
  doc.save(`Form16_${employeeName}_FY${data.fyLabel}.pdf`);
}
