'use client';

import { startTransition, use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Drawer, Form, Input, Select, Tag, message, Spin, Space, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, LinkOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { listParties, createParty, gstinLookup } from '@/lib/actions/finance.actions';
import type { Party, PartySegment, GstinRiskLevel } from '@/types';
import SegmentChip from '@/components/parties/SegmentChip';
import GstinRiskBadge from '@/components/parties/GstinRiskBadge';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

// Party-type option values (labels resolved via finance.parties.type i18n at render time).
const PARTY_TYPE_VALUES = [
  'customer',
  'vendor',
  'broker',
  'transporter',
  'employee_advance',
] as const;

// i18n key for each party-type value (employee_advance -> employeeAdvance).
const PARTY_TYPE_I18N: Record<string, string> = {
  customer: 'customer',
  vendor: 'vendor',
  broker: 'broker',
  transporter: 'transporter',
  employee_advance: 'employeeAdvance',
};

const TYPE_COLORS: Record<string, string> = {
  customer: 'blue',
  vendor: 'orange',
  broker: 'purple',
  transporter: 'cyan',
  employee_advance: 'gold',
};

const SEGMENT_OPTIONS: { value: PartySegment; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'VIP', label: 'VIP' },
  { value: 'DORMANT', label: 'Dormant' },
  { value: 'CHURNED', label: 'Churned' },
  { value: 'BLACKLIST', label: 'Blacklisted' },
];

const GSTIN_OPTIONS: { value: GstinRiskLevel; label: string }[] = [
  { value: 'OK', label: 'OK' },
  { value: 'WATCH', label: 'Watch' },
  { value: 'RISK', label: 'Risk' },
  { value: 'CRITICAL', label: 'Critical' },
];

// Severity rank for the GSTIN sort: CRITICAL → OK
const GSTIN_SEVERITY: Record<GstinRiskLevel, number> = {
  CRITICAL: 4,
  RISK: 3,
  WATCH: 2,
  OK: 1,
};

