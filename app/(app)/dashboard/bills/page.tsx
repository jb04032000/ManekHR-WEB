'use client';
// Legacy AP/AR Bills surface. Finance/Bills hardening (2026-06-15):
//  - Pillar 4: migrated from useEffect+useState manual reload to React Query
//    (stable ['bills', wsId, tab] key + 30s staleTime); server-side `type`
//    filter (BE no longer ships the whole collection); narrow Zustand selector;
//    memoised columns; invalidate (not manual reload) after every mutation.
//  - Pillar 3: full i18n across 4 locales (was hardcoded English); error +
//    empty states; the invoice-upload field is disabled when the bill is paid
//    (BE BILL_PAID_NO_DOC_REPLACE — a settled invoice is statutory evidence).
// BE talks to: BillsController (finance.payable.* RBAC, soft-delete + audit).
import { useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Select,
  Space,
  message,
  Form,
  Input,
  InputNumber,
  Tabs,
  Row,
  Col,
  Popconfirm,
  Tooltip,
  DatePicker,
  Badge,
  Empty,
  Result,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { listBills, createBill, updateBill, deleteBill, recordBillPayment } from '@/lib/actions';
import type { Bill, CreateBillPayload, RecordBillPaymentPayload } from '@/types';
import { formatCurrencyFull, parseApiError, fmt } from '@/lib/utils';
import { DsTag, DsModal } from '@/components/ui';

const { Option } = Select;

export default function BillsPage() {
  const t = useTranslations('finance.bills');
  // Narrow selector — subscribe to currentWorkspaceId only (Pillar 4 AC-4.1),
  // not the whole store, so unrelated store changes don't re-render this page.
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'payable' | 'receivable'>('payable');
  const [modalOpen, setModalOpen] = useState(false);
  const [payModal, setPayModal] = useState<Bill | null>(null);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [saving, setSaving] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm();
  const [payForm] = Form.useForm();

  // React Query: server-side `type` filter (Pillar 4 AC-4.2/4.4) — only the
  // active tab's bills are fetched, BE excludes soft-deleted rows. Stable key
  // includes the tab so each tab caches independently.
  const {
    data: bills = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['bills', currentWorkspaceId, tab],
    queryFn: () => listBills(currentWorkspaceId as string, { type: tab }),
    enabled: !!currentWorkspaceId,
    staleTime: 30_000,
  });

  // Summary KPIs for the current tab only (the list is already type-scoped).
  const totalForTab = useMemo(
    () => bills.reduce((s, b) => s + (b.amount - b.amountPaid), 0),
    [bills],
  );
  const overdueCount = useMemo(() => bills.filter((b) => b.status === 'overdue').length, [bills]);
  const pendingCount = useMemo(() => bills.filter((b) => b.status === 'pending').length, [bills]);
  const unpaidCount = useMemo(() => bills.filter((b) => b.status !== 'paid').length, [bills]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['bills', currentWorkspaceId] });

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ type: tab });
    setModalOpen(true);
  };
  const openEdit = (b: Bill) => {
    setEditing(b);
    form.setFieldsValue({ ...b, dueDate: b.dueDate ? dayjs(b.dueDate) : undefined });
    setModalOpen(true);
  };

  const handleSave = async (vals: Record<string, unknown>) => {
    if (!currentWorkspaceId) return;
    setSaving(true);
    const dueDate = vals.dueDate;
    const payload = {
      ...vals,
      dueDate:
        typeof dueDate === 'object' && dueDate && 'format' in dueDate
          ? (dueDate as { format: (f: string) => string }).format('YYYY-MM-DD')
          : (dueDate as string),
    };
    try {
      if (editing) {
        await updateBill(currentWorkspaceId, editing._id, payload as CreateBillPayload);
        msgApi.success(t('updated'));
      } else {
        await createBill(currentWorkspaceId, payload as CreateBillPayload);
        msgApi.success(t('created'));
      }
      setModalOpen(false);
      invalidate();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentWorkspaceId) return;
    try {
      await deleteBill(currentWorkspaceId, id);
      msgApi.success(t('deleted'));
      invalidate();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handlePay = async (vals: Record<string, unknown>) => {
    if (!currentWorkspaceId || !payModal) return;
    setSaving(true);
    try {
      await recordBillPayment(currentWorkspaceId, payModal._id, {
        amount: vals.amount as number,
        paymentDate: new Date().toISOString(),
        paymentMode: (vals.paymentMode as RecordBillPaymentPayload['paymentMode']) ?? 'cash',
        note: vals.note as string,
      });
      msgApi.success(t('paymentRecorded'));
      setPayModal(null);
      invalidate();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  // Memoised columns so the Table isn't handed a fresh array every render.
  const columns: ColumnsType<Bill> = useMemo(
    () => [
      {
        title: t('party'),
        dataIndex: 'partyName',
        key: 'party',
        width: 180,
        render: (v) => <span className="text-[13px] font-semibold">{v}</span>,
      },
      {
        title: t('description'),
        dataIndex: 'description',
        key: 'desc',
        ellipsis: true,
        width: 200,
        render: (v) => <span className="text-[13px] text-muted">{v ?? '-'}</span>,
      },
      {
        title: t('amount'),
        dataIndex: 'amount',
        key: 'amount',
        width: 120,
        render: (v) => <span className="text-[14px] font-bold">{formatCurrencyFull(v)}</span>,
      },
      {
        title: t('paid'),
        dataIndex: 'amountPaid',
        key: 'paid',
        width: 110,
        render: (v) => <span className="font-semibold text-success">{formatCurrencyFull(v)}</span>,
      },
      {
        title: t('remaining'),
        key: 'remaining',
        width: 120,
        render: (_, b) => {
          const rem = b.amount - b.amountPaid;
          return (
            <span
              className="font-semibold"
              style={{ color: rem > 0 ? 'var(--cr-error)' : 'var(--cr-success)' }}
            >
              {formatCurrencyFull(rem)}
            </span>
          );
        },
      },
      {
        title: t('dueDate'),
        dataIndex: 'dueDate',
        key: 'due',
        width: 120,
        render: (v, b) => {
          const isOverdue = dayjs(v).isBefore(dayjs(), 'day') && b.status !== 'paid';
          return (
            <span
              className="text-xs"
              style={{
                color: isOverdue ? 'var(--cr-error)' : 'var(--cr-text-2)',
                fontWeight: isOverdue ? 600 : 400,
              }}
            >
              {fmt(v)}
            </span>
          );
        },
      },
      {
        title: t('status'),
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (_, b) => <DsTag status={b.status} label={b.status?.replace('_', ' ')} />,
      },
      {
        title: <span className="sr-only">{t('actions')}</span>,
        key: 'actions',
        fixed: 'right',
        width: 100,
        render: (_, b) => (
          <Space size={4}>
            {b.status !== 'paid' && (
              <Tooltip title={t('recordPayment')}>
                <Button
                  type="primary"
                  size="small"
                  icon={<RupeeOutlined />}
                  onClick={() => {
                    setPayModal(b);
                    payForm.resetFields();
                  }}
                >
                  {t('pay')}
                </Button>
              </Tooltip>
            )}
            <Tooltip title={t('edit')}>
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(b)} />
            </Tooltip>
            <Popconfirm
              title={t('deleteConfirm')}
              onConfirm={() => handleDelete(b._id)}
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  // Whether the bill being edited is paid — its invoice is statutory evidence,
  // so the invoice field is disabled (mirrors BE BILL_PAID_NO_DOC_REPLACE).
  const editingPaid = editing?.status === 'paid';

  return (
    <>
      {ctx}
      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={12} sm={6}>
          <div className="rounded-[14px] bg-gradient-to-br from-red-50 to-red-100 px-5 py-4">
            <p className="m-0 mb-1 text-[11px] font-bold text-error uppercase">
              {tab === 'payable' ? t('payable') : t('receivable')}
            </p>
            <p className="m-0 font-display text-[22px] font-extrabold text-error">
              {isLoading ? '-' : formatCurrencyFull(totalForTab)}
            </p>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="bg-error-light rounded-[14px] px-5 py-4">
            <p className="m-0 mb-1 text-[11px] font-bold text-error uppercase">
              {t('overdueBills')}
            </p>
            <p className="m-0 font-display text-[22px] font-extrabold text-error">
              {isLoading ? '-' : overdueCount}
            </p>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="bg-orange-light rounded-[14px] px-5 py-4">
            <p className="m-0 mb-1 text-[11px] font-bold text-orange uppercase">{t('pending')}</p>
            <p className="m-0 font-display text-[22px] font-extrabold text-orange">
              {isLoading ? '-' : pendingCount}
            </p>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="bg-surface-secondary rounded-[14px] px-5 py-4">
            <p className="m-0 mb-1 text-[11px] font-bold text-muted uppercase">{t('remaining')}</p>
            <p className="m-0 font-display text-[22px] font-extrabold">
              {isLoading ? '-' : unpaidCount}
            </p>
          </div>
        </Col>
      </Row>

      <Card
        title={<span className="font-display font-bold">{t('title')}</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            {t('addBill')}
          </Button>
        }
      >
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as 'payable' | 'receivable')}
          items={[
            {
              key: 'payable',
              label: (
                <span>
                  {t('payable')}{' '}
                  {tab === 'payable' && (
                    <Badge count={unpaidCount} color="var(--cr-error)" size="small" />
                  )}
                </span>
              ),
            },
            {
              key: 'receivable',
              label: (
                <span>
                  {t('receivable')}{' '}
                  {tab === 'receivable' && (
                    <Badge count={unpaidCount} color="var(--cr-success)" size="small" />
                  )}
                </span>
              ),
            },
          ]}
        />
        {isError ? (
          // Error state — never a silent empty list (Pillar 3 AC-3.2).
          <Result
            status="warning"
            title={t('loadError')}
            extra={
              <Button type="primary" onClick={() => refetch()}>
                {t('retry')}
              </Button>
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={bills}
            rowKey="_id"
            loading={isLoading}
            scroll={{ x: 900 }}
            size="middle"
            locale={{
              // Contextual empty state with an add CTA (Pillar 4 AC-4.5).
              emptyText: (
                <Empty description={t('empty')}>
                  <p className="mb-3 text-[13px] text-muted">{t('emptyHint')}</p>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                    {t('addBill')}
                  </Button>
                </Empty>
              ),
            }}
            pagination={{
              pageSize: 15,
              showTotal: (total) => t('count', { count: total }),
              showSizeChanger: false,
            }}
          />
        )}
      </Card>

      {/* Add/Edit Modal */}
      <DsModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        title={<span className="font-display">{editing ? t('editBill') : t('addBill')}</span>}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          requiredMark={false}
          className="mt-4"
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="type"
                label={t('type')}
                rules={[{ required: true }]}
                initialValue={tab}
              >
                <Select size="large">
                  <Option value="payable">{t('payable')}</Option>
                  <Option value="receivable">{t('receivable')}</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="amount" label={t('amount')} rules={[{ required: true }]}>
                <InputNumber className="w-full" min={1} prefix="₹" size="large" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="partyName" label={t('partyName')} rules={[{ required: true }]}>
                <Input placeholder={t('partyPlaceholder')} size="large" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label={t('description')}>
                <Input.TextArea rows={2} placeholder={t('descriptionPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dueDate" label={t('dueDate')} rules={[{ required: true }]}>
                <DatePicker className="w-full" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              {/* Invoice URL — disabled when the bill is paid (statutory evidence,
                  mirrors BE BILL_PAID_NO_DOC_REPLACE). Tooltip explains why. */}
              <Form.Item name="invoiceUrl" label={t('invoice')}>
                <Tooltip title={editingPaid ? t('invoicePaidLocked') : ''}>
                  <Input size="large" disabled={editingPaid} placeholder="https://…" />
                </Tooltip>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </DsModal>

      {/* Record Payment Modal */}
      <DsModal
        open={!!payModal}
        onCancel={() => setPayModal(null)}
        title={
          <span className="font-display">
            {t('recordPayment')} - {payModal?.partyName}
          </span>
        }
        onOk={() => payForm.submit()}
        confirmLoading={saving}
        okText={t('recordPayment')}
      >
        <div className="py-2">
          <div className="bg-surface-secondary mb-3 flex justify-between rounded-[10px] px-3.5 py-2.5">
            <span className="text-[13px] text-muted">{t('remaining')}</span>
            <span className="text-[15px] font-bold">
              {formatCurrencyFull((payModal?.amount ?? 0) - (payModal?.amountPaid ?? 0))}
            </span>
          </div>
          <Form form={payForm} layout="vertical" onFinish={handlePay} requiredMark={false}>
            <Form.Item name="amount" label={t('amount')} rules={[{ required: true }]}>
              <InputNumber className="w-full" min={1} prefix="₹" size="large" />
            </Form.Item>
            <Form.Item name="note" label={t('note')}>
              <Input placeholder={t('notePlaceholder')} />
            </Form.Item>
          </Form>
        </div>
      </DsModal>
    </>
  );
}
