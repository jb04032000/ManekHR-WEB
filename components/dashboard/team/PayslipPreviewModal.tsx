'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import { App, Modal, Skeleton, Tag, Button, Divider, Tooltip } from 'antd';
import { DownloadOutlined, MailOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { salaryApi } from '@/lib/api';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { formatCurrencyFull } from '@/lib/utils';
import { blobToBase64 } from '@/lib/utils/blobToBase64';
import type { PayslipDataResponse } from '@/types';

interface PayslipPreviewModalProps {
  open: boolean;
  salaryId: string | null;
  monthLabel: string;
  memberEmail?: string;
  onClose: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  paid: 'success',
  partial: 'warning',
  pending: 'error',
  advance: 'processing',
};

export function PayslipPreviewModal({
  open,
  salaryId,
  monthLabel,
  memberEmail,
  onClose,
}: PayslipPreviewModalProps) {
  const { message: msgApi } = App.useApp();
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const { payslipGeneration, payslipEmail } = useSalaryFeatures();

  const [data, setData] = useState<PayslipDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const currencySymbol = usePayrollConfigStore.getState().getCurrencyConfig().symbol;
  const fmt = (n: number) => formatCurrencyFull(n, currencySymbol, 'en-IN');

  // ── Fetch on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !salaryId || !currentWorkspaceId) return;
    startTransition(() => {
      setData(null);
      setLoading(true);
    });
    salaryApi
      .getPayslipData(currentWorkspaceId, [salaryId])
      .then((arr) => setData(arr[0] ?? null))
      .catch(() => msgApi.error('Failed to load payslip data'))
      .finally(() => setLoading(false));
  }, [open, salaryId, currentWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const currencyConfig = usePayrollConfigStore.getState().getCurrencyConfig();
      const { generatePayslipPdf } = await import('@/lib/export/generatePayslipPdf');
      await generatePayslipPdf({
        payslips: [
          {
            record: data.record,
            adjustments: data.adjustments,
            payments: data.payments,
            componentTemplate: data.componentTemplate,
            workspaceName: data.workspaceName,
            branding: data.branding,
            currencyConfig,
            advanceOutstanding: data.advanceOutstanding,
            loanOutstanding: data.loanOutstanding,
          },
        ],
        mode: 'individual',
      });
      msgApi.success('Payslip downloaded');
    } catch {
      msgApi.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  }, [data, msgApi]);

  // ── Email ─────────────────────────────────────────────────────────────────
  const handleEmail = useCallback(async () => {
    if (!salaryId || !currentWorkspaceId) return;
    setEmailing(true);
    try {
      await salaryApi.sendPayslipEmail(currentWorkspaceId, { salaryId });
      msgApi.success(`Payslip sent to ${memberEmail}`);
    } catch {
      msgApi.error('Failed to send payslip email');
    } finally {
      setEmailing(false);
    }
  }, [salaryId, currentWorkspaceId, memberEmail, msgApi]);

  const rec = data?.record;

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        title={`Payslip - ${monthLabel}`}
        width={640}
        footer={
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button
                icon={<DownloadOutlined />}
                loading={downloading}
                disabled={!data || !payslipGeneration.enabled}
                onClick={handleDownload}
              >
                Download PDF
              </Button>
              <Tooltip
                title={
                  !memberEmail
                    ? 'No email on file'
                    : !payslipEmail.enabled
                      ? 'Upgrade to send emails'
                      : undefined
                }
              >
                <Button
                  icon={<MailOutlined />}
                  loading={emailing}
                  disabled={!data || !memberEmail || !payslipEmail.enabled}
                  onClick={handleEmail}
                >
                  Send Email
                </Button>
              </Tooltip>
            </div>
            <Button onClick={onClose}>Close</Button>
          </div>
        }
      >
        {loading && <Skeleton active paragraph={{ rows: 10 }} />}

        {!loading && !data && (
          <div className="py-8 text-center text-faint">No payslip data found.</div>
        )}

        {!loading && rec && (
          <div className="space-y-4 text-sm">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold">{data?.workspaceName}</div>
                <div className="text-gray-700">Payslip for {monthLabel}</div>
              </div>
              <Tag color={STATUS_COLOR[rec.status] ?? 'default'} className="capitalize">
                {rec.status}
              </Tag>
            </div>

            <Divider className="my-2" />

            {/* Employee meta */}
            <div className="grid grid-cols-2 gap-y-1 text-gray-600">
              <div>
                <span className="font-medium text-gray-800">Employee: </span>
                {typeof rec.teamMemberId === 'object' ? rec.teamMemberId.name : '-'}
              </div>
              <div>
                <span className="font-medium text-gray-800">Designation: </span>
                {typeof rec.teamMemberId === 'object' ? (rec.teamMemberId.designation ?? '-') : '-'}
              </div>
              <div>
                <span className="font-medium text-gray-800">Pay Period: </span>
                {monthLabel}
              </div>
              <div>
                <span className="font-medium text-gray-800">Salary Mode: </span>
                {rec.salaryType === 'hourly' ? 'Hourly' : 'Monthly'}
              </div>
            </div>

            <Divider className="my-2" />

            {/* Salary breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-2 border-b pb-1 font-semibold text-gray-700">Earnings</div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-600">Base Salary</span>
                  <span>{fmt(rec.baseSalary)}</span>
                </div>
                {rec.additions > 0 && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-600">Additions</span>
                    <span className="text-green-700">+{fmt(rec.additions)}</span>
                  </div>
                )}
                <Divider className="my-1" />
                <div className="flex justify-between font-semibold">
                  <span>Gross</span>
                  <span>{fmt(rec.baseSalary + rec.additions)}</span>
                </div>
              </div>

              <div>
                <div className="mb-2 border-b pb-1 font-semibold text-gray-700">Deductions</div>
                {rec.deductions > 0 ? (
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-600">Deductions</span>
                    <span className="text-red-700">-{fmt(rec.deductions)}</span>
                  </div>
                ) : (
                  <div className="py-0.5 text-faint">None</div>
                )}
                <Divider className="my-1" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{fmt(rec.deductions)}</span>
                </div>
              </div>
            </div>

            {/* Net Pay */}
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div>
                <div className="text-xs tracking-wide text-gray-700 uppercase">Net Pay</div>
                <div className="text-xl font-bold text-gray-900">{fmt(rec.netSalary)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-700">Paid</div>
                <div className="font-semibold text-green-700">{fmt(rec.paidAmount ?? 0)}</div>
              </div>
            </div>

            {/* Advance outstanding - informational only, does not affect net salary */}
            {data?.advanceOutstanding != null && data.advanceOutstanding > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <span className="font-medium">Advance outstanding (as of this payslip):</span>
                <span>{fmt(data.advanceOutstanding)}</span>
              </div>
            )}

            {/* Loan outstanding - informational only, does not affect net salary */}
            {data?.loanOutstanding != null && data.loanOutstanding > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                <span className="font-medium">Loan outstanding (as of this payslip):</span>
                <span>{fmt(data.loanOutstanding)}</span>
              </div>
            )}

            {/* Payments */}
            {data!.payments.length > 0 && (
              <div>
                <div className="mb-2 border-b pb-1 font-semibold text-gray-700">Payments</div>
                {data!.payments.map((p) => (
                  <div
                    key={p._id}
                    className="flex items-center justify-between py-1 text-xs text-gray-600"
                  >
                    <span className="text-sm font-medium text-gray-800">{fmt(p.amount)}</span>
                    <span className="uppercase">{p.paymentMode}</span>
                    <span>
                      {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '-'}
                    </span>
                    {p.referenceNo && <span className="text-faint">REF: {p.referenceNo}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Draft badge */}
            {!rec.isLocked && (
              <div className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                Draft - payroll not yet finalized
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
