import type { Form24QData, TdsChallan } from '@/types';

function formatFinancialYear(financialYear: number) {
  return `${financialYear}-${String(financialYear + 1).slice(2)}`;
}

function formatDepositDate(value: string | Date) {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function normalizeChallanField(value: string | number | undefined | null) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

export function generateForm24QText(data: Form24QData): string {
  const lines: string[] = [];
  const fyFormatted = formatFinancialYear(data.financialYear);

  lines.push(
    [
      'BH',
      'Q',
      data.quarter.toString(),
      fyFormatted,
      data.deductor.tan,
      data.deductor.pan,
      data.deductor.name,
      data.deductor.branchDivision || '',
      data.deductor.address1,
      data.deductor.address2 || '',
      data.deductor.city,
      data.deductor.state,
      data.deductor.pincode,
      data.deductor.phone,
      data.deductor.email,
      data.deductor.responsiblePersonName,
      data.deductor.responsiblePersonPan,
      data.deductor.responsiblePersonDesignation,
      '24Q',
    ].join('|'),
  );

  data.challans.forEach((challan: TdsChallan, challanIndex) => {
    lines.push(
      [
        'CD',
        String(challanIndex + 1),
        challan.bsrCode,
        formatDepositDate(challan.depositDate),
        challan.challanSerialNo,
        normalizeChallanField(challan.tdsTotalDeposited),
        normalizeChallanField(challan.interestAmount),
        normalizeChallanField(challan.feeAmount),
        normalizeChallanField(challan.totalChallanAmount),
        challan.section,
        challan.minorHeadCode,
        String(data.employees.length),
      ].join('|'),
    );

    data.employees.forEach((employee, employeeIndex) => {
      const ddRecord = [
        'DD',
        String(challanIndex + 1),
        String(employeeIndex + 1),
        employee.pan || 'PANNOTAVBL',
        employee.name,
        normalizeChallanField(employee.grossSalary),
        '0',
        '0',
        normalizeChallanField(employee.tdsDeducted),
        '0',
        normalizeChallanField(employee.tdsDeducted),
        '0',
        '1',
        '192',
        employee.taxRegime === 'new' ? 'N' : 'O',
      ];

      if (data.isQ4 && employee.annexureII) {
        ddRecord.push(
          normalizeChallanField(employee.annexureII.grossSalary),
          normalizeChallanField(employee.annexureII.standardDeduction),
          normalizeChallanField(employee.annexureII.hraExemption),
          normalizeChallanField(employee.annexureII.deduction80C),
          normalizeChallanField(employee.annexureII.deduction80D),
          normalizeChallanField(employee.annexureII.deduction80G),
          normalizeChallanField(employee.annexureII.deduction80CCD1B),
          normalizeChallanField(employee.annexureII.deduction80TTA),
          normalizeChallanField(employee.annexureII.otherDeductions),
          normalizeChallanField(employee.annexureII.netTaxableIncome),
          normalizeChallanField(employee.annexureII.taxLiability),
          normalizeChallanField(employee.annexureII.totalTdsDeducted),
          normalizeChallanField(employee.annexureII.previousEmployerGross),
          normalizeChallanField(employee.annexureII.previousEmployerTds),
        );
      }

      lines.push(ddRecord.join('|'));
    });
  });

  lines.push(
    [
      'FT',
      String(data.challans.length),
      String(data.employees.length),
      normalizeChallanField(data.totalTdsDeducted),
    ].join('|'),
  );

  return lines.join('\n');
}

export async function downloadForm24Q(data: Form24QData): Promise<void> {
  const content = generateForm24QText(data);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `Form24Q_Q${data.quarter}_FY${data.fyLabel}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
