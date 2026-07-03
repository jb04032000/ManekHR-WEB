'use client';
import React, { useState, useEffect, useMemo, startTransition } from 'react';
import {
  Form,
  InputNumber,
  Select,
  Input,
  Button,
  Space,
  Table,
  Tag,
  Popconfirm,
  App,
  Tooltip,
} from 'antd';
import {
  DeleteOutlined,
  LockOutlined,
  PlusOutlined,
  CloseOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { addSalaryIncrement, getSalaryIncrements, deleteSalaryIncrement } from '@/lib/actions';
import type { SalaryIncrement, TeamMember } from '@/types';
import { parseApiError } from '@/lib/utils';
import { DsTag, DsModal, SegmentedToggle } from '@/components/ui';

const { Option } = Select;

interface SalaryIncrementModalProps {
  open: boolean;
  onClose: () => void;
  member: TeamMember | null;
  currentSalary: number;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function SalaryIncrementModal({
  open,
  onClose,
  member,
  currentSalary,
}: SalaryIncrementModalProps) {
  const { message } = App.useApp();
  const { currentWorkspaceId, isHydrated } = useWorkspaceStore();
  const [increments, setIncrements] = useState<SalaryIncrement[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [incrementType, setIncrementType] = useState<'fixed_amount' | 'percentage'>('fixed_amount');
  const [incrementValue, setIncrementValue] = useState<number | null>(null);
  const [effectiveMonth, setEffectiveMonth] = useState(dayjs().month() + 2);
  const [effectiveYear, setEffectiveYear] = useState(dayjs().year());
  const [note, setNote] = useState('');

  const currentMonth = dayjs().month() + 1;
  const currentYear = dayjs().year();

  const effectiveFromNow =
    effectiveYear < currentYear ||
    (effectiveYear === currentYear && effectiveMonth <= currentMonth);

  const previewSalary = useMemo(() => {
    if (incrementValue === null || incrementValue <= 0) return null;
    const base = currentSalary || 0;
    if (incrementType === 'fixed_amount') {
      return base + incrementValue;
    } else {
      return Math.round(base * (1 + incrementValue / 100));
    }
  }, [incrementValue, incrementType, currentSalary]);

  const loadIncrements = async () => {
    if (!currentWorkspaceId || !member?.id || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
    });
    try {
      const data = await getSalaryIncrements(currentWorkspaceId, member.id);
      startTransition(() => {
        setIncrements(data || []);
      });
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && member) {
      loadIncrements();
      startTransition(() => {
        setShowAddForm(false);
        setIncrementType('fixed_amount');
        setIncrementValue(null);
        setEffectiveMonth(dayjs().month() + 2);
        setEffectiveYear(dayjs().year());
        setNote('');
      });
    }
  }, [open, member, currentWorkspaceId, isHydrated]);

  const handleAddIncrement = async () => {
    if (!currentWorkspaceId || !member?.id) return;
    if (!incrementValue || incrementValue <= 0) {
      message.error('Please enter a valid value');
      return;
    }
    setAdding(true);
    try {
      await addSalaryIncrement(currentWorkspaceId, {
        teamMemberId: member.id,
        effectiveMonth,
        effectiveYear,
        type: incrementType,
        value: incrementValue,
        note: note || undefined,
      });
      message.success('Salary revision recorded');
      setShowAddForm(false);
      setIncrementValue(null);
      setNote('');
      await loadIncrements();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentWorkspaceId) return;
    try {
      await deleteSalaryIncrement(currentWorkspaceId, id);
      message.success('Revision deleted');
      await loadIncrements();
    } catch (e) {
      message.error(parseApiError(e));
    }
  };

  const columns: ColumnsType<SalaryIncrement> = [
    {
      title: 'Effective From',
      key: 'effective',
      width: 120,
      render: (_, r) => (
        <span className="text-[13px]">
          {MONTHS[r.effectiveMonth - 1].slice(0, 3)} {r.effectiveYear}
        </span>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v) => (
        <Tag color={v === 'fixed_amount' ? 'blue' : 'purple'}>
          {v === 'fixed_amount' ? 'Fixed' : 'Percentage'}
        </Tag>
      ),
    },
    {
      title: 'Revision',
      key: 'value',
      width: 100,
      render: (_, r) => (
        <span className="text-[13px] font-semibold">
          {r.type === 'fixed_amount' ? `+₹${r.value.toLocaleString()}` : `+${r.value}%`}
        </span>
      ),
    },
    {
      title: 'Previous',
      dataIndex: 'previousSalary',
      key: 'previous',
      width: 110,
      render: (v) => <span className="text-[13px] text-muted">₹{(v || 0).toLocaleString()}</span>,
    },
    {
      title: 'Revised To',
      dataIndex: 'newSalary',
      key: 'new',
      width: 110,
      render: (v) => (
        <span className="text-[13px] font-semibold text-heading">₹{(v || 0).toLocaleString()}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isApplied',
      key: 'status',
      width: 90,
      render: (v) =>
        v ? <DsTag status="paid">Applied</DsTag> : <DsTag status="pending">Pending</DsTag>,
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      width: 50,
      render: (_, r) =>
        r.isApplied ? (
          <Tooltip title="Cannot delete an applied revision">
            <LockOutlined className="text-muted" />
          </Tooltip>
        ) : (
          <Popconfirm
            title="Delete this revision?"
            onConfirm={() => handleDelete(r._id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ),
    },
  ];

  if (!member) return null;

  return (
    <DsModal
      open={open}
      onCancel={onClose}
      footer={null}
      width={740}
      destroyOnHidden
      scrollHeight="calc(100vh - 220px)"
      title={
        <div className="flex items-center gap-2.5">
          <span>Salary Revision - {member.name}</span>
          <DsTag
            status="info"
            style={{ background: 'var(--cr-indigo-50)', color: 'var(--cr-indigo-400)' }}
          >
            ₹{(currentSalary || 0).toLocaleString()}/mo
          </DsTag>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Add revision form */}
        {showAddForm ? (
          <div
            className="rounded-lg border p-4"
            style={{
              borderColor: 'var(--cr-border)',
              background: 'var(--cr-bg-secondary)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[14px] font-semibold">New Salary Revision</span>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => setShowAddForm(false)}
              />
            </div>

            <div className="mb-4">
              <span className="mb-2 block text-[13px] text-muted">Revision Type</span>
              <SegmentedToggle
                options={[
                  { label: 'Fixed Amount', value: 'fixed_amount' },
                  { label: 'Percentage', value: 'percentage' },
                ]}
                value={incrementType}
                onChange={(v) => setIncrementType(v as 'fixed_amount' | 'percentage')}
              />
            </div>

            <div className="mb-4">
              <span className="mb-2 block text-[13px] text-muted">
                {incrementType === 'fixed_amount'
                  ? 'Increment Amount (₹)'
                  : 'Increment Percentage (%)'}
              </span>
              <InputNumber
                style={{ width: '100%' }}
                value={incrementValue}
                onChange={(v) => setIncrementValue(v)}
                min={0.01}
                placeholder={incrementType === 'fixed_amount' ? 'Enter amount' : 'Enter percentage'}
                suffix={incrementType === 'fixed_amount' ? '₹' : '%'}
              />
            </div>

            {previewSalary !== null && (
              <div
                className="mb-4 rounded-lg p-3"
                style={{
                  background: 'var(--cr-success-50)',
                  border: '1px solid var(--cr-success-50)',
                }}
              >
                <span className="text-[13px] text-green-700">
                  Revised salary will be <strong>₹{previewSalary.toLocaleString()}/mo</strong>
                </span>
              </div>
            )}

            <div className="mb-4">
              <span className="mb-2 block text-[13px] text-muted">Effective From</span>
              <Space>
                <Select
                  value={effectiveMonth}
                  onChange={setEffectiveMonth}
                  style={{ width: 140 }}
                  size="large"
                >
                  {MONTHS.map((m, i) => (
                    <Option key={i + 1} value={i + 1}>
                      {m}
                    </Option>
                  ))}
                </Select>
                <InputNumber
                  value={effectiveYear}
                  onChange={(v) => v && setEffectiveYear(v)}
                  min={2000}
                  max={2100}
                  size="large"
                  style={{ width: 100 }}
                />
              </Space>
              {effectiveFromNow && (
                <p className="mt-1 text-[12px] text-amber-700">
                  * This revision will be applied immediately (past or current month)
                </p>
              )}
            </div>

            <div className="mb-4">
              <span className="mb-2 block text-[13px] text-muted">Remarks (optional)</span>
              <Input.TextArea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for revision, e.g. annual appraisal, promotion..."
                rows={2}
              />
            </div>

            <Space>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={adding}
                onClick={handleAddIncrement}
                disabled={!incrementValue || incrementValue <= 0}
              >
                Record Revision
              </Button>
              <Button onClick={() => setShowAddForm(false)}>Cancel</Button>
            </Space>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAddForm(true)}>
              Add Revision
            </Button>
          </div>
        )}

        <Table
          dataSource={increments}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No salary revisions recorded yet' }}
        />
      </div>
    </DsModal>
  );
}
