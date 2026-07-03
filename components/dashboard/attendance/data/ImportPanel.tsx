'use client';

import React, { useState } from 'react';
import {
  App,
  Steps,
  Upload,
  Table,
  Select,
  Button,
  Alert,
  Spin,
  Typography,
  Space,
  Tag,
  Card,
  Result,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import {
  attendanceImportApi,
  type ImportParseResponse,
} from '@/lib/api/modules/attendance-import.api';
import { unwrap } from '@/lib/api/client';
import type { AttendanceDevice, ImportCommitResult } from '@/types';

const { Dragger } = Upload;
const { Text } = Typography;

// Canonical field names the wizard maps CSV headers to.
const CANONICAL_FIELDS = [
  { value: 'deviceUserId', label: 'Device User ID (required)' },
  { value: 'timestamp', label: 'Timestamp (required)' },
  { value: 'punchType', label: 'Punch Type (IN/OUT)' },
  { value: 'deviceSerial', label: 'Device Serial' },
  { value: 'verifyMethod', label: 'Verify Method' },
];

const FORMAT_LABELS: Record<string, string> = {
  zk_dat: 'ZK .dat (attlog)',
  etimetrack_xls: 'eTimeTrackLite XLS',
  biotime_csv: 'BioTime CSV',
  generic_csv: 'Generic CSV',
  generic_xls: 'Generic XLS',
};

const FORMAT_COLORS: Record<string, string> = {
  zk_dat: 'blue',
  etimetrack_xls: 'green',
  biotime_csv: 'purple',
  generic_csv: 'orange',
  generic_xls: 'orange',
};

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface WizardState {
  step: WizardStep;
  file: File | null;
  parseResult: ImportParseResponse | null;
  columnMap: Record<string, string>;
  deviceSerial: string | null;
  memberMap: Record<string, string | null>;
  dryRunResult: ImportCommitResult | null;
  commitResult: ImportCommitResult | null;
  headerSamples: Record<string, string[]>;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: WizardState = {
  step: 1,
  file: null,
  parseResult: null,
  columnMap: {},
  deviceSerial: null,
  memberMap: {},
  dryRunResult: null,
  commitResult: null,
  headerSamples: {},
  loading: false,
  error: null,
};

async function extractHeaderSamples(
  file: File,
  headers: string[],
): Promise<Record<string, string[]>> {
  const name = file.name.toLowerCase();
  // Only text-shaped files: CSV / TXT / DAT. Binary XLS is skipped.
  if (!(name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.dat'))) {
    return {};
  }
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return {};
  const headerLine = lines[0];
  const delim = headerLine.includes('\t') ? '\t' : ',';
  const rawHeaders = headerLine.split(delim).map((h) => h.trim());
  const result: Record<string, string[]> = {};
  for (const h of headers) {
    const idx = rawHeaders.indexOf(h);
    if (idx < 0) {
      result[h] = [];
      continue;
    }
    const samples: string[] = [];
    for (let i = 1; i < lines.length && samples.length < 3; i++) {
      const cells = lines[i].split(delim);
      const v = (cells[idx] ?? '').trim();
      if (v) samples.push(v);
    }
    result[h] = samples;
  }
  return result;
}

export function ImportPanel() {
  const t = useTranslations('attendance');
  const tCommon = useTranslations('common');
  const { message } = App.useApp();
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const router = useRouter();
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const WIZARD_STEPS_I18N = [
    { title: t('import.wizard.upload') },
    { title: t('import.wizard.detect') },
    { title: t('import.wizard.mapColumns') },
    { title: t('import.wizard.device') },
    { title: t('import.wizard.members') },
    { title: t('import.wizard.preview') },
    { title: t('import.wizard.done') },
  ];

  const setPartial = (patch: Partial<WizardState>) => setState((prev) => ({ ...prev, ...patch }));

  // ── Step 1: File selected → call parse endpoint ──
  async function handleFileSelect(file: File): Promise<boolean> {
    if (file.size > 10 * 1024 * 1024) {
      message.error('File too large. Maximum size is 10 MB.');
      return false;
    }
    setPartial({ loading: true, error: null, file });
    try {
      const res = await attendanceImportApi.parse(wsId, file);
      const parseResult = unwrap<ImportParseResponse>(res);
      const headerSamples = await extractHeaderSamples(file, parseResult.headers);
      setPartial({
        parseResult,
        columnMap: parseResult.columnMap ?? {},
        headerSamples,
        step: 2,
        loading: false,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to parse file';
      setPartial({
        loading: false,
        error: errMsg,
      });
    }
    return false; // Prevent antd auto-upload
  }

  // ── Step 3: Column map update ──
  function setColumnMapping(header: string, field: string | null) {
    const updated = { ...state.columnMap };
    if (field) {
      updated[header] = field;
    } else {
      delete updated[header];
    }
    setPartial({ columnMap: updated });
  }

  // ── Navigation ──
  function goNext() {
    setPartial({ step: (state.step + 1) as WizardStep });
  }
  function goBack() {
    setPartial({ step: (state.step - 1) as WizardStep });
  }

  // ── Step 5 → 6: Dry-run ──
  async function handleDryRun() {
    if (!file || !parseResult) return;
    setPartial({ loading: true, error: null });
    try {
      const res = await attendanceImportApi.commit(wsId, file, {
        columnMap,
        memberMap: state.memberMap,
        deviceSerial: deviceSerial === '__none__' ? null : deviceSerial,
        dryRun: true,
      });
      const result = unwrap<ImportCommitResult>(res);
      setPartial({ dryRunResult: result, loading: false, step: 6 });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Dry-run failed';
      setPartial({ loading: false, error: errMsg });
    }
  }

  // ── Step 6 → 7: Live commit ──
  async function handleCommit() {
    if (!file || !parseResult) return;
    setPartial({ loading: true, error: null });
    try {
      const res = await attendanceImportApi.commit(wsId, file, {
        columnMap,
        memberMap: state.memberMap,
        deviceSerial: deviceSerial === '__none__' ? null : deviceSerial,
        dryRun: false,
      });
      const result = unwrap<ImportCommitResult>(res);
      setPartial({ commitResult: result, loading: false, step: 7 });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Import failed';
      setPartial({ loading: false, error: errMsg });
    }
  }

  // ── Step 7: Reset wizard ──
  function handleReset() {
    setState(INITIAL_STATE);
  }

  const { step, file, parseResult, columnMap, deviceSerial, loading } = state;

  // Determine if the required columns are mapped for generic formats
  const deviceUserIdMapped = Object.values(columnMap).includes('deviceUserId');
  const timestampMapped = Object.values(columnMap).includes('timestamp');
  const isGenericFormat =
    parseResult?.format === 'generic_csv' || parseResult?.format === 'generic_xls';
  const canAdvanceStep3 = !isGenericFormat || (deviceUserIdMapped && timestampMapped);

  return (
    <div className="mx-auto max-w-3xl">
      <Steps
        current={step - 1}
        items={WIZARD_STEPS_I18N}
        size="small"
        style={{ marginBottom: 32 }}
      />

      <Spin spinning={loading} size="large">
        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <Card title={t('import.step1.title')}>
            <Dragger
              accept=".dat,.xls,.xlsx,.csv,.txt"
              maxCount={1}
              showUploadList={false}
              beforeUpload={handleFileSelect}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">{t('import.step1.dragHint')}</p>
              <p className="ant-upload-hint">{t('import.step1.supported')}</p>
            </Dragger>
          </Card>
        )}

        {/* ── Step 2: Auto-detect result ── */}
        {step === 2 && parseResult && (
          <Card
            title={t('import.step2.title')}
            extra={
              <Tag color={FORMAT_COLORS[parseResult.format] ?? 'default'}>
                {FORMAT_LABELS[parseResult.format] ?? parseResult.format}
              </Tag>
            }
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {t('import.step2.fileInfo', {
                name: file?.name ?? '',
                count: parseResult.deviceUserIds.length,
              })}
            </Text>
            {parseResult.preview.length > 0 && (
              <Table
                dataSource={parseResult.preview.map((r, i) => ({ ...r, key: i }))}
                columns={[
                  { title: t('import.columns.deviceUserId'), dataIndex: 'deviceUserId' },
                  {
                    title: t('import.columns.timestamp'),
                    dataIndex: 'timestamp',
                    render: (v: string) => {
                      try {
                        return new Date(v).toLocaleString();
                      } catch {
                        return v;
                      }
                    },
                  },
                  { title: t('import.columns.punchType'), dataIndex: 'punchType' },
                  {
                    title: t('import.columns.verify'),
                    dataIndex: 'verifyMethod',
                    render: (v: string | null) => v ?? '-',
                  },
                ]}
                pagination={false}
                size="small"
                scroll={{ x: true }}
              />
            )}
            {parseResult.preview.length === 0 && (
              <Alert type="info" title={t('import.step2.mappingRequired')} />
            )}
            <Space style={{ marginTop: 16 }}>
              <Button onClick={goBack}>{tCommon('back')}</Button>
              <Button type="primary" onClick={goNext}>
                {tCommon('next')}
              </Button>
            </Space>
          </Card>
        )}

        {/* ── Step 3: Column mapping (generic CSV/XLS only) ── */}
        {step === 3 && parseResult && (
          <Card title={t('import.step3.title')}>
            {!isGenericFormat ? (
              <Alert
                type="success"
                title={t('import.step3.autoDetected')}
                style={{ marginBottom: 16 }}
              />
            ) : (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  {t('import.step3.matchHelp')}
                </Text>
                <Table
                  dataSource={parseResult.headers.map((h) => ({ key: h, header: h }))}
                  columns={[
                    { title: t('import.columns.fileColumn'), dataIndex: 'header' },
                    {
                      title: t('import.columns.mapsTo'),
                      render: (_: unknown, record: { header: string }) => (
                        <>
                          <Select
                            style={{ width: 220 }}
                            placeholder={t('import.step3.selectFieldPlaceholder')}
                            allowClear
                            value={columnMap[record.header] ?? undefined}
                            onChange={(val: string | undefined) =>
                              setColumnMapping(record.header, val ?? null)
                            }
                            options={CANONICAL_FIELDS}
                          />
                          {state.headerSamples[record.header]?.length ? (
                            <div className="mt-1 text-xs text-faint">
                              {t('import.step3.samples', {
                                samples: state.headerSamples[record.header].slice(0, 3).join(', '),
                              })}
                            </div>
                          ) : null}
                        </>
                      ),
                    },
                  ]}
                  pagination={false}
                  size="small"
                />
              </>
            )}
            <Space style={{ marginTop: 16 }}>
              <Button onClick={goBack}>{tCommon('back')}</Button>
              <Button type="primary" onClick={goNext} disabled={!canAdvanceStep3}>
                {tCommon('next')}
              </Button>
            </Space>
          </Card>
        )}

        {/* ── Step 4: Device mapping ── */}
        {step === 4 && (
          <DeviceStepCard
            deviceSerial={deviceSerial}
            wsId={wsId}
            onChange={(serial) => setPartial({ deviceSerial: serial })}
            onBack={goBack}
            onNext={goNext}
          />
        )}

        {/* ── Step 5: Member mapping ── */}
        {step === 5 && parseResult && (
          <MemberMappingStep
            wsId={wsId}
            deviceUserIds={parseResult.deviceUserIds}
            memberMap={state.memberMap}
            onChange={(map) => setPartial({ memberMap: map })}
            onBack={goBack}
            onNext={handleDryRun}
            loading={loading}
          />
        )}

        {/* ── Step 6: Dry-run preview ── */}
        {step === 6 && state.dryRunResult && (
          <Card title={t('import.step6.title')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                type="info"
                title={t('import.step6.willInsert', {
                  count: state.dryRunResult.willInsert ?? state.dryRunResult.inserted,
                  skipped: state.dryRunResult.skipped,
                })}
              />
              {state.dryRunResult.errors.length > 0 && (
                <Alert
                  type="warning"
                  title={t('import.step6.rowErrors', { count: state.dryRunResult.errors.length })}
                  description={state.dryRunResult.errors.slice(0, 5).join(', ')}
                />
              )}
            </Space>
            <Space style={{ marginTop: 16 }}>
              <Button onClick={goBack}>{tCommon('back')}</Button>
              <Button type="primary" onClick={handleCommit} loading={loading}>
                {t('import.step6.confirmImport')}
              </Button>
            </Space>
          </Card>
        )}

        {/* ── Step 7: Commit result ── */}
        {step === 7 && state.commitResult && (
          <>
            <Result
              status="success"
              title={t('import.step7.title')}
              subTitle={t('import.step7.summary', {
                inserted: state.commitResult.inserted,
                skipped: state.commitResult.skipped,
                errors: state.commitResult.errors.length,
              })}
              extra={[
                <Button
                  key="goto"
                  type="primary"
                  onClick={() => router.push('/dashboard/attendance')}
                >
                  {t('import.step7.gotoAttendance')}
                </Button>,
                <Button key="again" onClick={handleReset}>
                  {t('import.step7.importAnother')}
                </Button>,
              ]}
            />
            {state.commitResult.errors.length > 0 ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
                title={t('import.step7.someSkipped')}
                description={
                  <ul className="list-disc pl-5">
                    {state.commitResult.errors.slice(0, 10).map((e, i) => (
                      <li key={i} className="text-sm">
                        {e}
                      </li>
                    ))}
                  </ul>
                }
              />
            ) : null}
          </>
        )}

        {state.error ? (
          <Alert
            type="error"
            showIcon
            closable
            onClose={() => setPartial({ error: null })}
            title={t('import.error')}
            description={state.error}
            style={{ marginTop: 16 }}
          />
        ) : null}
      </Spin>
    </div>
  );
}

// ── MemberMappingStep - extracted sub-component for step 5 ──
interface MemberMappingStepProps {
  wsId: string;
  deviceUserIds: string[];
  memberMap: Record<string, string | null>;
  onChange: (map: Record<string, string | null>) => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
}

function MemberMappingStep({
  wsId,
  deviceUserIds,
  memberMap,
  onChange,
  onBack,
  onNext,
  loading,
}: MemberMappingStepProps) {
  const t = useTranslations('attendance');
  const tCommon = useTranslations('common');
  const { message } = App.useApp();
  const [members, setMembers] = useState<Array<{ _id: string; name: string }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  React.useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    void (async () => {
      setLoadingMembers(true);
      try {
        const m = await import('@/lib/api/modules/team.api');
        const res = await m.teamApi.list(wsId);
        if (cancelled) return;
        // teamApi.list returns TeamMember[] | PaginatedResponse<TeamMember> after unwrap,
        // but the actual backend response uses a `members` key (TeamListResponse shape).
        type MemberShape = {
          _id?: string;
          id?: string;
          name: string;
          isActive: boolean;
          isDeleted?: boolean;
        };
        const resUnknown = res as unknown as Record<string, unknown>;
        const raw = Array.isArray(res)
          ? res
          : Array.isArray(resUnknown?.members)
            ? resUnknown.members
            : [];
        const list = raw as MemberShape[];
        setMembers(
          list
            .filter((m) => m.isActive && !m.isDeleted)
            .map((m) => ({ _id: (m._id ?? m.id) as string, name: m.name })),
        );
      } catch {
        if (!cancelled) message.error(t('import.step5.failedLoadMembers'));
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId, t]);

  function setMapping(deviceUserId: string, memberId: string | null) {
    onChange({ ...memberMap, [deviceUserId]: memberId });
  }

  return (
    <Card title={t('import.step5.title')}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {t('import.step5.help')}
      </Text>
      <Spin spinning={loadingMembers}>
        <Table
          dataSource={deviceUserIds.map((id) => ({ key: id, deviceUserId: id }))}
          columns={[
            { title: t('import.columns.deviceUserId'), dataIndex: 'deviceUserId' },
            {
              title: t('import.columns.teamMember'),
              render: (_: unknown, record: { deviceUserId: string }) => (
                <Select
                  style={{ width: 240 }}
                  placeholder={t('import.step5.leaveUnassigned')}
                  allowClear
                  value={memberMap[record.deviceUserId] ?? undefined}
                  onChange={(val: string | undefined) =>
                    setMapping(record.deviceUserId, val ?? null)
                  }
                  showSearch
                  filterOption={(input, option) =>
                    ((option?.label as string) ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={members.map((m) => ({
                    value: m._id,
                    label: m.name,
                  }))}
                />
              ),
            },
          ]}
          pagination={false}
          size="small"
        />
      </Spin>
      <Space style={{ marginTop: 16 }}>
        <Button onClick={onBack}>{tCommon('back')}</Button>
        <Button type="primary" onClick={onNext} loading={loading}>
          {t('import.step5.previewImport')}
        </Button>
      </Space>
    </Card>
  );
}

// ── DeviceStepCard - extracted sub-component for step 4 ──
interface DeviceStepCardProps {
  wsId: string;
  deviceSerial: string | null;
  onChange: (serial: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}

function DeviceStepCard({ wsId, deviceSerial, onChange, onBack, onNext }: DeviceStepCardProps) {
  const t = useTranslations('attendance');
  const tCommon = useTranslations('common');
  const { message } = App.useApp();
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  React.useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    void (async () => {
      setLoadingDevices(true);
      try {
        const m = await import('@/lib/api/modules/attendance-devices.api');
        const list = await m.attendanceDevicesApi.listDevices(wsId, 'active');
        if (!cancelled) setDevices(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) message.error(t('import.step4.failedLoadDevices'));
      } finally {
        if (!cancelled) setLoadingDevices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId, t]);

  return (
    <Card title={t('import.step4.title')}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {t('import.step4.help')}
      </Text>
      <Spin spinning={loadingDevices}>
        <Select
          style={{ width: 320 }}
          placeholder={t('import.step4.selectDevicePlaceholder')}
          allowClear
          value={deviceSerial ?? undefined}
          onChange={(val: string | undefined) => onChange(val ?? null)}
          options={[
            { value: '__none__', label: t('import.step4.noDeviceOption') },
            ...devices.map((d) => ({
              value: d.serial,
              label: d.alias ? `${d.alias} (${d.serial})` : d.serial,
            })),
          ]}
        />
      </Spin>
      <Space style={{ marginTop: 16 }}>
        <Button onClick={onBack}>{tCommon('back')}</Button>
        <Button
          type="primary"
          onClick={() => {
            // Normalize __none__ selection to null
            if (deviceSerial === '__none__') onChange(null);
            onNext();
          }}
        >
          {tCommon('next')}
        </Button>
      </Space>
    </Card>
  );
}
