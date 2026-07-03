'use client';

import { useState, useCallback } from 'react';
import { useWorkspaceStore } from '@/lib/store';
import { salaryApi } from '@/lib/api';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import type { SalaryRecord } from '../types/salary-page.types';
import type { MessageInstance } from 'antd/es/message/interface';

interface UsePayslipActionsDeps {
  msgApi: MessageInstance;
}

export function usePayslipActions(deps: UsePayslipActionsDeps) {
  const { msgApi } = deps;
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const [generating, setGenerating] = useState(false);

  const generatePayslip = useCallback(
    async (records: SalaryRecord[], mode: 'individual' | 'combined' | 'zip' = 'combined') => {
      if (!currentWorkspaceId) {
        msgApi.error('No workspace selected');
        return;
      }

      const validRecords = records.filter((record) => record._id && !record.isPreview);
      if (validRecords.length === 0) {
        msgApi.error('No salary records to generate payslips for. Generate payroll first.');
        return;
      }

      setGenerating(true);
      try {
        const salaryIds = validRecords
          .map((record) => record._id)
          .filter((salaryId): salaryId is string => Boolean(salaryId));

        const payslipDataArray = await salaryApi.getPayslipData(currentWorkspaceId, salaryIds);

        if (payslipDataArray.length === 0) {
          msgApi.error('No payslip data found for the selected records.');
          return;
        }

        const currencyConfig = usePayrollConfigStore.getState().getCurrencyConfig();
        const { generatePayslipPdf } = await import('@/lib/export/generatePayslipPdf');

        const payslips = payslipDataArray.map((data) => ({
          record: data.record,
          adjustments: data.adjustments,
          payments: data.payments,
          componentTemplate: data.componentTemplate,
          workspaceName: data.workspaceName,
          branding: data.branding,
          currencyConfig,
          advanceOutstanding: data.advanceOutstanding,
        }));

        if (mode === 'zip') {
          const { downloadAsZip } = await import('@/lib/export/zipDownload');
          const results = await generatePayslipPdf({
            payslips,
            mode: 'individual',
          });
          await downloadAsZip(
            results,
            `Payslips_${validRecords[0].year}_${String(validRecords[0].month).padStart(2, '0')}.zip`,
          );
        } else {
          await generatePayslipPdf({ payslips, mode });
        }

        msgApi.success(
          validRecords.length === 1
            ? 'Payslip downloaded'
            : `${validRecords.length} payslips generated`,
        );
      } catch (e) {
        const { parseApiError } = await import('@/lib/utils');
        msgApi.error(parseApiError(e));
      } finally {
        setGenerating(false);
      }
    },
    [currentWorkspaceId, msgApi],
  );

  return {
    generatePayslip,
    generating,
  };
}
