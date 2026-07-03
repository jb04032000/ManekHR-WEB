'use client';

// Owner-facing queue of employee-originated 0% loan requests (Task 5).
// What it does: lists every PENDING self-service loan request (member name/code,
// requested amount, desired months, purpose, submitted date) with two actions:
//   APPROVE -> opens a terms drawer (tenor/principal editable, interest fixed at
//     'zero', start month/year pickers) -> approveLoanRequest materializes the real
//     interest-free EmployerLoan and refreshes the queue + parent loans list.
//   REJECT  -> small modal capturing a required reason -> rejectLoanRequest.
// Mounted above the loans table on the owner Employer-Loan console; gated there on
// <Can salary edit all> + the loanManagement feature.
// Links: salary.api.ts getPendingLoanRequests / approveLoanRequest / rejectLoanRequest,
//   loan-request.controller.ts (BE), LoansPage (mount point), CreateLoanDrawer (term
//   field patterns this drawer mirrors).
// Watch: amounts flow as paise to/from the API; display is in rupees (/ 100). A
//   concurrent owner action returns 409 LOAN_REQUEST_NOT_PENDING -> friendly message
//   + auto-refresh so the stale row drops out.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  App,
  Button,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
} from 'antd';
import { CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { DsDrawer } from '@/components/ui';
// Branded horizontal scrollbar for the requests table on mobile (native bar
// hidden via `.salary-table-wrap` in globals.css). Same as the payroll tables.
import { TableCustomScrollbar } from '@/components/ui/TableCustomScrollbar';
import {
  getPendingLoanRequests,
  approveLoanRequest,
  rejectLoanRequest,
} from '@/lib/api/modules/salary.api';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import type { ApproveLoanRequestPayload, PendingLoanRequest } from '@/types';

interface LoanRequestsQueueProps {
  workspaceId: string;
  /** Called after a successful approve so the parent can refresh the loans list. */
  onLoanCreated?: () => void;
}

interface ApproveFormValues {
  principalRupees: number | null;
  tenorMonths: number | null;
  startMonth: number | null;
  startYear: number | null;
}

interface RejectFormValues {
  reason: string;
}

/** Read the backend error code from an axios error envelope ({ error: { code } } or { code }). */
function readErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const nested = obj.error;
      if (nested && typeof nested === 'object') {
        const code = (nested as Record<string, unknown>).code;
        if (typeof code === 'string') return code;
      }
      if (typeof obj.code === 'string') return obj.code;
    }
  }
  return undefined;
}