export default function PartiesPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const { firmId } = use(params);
  const t = useTranslations('finance.parties');
  const tPI = useTranslations('party-intelligence');
  // tShared only sources the shared list error-state labels (finance.sales.listCommon.*).
  const tShared = useTranslations('finance.sales');
  const financeAccess = useFeatureAccess('finance');

  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gstinLoading, setGstinLoading] = useState(false);
  const [form] = Form.useForm();
  // Persist the primary segment filter per firm (survives navigation / reload).
  const [segmentFilter, setSegmentFilter] = usePersistedState<PartySegment[]>(
    `finance:parties:segment:${firmId || 'global'}`,
    [],
  );
  const [gstinFilter, setGstinFilter] = useState<GstinRiskLevel[]>([]);

  const loadParties = () => {
    if (!wsId || financeAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listParties(wsId, firmId)
      .then((r) => setParties(r?.items ?? []))
      .catch(() => {
        setParties([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadParties();
  }, [wsId, firmId, financeAccess.isLocked]);

  // v1: client-side filtering since intelligence is embedded on the Party doc.
  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      if (segmentFilter.length > 0) {
        const seg = p.intelligence?.segment;
        if (!seg || !segmentFilter.includes(seg)) return false;
      }
      if (gstinFilter.length > 0) {
        const lvl = p.intelligence?.gstinRiskLevel;
        if (!lvl || !gstinFilter.includes(lvl)) return false;
      }
      return true;
    });
  }, [parties, segmentFilter, gstinFilter]);

  async function handleGstinFetch() {
    const gstin = form.getFieldValue('gstin');
    if (!gstin) {
      message.warning(t('drawer.enterGstinFirst'));
      return;
    }
    setGstinLoading(true);
    try {
      const info = await gstinLookup(wsId, gstin, firmId);
      form.setFieldsValue({ name: info.legalName, state: info.stateCode, address: info.address });
      message.success(t('drawer.gstinFetched', { name: info.legalName }));
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('drawer.gstinFailed'));
    } finally {
      setGstinLoading(false);
    }
  }

  async function handleSave(values: Record<string, unknown>) {
    setSaving(true);
    try {
      await createParty(wsId, firmId, values as Partial<Party>);
      message.success(t('drawer.created'));
      setDrawerOpen(false);
      form.resetFields();
      loadParties();
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('drawer.createFailed'));
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { title: t('common.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('list.colType'),
      dataIndex: 'partyType',
      key: 'partyType',
      render: (pt: string) => (
        <Tag color={TYPE_COLORS[pt] ?? 'default'}>
          {PARTY_TYPE_I18N[pt] ? t(`type.${PARTY_TYPE_I18N[pt]}` as Parameters<typeof t>[0]) : pt}
        </Tag>
      ),
    },
    {
      // Phase 17 / Plan 07 - Segment column. Sort alphabetic by segment string.
      title: tPI('rfm.title'),
      key: 'segment',
      sorter: (a: Party, b: Party) =>
        (a.intelligence?.segment ?? '').localeCompare(b.intelligence?.segment ?? ''),
      render: (_: unknown, row: Party) => <SegmentChip segment={row.intelligence?.segment} />,
    },
    {
      // Phase 17 / Plan 07 - GSTIN risk column. Sort by severity (CRITICAL → OK).
      title: 'GSTIN',
      key: 'gstinRisk',
      sorter: (a: Party, b: Party) =>
        (GSTIN_SEVERITY[b.intelligence?.gstinRiskLevel ?? 'OK'] ?? 0) -
        (GSTIN_SEVERITY[a.intelligence?.gstinRiskLevel ?? 'OK'] ?? 0),
      render: (_: unknown, row: Party) => (
        <GstinRiskBadge
          level={row.intelligence?.gstinRiskLevel}
          lastVerifiedAt={row.intelligence?.gstinFilingsCheckedAt}
          lastError={row.intelligence?.gstinFilingsLastError}
        />
      ),
    },
    {
      title: t('common.phone'),
      dataIndex: 'phone',
      key: 'phone',
      render: (v?: string) => v ?? '-',
    },
    {
      title: t('list.colCreditTerms'),
      dataIndex: 'creditTermsDays',
      key: 'creditTermsDays',
      render: (v: number) => t('list.creditTermsValue', { days: v }),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: unknown, row: Party) => (
        <Space>
          <Tooltip title={t('list.detailTooltip')}>
            <Link href={`/dashboard/parties/${row._id}?firm=${firmId}`} className="no-underline">
              <Button size="small">{t('common.detail')}</Button>
            </Link>
          </Tooltip>
          <Tooltip title={t('list.portalTooltip')}>
            <Link
              href={`/dashboard/parties/${row._id}/portal-access?firm=${firmId}`}
              className="no-underline"
            >
              <Button size="small" icon={<LinkOutlined />}>
                {t('list.portalLink')}
              </Button>
            </Link>
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (financeAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (financeAccess.isLocked) {
    return <ModuleLockedPage module="finance" />;
  }

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('list.title')}
        icon={<TeamOutlined />}
        style={{ marginBottom: 16 }}
        right={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            {t('list.addParty')}
          </Button>
        }
      />

      {/* Phase 17 / Plan 07 - Segment + GSTIN filter dropdowns. */}
      <Space style={{ marginBottom: 12 }} wrap>
        <Select<PartySegment[]>
          mode="multiple"
          allowClear
          style={{ minWidth: 220 }}
          placeholder={tPI('rfm.title')}
          aria-label={t('list.filterSegment')}
          value={segmentFilter}
          onChange={(v) => setSegmentFilter(v ?? [])}
          options={SEGMENT_OPTIONS.map((o) => ({
            value: o.value,
            label: tPI(`segment.${o.value}`),
          }))}
        />
        <Select<GstinRiskLevel[]>
          mode="multiple"
          allowClear
          style={{ minWidth: 220 }}
          placeholder={t('list.filterGstinPlaceholder', {
            ok: tPI('gstin.OK'),
            critical: tPI('gstin.CRITICAL'),
          })}
          aria-label={t('list.filterGstin')}
          value={gstinFilter}
          onChange={(v) => setGstinFilter(v ?? [])}
          options={GSTIN_OPTIONS.map((o) => ({ value: o.value, label: tPI(`gstin.${o.value}`) }))}
        />
      </Space>

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={loadParties}
        />
      ) : (
        <DsTable
          dataSource={filteredParties}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="small"
        />
      )}

      <Drawer
        title={t('drawer.addTitle')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ wrapper: { width: 520 } }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setDrawerOpen(false)} style={{ marginRight: 8 }}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item label={t('drawer.partyType')} name="partyType" rules={[{ required: true }]}>
            <Select
              options={PARTY_TYPE_VALUES.map((v) => ({
                value: v,
                label: t(`type.${PARTY_TYPE_I18N[v]}` as Parameters<typeof t>[0]),
              }))}
            />
          </Form.Item>
          <Form.Item label={t('drawer.gstin')}>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="gstin" noStyle>
                <Input
                  placeholder={t('drawer.gstinPlaceholder')}
                  maxLength={15}
                  style={{ textTransform: 'uppercase' }}
                />
              </Form.Item>
              <Button loading={gstinLoading} onClick={handleGstinFetch} icon={<SearchOutlined />}>
                {t('drawer.fetch')}
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label={t('common.name')} name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t('common.state')} name="state">
            <Input placeholder={t('drawer.statePlaceholder')} maxLength={2} />
          </Form.Item>
          <Form.Item label={t('common.phone')} name="phone">
            <Input />
          </Form.Item>
          <Form.Item label={t('common.email')} name="email">
            <Input type="email" />
          </Form.Item>
          <Form.Item label={t('common.address')} name="address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label={t('drawer.creditTermsLabel')} name="creditTermsDays" initialValue={30}>
            <Input type="number" min={0} />
          </Form.Item>
          <Form.Item
            label={t('drawer.printLanguageLabel')}
            name="preferredLocale"
            tooltip={t('drawer.printLanguageTooltip')}
          >
            <Select
              allowClear
              placeholder={t('drawer.useWorkspaceDefault')}
              options={[
                { value: 'en', label: 'English' },
                { value: 'gu', label: 'ગુજરાતી' },
                { value: 'hi', label: 'हिन्दी' },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
