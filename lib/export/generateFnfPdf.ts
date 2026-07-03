import dayjs from 'dayjs';
import type { FnfSettlement } from '@/types';

type JsPdfInstance = InstanceType<typeof import('jspdf').jsPDF>;
type AutoTableFn = typeof import('jspdf-autotable').default;
type JsPdfWithAutoTable = JsPdfInstance & { lastAutoTable?: { finalY?: number } };

let autoTableRenderer: AutoTableFn | null = null;

function getAutoTable(): AutoTableFn {
  if (!autoTableRenderer) {
    throw new Error('FnF PDF renderer is not initialized.');
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

function createCurrencyFormatter(): Intl.NumberFormat {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}

function formatCurrency(
  formatter: Intl.NumberFormat,
  amount: number | undefined | null,
): string {
  return formatter.format(Number(amount || 0));
}

function addPageFooter(doc: JsPdfWithAutoTable, workspaceName: string): void {
  const pageCount = doc.getNumberOfPages();
  const footerDate = dayjs().format('DD MMM YYYY');

  for (let index = 1; index <= pageCount; index += 1) {
    doc.setPage(index);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(226, 232, 240);
    doc.line(40, pageHeight - 32, pageWidth - 40, pageHeight - 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${workspaceName} | Generated on ${footerDate}`,
      40,
      pageHeight - 18,
    );
    doc.text(`Page ${index} of ${pageCount}`, pageWidth - 40, pageHeight - 18, {
      align: 'right',
    });
  }
}

export async function generateFnfPdf(
  settlement: FnfSettlement,
  memberName: string,
  workspaceName: string,
  currencySymbol: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  autoTableRenderer = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  }) as JsPdfWithAutoTable;
  const autoTable = getAutoTable();
  const formatter = createCurrencyFormatter();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 40;
  const right = pageWidth - 40;
  const contentWidth = right - left;

  const earningsRows: Array<[string, string, string]> = [
    [
      'Last Month Salary',
      `Prorated to ${dayjs(settlement.lastWorkingDate).format('DD MMM YYYY')}`,
      formatCurrency(formatter, settlement.lastMonthNetSalary),
    ],
    settlement.gratuityEligible
      ? [
          'Gratuity',
          `(${currencySymbol}${new Intl.NumberFormat('en-IN').format(
            settlement.lastBasicSalary || 0,
          )} x 15 x ${settlement.completedYears} years) / 26`,
          formatCurrency(formatter, settlement.gratuityAmount),
        ]
      : ['Gratuity', 'Not eligible (less than 5 years)', formatCurrency(formatter, 0)],
    [
      'Leave Encashment',
      `${settlement.leaveBalanceDays || 0} days x (${currencySymbol}${new Intl.NumberFormat(
        'en-IN',
      ).format(settlement.lastBasicSalary || 0)} / 26)`,
      formatCurrency(formatter, settlement.leaveEncashmentAmount),
    ],
    ...settlement.otherAdditions.map((item) => [
      item.description || 'Other Earning',
      'Manual adjustment',
      formatCurrency(formatter, item.amount),
    ] as [string, string, string]),
    ['Total Earnings', '', formatCurrency(formatter, settlement.totalEarnings)],
  ];

  const deductionRows: Array<[string, string, string]> = [];
  if ((settlement.noticeShortfallDays || 0) > 0) {
    deductionRows.push([
      'Notice Period Recovery',
      `${settlement.noticeShortfallDays} days x (${currencySymbol}${new Intl.NumberFormat(
        'en-IN',
      ).format(settlement.lastBasicSalary || 0)} / 26)`,
      formatCurrency(formatter, settlement.noticeRecoveryAmount),
    ]);
  }
  if ((settlement.outstandingAdvanceAmount || 0) > 0) {
    deductionRows.push([
      'Outstanding Advance',
      'As per records',
      formatCurrency(formatter, settlement.outstandingAdvanceAmount),
    ]);
  }
  deductionRows.push(
    ...settlement.otherDeductions.map((item) => [
      item.description || 'Other Deduction',
      'Manual adjustment',
      formatCurrency(formatter, item.amount),
    ] as [string, string, string]),
  );
  deductionRows.push([
    'Total Deductions',
    '',
    formatCurrency(formatter, settlement.totalDeductions),
  ]);

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(left, 32, contentWidth, 86, 14, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('FULL & FINAL SETTLEMENT STATEMENT', pageWidth / 2, 65, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Prepared on ${dayjs().format('DD MMM YYYY')} for exit settlement review`,
    pageWidth / 2,
    87,
    { align: 'center' },
  );

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Employer', left, 150);
  doc.text('Employee', pageWidth / 2 + 10, 150);

  const employerRows = [
    ['Employer', workspaceName],
    ['Statement Status', settlement.status.toUpperCase()],
    ['Generated On', dayjs().format('DD/MM/YYYY')],
  ];
  const employeeRows = [
    ['Employee', memberName],
    ['Date of Joining', dayjs(settlement.dateOfJoining).format('DD/MM/YYYY')],
    ['Last Working Date', dayjs(settlement.lastWorkingDate).format('DD/MM/YYYY')],
    [
      'Service Duration',
      `${settlement.completedYears} years ${settlement.completedMonths} months`,
    ],
  ];

  let leftY = 168;
  employerRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${label}:`, left, leftY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value || '-'), left + 92, leftY);
    leftY += 18;
  });

  let rightY = 168;
  employeeRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${label}:`, pageWidth / 2 + 10, rightY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value || '-'), pageWidth / 2 + 114, rightY);
    rightY += 18;
  });

  let cursorY = Math.max(leftY, rightY) + 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Section A - Earnings', left, cursorY);

  autoTable(doc, {
    startY: cursorY + 10,
    margin: { left, right: left },
    head: [['Component', 'Calculation Basis', 'Amount']],
    body: earningsRows,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    didParseCell: (hookData) => {
      const isTotalRow = hookData.row.index === earningsRows.length - 1;
      if (isTotalRow) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [241, 245, 249];
      }
    },
  });

  cursorY = (doc.lastAutoTable?.finalY || cursorY) + 24;
  if (cursorY > pageHeight - 220) {
    doc.addPage();
    cursorY = 52;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Section B - Deductions', left, cursorY);

  autoTable(doc, {
    startY: cursorY + 10,
    margin: { left, right: left },
    head: [['Component', 'Calculation Basis', 'Amount']],
    body: deductionRows,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [127, 29, 29],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    didParseCell: (hookData) => {
      const isTotalRow = hookData.row.index === deductionRows.length - 1;
      if (isTotalRow) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [254, 242, 242];
      }
    },
  });

  cursorY = (doc.lastAutoTable?.finalY || cursorY) + 24;
  if (cursorY > pageHeight - 190) {
    doc.addPage();
    cursorY = 52;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Section C - Net Payable', left, cursorY);

  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(59, 130, 246);
  doc.roundedRect(left, cursorY + 14, contentWidth, 74, 12, 12, 'FD');
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('NET FnF AMOUNT PAYABLE', pageWidth / 2, cursorY + 42, {
    align: 'center',
  });
  doc.setFontSize(22);
  doc.text(
    formatCurrency(formatter, settlement.netFnfPayable),
    pageWidth / 2,
    cursorY + 72,
    { align: 'center' },
  );

  cursorY += 110;
  if (cursorY > pageHeight - 110) {
    doc.addPage();
    cursorY = 52;
  }

  const footerLines = [
    settlement.status === 'finalised' && settlement.finalisedAt
      ? `This settlement is FINALISED on ${dayjs(settlement.finalisedAt).format(
          'DD/MM/YYYY',
        )}`
      : 'This settlement is DRAFT - subject to revision.',
    ...(settlement.leaveBalanceManuallyEntered
      ? ['* Leave balance was manually entered by HR administrator.']
      : []),
  ];

  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(left, cursorY, contentWidth, 54 + footerLines.length * 14, 10, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Notes', left + 14, cursorY + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  footerLines.forEach((line, index) => {
    doc.text(line, left + 14, cursorY + 40 + index * 14);
  });

  addPageFooter(doc, workspaceName);

  const filename = `FnF_${sanitizeFilenamePart(memberName)}_${dayjs(
    settlement.lastWorkingDate,
  ).format('DD_MMM_YYYY')}.pdf`;
  doc.save(filename);
}