export function LoanRequestsQueue({ workspaceId, onLoanCreated }: LoanRequestsQueueProps) {
  const t = useTranslations('salary.loanRequestsQueue');
  const { message } = App.useApp();
  const [approveForm] = Form.useForm<ApproveFormValues>();
  const [rejectForm] = Form.useForm<RejectFormValues>();
  // Wrapper for the requests table so <TableCustomScrollbar> can drive a branded
  // horizontal bar; the columns overflow a phone width.
  const tableWrapRef = useRef<HTMLDivElement>(null);

  const [requests, setRequests] = useState<PendingLoanRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Approve drawer state.
  const [approveTarget, setApproveTarget] = useState<PendingLoanRequest | null>(null);
  const [approveSaving, setApproveSaving] = useState(false);

  // Reject modal state.
  const [rejectTarget, setRejectTarget] = useState<PendingLoanRequest | null>(null);
  const [rejectSaving, setRejectSaving] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await getPendingLoanRequests(workspaceId);
      setRequests(data);
    } catch (err) {
      message.error(parseApiError(err) || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, message, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Approve ────────────────────────────────────────
  const openApprove = (record: PendingLoanRequest) => {
    setApproveTarget(record);
    // Default start month/year to NEXT month (recovery begins next cycle), prefill
    // tenor from the requested timeline and principal from the requested amount.
    const next = dayjs().add(1, 'month');
    approveForm.setFieldsValue({
      principalRupees: record.requestedAmount / 100,
      tenorMonths: record.desiredTenorMonths,
      startMonth: next.month() + 1,
      startYear: next.year(),
    });
  };

  const closeApprove = () => {
    setApproveTarget(null);
    approveForm.resetFields();
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    let values: ApproveFormValues;
    try {
      values = await approveForm.validateFields();
    } catch {
      return;
    }
    if (!values.principalRupees || !values.tenorMonths || !values.startMonth || !values.startYear) {
      return;
    }
    setApproveSaving(true);
    try {
      const payload: ApproveLoanRequestPayload = {
        tenorMonths: values.tenorMonths,
        startMonth: values.startMonth,
        startYear: values.startYear,
        // The self-service loan product is always interest-free.
        interestType: 'zero',
        // Paise on the wire; the owner may approve a different principal.
        principalAmount: Math.round(values.principalRupees * 100),
      };
      await approveLoanRequest(workspaceId, approveTarget._id, payload);
      message.success(t('approveSuccess'));
      closeApprove();
      await load();
      onLoanCreated?.();
    } catch (err) {
      if (readErrorCode(err) === 'LOAN_REQUEST_NOT_PENDING') {
        message.warning(t('alreadyActioned'));
        closeApprove();
        await load();
      } else {
        message.error(parseApiError(err) || t('approveError'));
      }
    } finally {
      setApproveSaving(false);
    }
  };

  // ── Reject ─────────────────────────────────────────
  const openReject = (record: PendingLoanRequest) => {
    setRejectTarget(record);
    rejectForm.resetFields();
  };

  const closeReject = () => {
    setRejectTarget(null);
    rejectForm.resetFields();
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    let values: RejectFormValues;
    try {
      values = await rejectForm.validateFields();
    } catch {
      return;
    }
    setRejectSaving(true);
    try {
      await rejectLoanRequest(workspaceId, rejectTarget._id, { reason: values.reason.trim() });
      message.success(t('rejectSuccess'));
      closeReject();
      await load();
    } catch (err) {
      if (readErrorCode(err) === 'LOAN_REQUEST_NOT_PENDING') {
        message.warning(t('alreadyActioned'));
        closeReject();
        await load();
      } else {
        message.error(parseApiError(err) || t('rejectError'));
      }
    } finally {
      setRejectSaving(false);
    }
  };

  const columns: ColumnsType<PendingLoanRequest> = [
    {
      title: t('colEmployee'),
      key: 'employee',
      render: (_: unknown, row: PendingLoanRequest) => (
        <div>
          <p className="m-0 text-[14px] font-medium text-heading">
            {row.member?.name ?? row.teamMemberId}
          </p>
          {row.member?.employeeCode && (
            <p className="m-0 text-[12px] text-subtle">{row.member.employeeCode}</p>
          )}
        </div>
      ),
    },
    {
      title: t('colRequested'),
      dataIndex: 'requestedAmount',
      key: 'requestedAmount',
      align: 'right',
      render: (paise: number) => (
        <span className="font-medium tabular-nums">{formatCurrencyFull(paise / 100)}</span>
      ),
    },
    {
      title: t('colMonths'),
      dataIndex: 'desiredTenorMonths',
      key: 'desiredTenorMonths',
      align: 'right',
      render: (months: number) => <span className="tabular-nums">{months}</span>,
    },
    {
      title: t('colPurpose'),
      dataIndex: 'purpose',
      key: 'purpose',
      render: (purpose?: string) =>
        purpose ? (
          <span className="text-[13px]">{purpose}</span>
        ) : (
          <span className="text-faint">-</span>
        ),
    },
    {
      title: t('colSubmittedOn'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d?: string) =>
        d ? dayjs(d).format('DD MMM YYYY') : <span className="text-faint">-</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 160,
      render: (_: unknown, row: PendingLoanRequest) => (
        <Space size="small" wrap>
          <Button type="primary" size="small" onClick={() => openApprove(row)}>
            {t('approve')}
          </Button>
          <Button danger size="small" onClick={() => openReject(row)}>
            {t('reject')}
          </Button>
        </Space>
      ),
    },
  ];

  // Hide the whole section while loading the first time AND empty, to avoid a flash
  // of an empty card; once loaded, show the empty state inside the table.
  if (loading && requests.length === 0) {
    return (
      <div
        className="mb-5 overflow-hidden rounded-xl p-4"
        style={{ border: '1px solid var(--cr-border)' }}
      >
        <Skeleton active paragraph={{ rows: 3 }} />
      </div>
    );
  }

  return (
    <div
      className="mb-5 overflow-hidden rounded-xl"
      style={{ border: '1px solid var(--cr-border)' }}
    >
      {/* Section header with a live pending count badge (mirrors the console KPI style). */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--cr-border)', background: 'var(--cr-bg)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-heading">{t('sectionTitle')}</span>
          {requests.length > 0 && (
            <Tag color="warning" className="m-0">
              {requests.length}
            </Tag>
          )}
        </div>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => void load()}
          loading={loading}
          aria-label={t('refresh')}
        />
      </div>

      {/* salary-table-wrap + TableCustomScrollbar: branded horizontal bar so the
          overflowing columns scroll cleanly on mobile (native bar hidden). No
          desktop change - the table already fits there. */}
      <div ref={tableWrapRef} className="salary-table-wrap">
        <Table<PendingLoanRequest>
          rowKey="_id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={requests}
          pagination={false}
          locale={{ emptyText: <Empty description={t('empty')} /> }}
          scroll={{ x: 'max-content' }}
        />
        <TableCustomScrollbar containerRef={tableWrapRef} />
      </div>

      {/* Approve drawer: prefilled with the requested terms; interest fixed at 0%. */}
      <DsDrawer
        open={approveTarget !== null}
        onClose={closeApprove}
        title={t('approveTitle')}
        subtitle={approveTarget?.member?.name ?? undefined}
        footer={
          <Button
            type="primary"
            icon={<CheckOutlined />}
            loading={approveSaving}
            onClick={() => void handleApprove()}
          >
            {t('approveSubmit')}
          </Button>
        }
      >
        <div className="px-5 py-4">
          {approveTarget && (
            <p className="m-0 mb-4 text-[13px] text-subtle">
              {t('approveDescription', {
                amount: formatCurrencyFull(approveTarget.requestedAmount / 100),
                months: approveTarget.desiredTenorMonths,
              })}
            </p>
          )}
          <Form<ApproveFormValues> form={approveForm} layout="vertical">
            <Row gutter={16}>
              {/* Principal (editable; defaults to the requested amount) */}
              <Col span={12}>
                <Form.Item
                  name="principalRupees"
                  label={t('fieldPrincipal')}
                  rules={[
                    { required: true, message: t('fieldPrincipalRequired') },
                    { type: 'number', min: 1, message: t('fieldPrincipalMin') },
                  ]}
                >
                  <InputNumber min={1} precision={0} prefix="₹" style={{ width: '100%' }} />
                </Form.Item>
              </Col>

              {/* Tenor (editable; defaults to the desired timeline) */}
              <Col span={12}>
                <Form.Item
                  name="tenorMonths"
                  label={t('fieldTenor')}
                  rules={[
                    { required: true, message: t('fieldTenorRequired') },
                    { type: 'number', min: 1, max: 120, message: t('fieldTenorRange') },
                  ]}
                >
                  <InputNumber
                    min={1}
                    max={120}
                    precision={0}
                    suffix={t('monthsSuffix')}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              {/* Recovery start month */}
              <Col span={12}>
                <Form.Item
                  name="startMonth"
                  label={t('fieldStartMonth')}
                  rules={[{ required: true, message: t('fieldStartMonthRequired') }]}
                >
                  <Select
                    options={Array.from({ length: 12 }, (_, i) => ({
                      value: i + 1,
                      label: dayjs().month(i).format('MMMM'),
                    }))}
                    placeholder={t('fieldStartMonthPlaceholder')}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>

              {/* Recovery start year */}
              <Col span={12}>
                <Form.Item
                  name="startYear"
                  label={t('fieldStartYear')}
                  rules={[{ required: true, message: t('fieldStartYearRequired') }]}
                >
                  <Select
                    options={Array.from({ length: 5 }, (_, i) => {
                      const yr = dayjs().year() + i - 1;
                      return { value: yr, label: String(yr) };
                    })}
                    placeholder={t('fieldStartYearPlaceholder')}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '4px 0 12px' }} />
            {/* Interest is fixed at 0% for the self-service loan product (read-only line). */}
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-subtle">{t('interestLabel')}</span>
              <Tag color="green" className="m-0">
                {t('interestZero')}
              </Tag>
            </div>
            <p className="m-0 mt-3 text-[12px] text-subtle">{t('approveHint')}</p>
          </Form>
        </div>
      </DsDrawer>

      {/* Reject modal: required reason shown to the employee. */}
      <Modal
        open={rejectTarget !== null}
        title={t('rejectTitle')}
        centered
        destroyOnHidden
        styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
        onCancel={closeReject}
        onOk={() => void handleReject()}
        confirmLoading={rejectSaving}
        okText={t('rejectSubmit')}
        okButtonProps={{ danger: true }}
        cancelText={t('cancel')}
      >
        {rejectTarget && (
          <p className="mb-3 text-[13px] text-subtle">
            {t('rejectDescription', {
              name: rejectTarget.member?.name ?? rejectTarget.teamMemberId,
            })}
          </p>
        )}
        <Form<RejectFormValues> form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label={t('reasonLabel')}
            rules={[
              { required: true, message: t('reasonRequired') },
              { whitespace: true, message: t('reasonRequired') },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} placeholder={t('reasonPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
