'use client';
/**
 * D19 generic onboarding-import wizard: upload CSV/XLSX -> map columns -> dry-run report -> commit.
 * Entity-agnostic - parties, opening balances, etc. pass an ImportWizardConfig (fields + the
 * validate/commit calls + how to render a row's identifying value). Parses the file client-side
 * with SheetJS and posts already-mapped rows. Wrappers: ImportPartiesWizard, ImportOpeningBalancesWizard.
 */
import { useState } from 'react';
import {
  Steps,
  Upload,
  Button,
  Select,
  Table,
  Tag,
  Alert,
  Result,
  Space,
  Typography,
  App,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

export interface ImportDryRunRow {
  index: number;
  status: 'valid' | 'error' | 'duplicate';
  error?: string;
}

export interface ImportDryRun {
  summary: { total: number; valid: number; errors: number; duplicates: number };
  rows: ImportDryRunRow[];
}

export interface ImportWizardConfig {
  /** Field keys to map, with a resolved label and whether mapping is required. */
  fields: { key: string; label: string; required?: boolean }[];
  validate: (rows: Record<string, string>[]) => Promise<ImportDryRun>;
  commit: (rows: Record<string, string>[]) => Promise<{ created: number; skipped: number }>;
  /** Header + per-row value for the identifying column in the review table. */
  primaryColLabel: string;
  primaryValue: (row: ImportDryRunRow) => string;
  /** Optional: extract entity rows from a Tally master-export XML (LEDGER / STOCKITEM). When set,
   *  the wizard also accepts .xml; rows come pre-keyed by field so no column mapping is needed. */
  parseTallyXml?: (doc: Document) => Record<string, string>[];
}

export function ImportWizard({ config }: { config: ImportWizardConfig }) {
  const t = useTranslations('finance.import');
  const { message } = App.useApp();

  const [step, setStep] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | undefined>>({});
  const [dryRun, setDryRun] = useState<ImportDryRun | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const requiredKeys = config.fields.filter((f) => f.required).map((f) => f.key);

  // Step 0: parse the uploaded file. Tally master-export XML (.xml) is extracted by the entity's
  // parseTallyXml into already-keyed rows; CSV/XLSX is parsed by SheetJS then auto-mapped.
  const parseFile = (file: File): boolean => {
    const isXml = file.name.toLowerCase().endsWith('.xml');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (isXml) {
          if (!config.parseTallyXml) {
            message.error(t('parseFailed'));
            return;
          }
          const doc = new DOMParser().parseFromString(
            String(e.target?.result ?? ''),
            'application/xml',
          );
          const extracted = config.parseTallyXml(doc);
          if (!extracted.length) {
            message.error(t('emptyFile'));
            return;
          }
          // Tally rows already carry the entity field keys -> identity map, skip column matching.
          const fieldKeys = config.fields.map((f) => f.key);
          setHeaders(fieldKeys);
          setRawRows(
            extracted.map((r) => {
              const o: Record<string, string> = {};
              for (const k of fieldKeys) o[k] = (r[k] ?? '').toString().trim();
              return o;
            }),
          );
          setMapping(Object.fromEntries(fieldKeys.map((k) => [k, k])));
          setStep(1);
          return;
        }
        // SheetJS is ~1MB minified; load it on demand at parse time so it stays out of the
        // import pages' route chunks. Same lazy pattern as lib/export/exportExcel.ts.
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        if (!json.length) {
          message.error(t('emptyFile'));
          return;
        }
        const cols = Object.keys(json[0] as object);
        const rows = json.map((r) => {
          const o: Record<string, string> = {};
          for (const c of cols) o[c] = String((r as Record<string, unknown>)[c] ?? '').trim();
          return o;
        });
        // Auto-map: match each field to a column whose normalised header contains the field key.
        const auto: Record<string, string | undefined> = {};
        for (const f of config.fields) {
          const hit = cols.find((c) =>
            c
              .toLowerCase()
              .replace(/[^a-z]/g, '')
              .includes(f.key.toLowerCase()),
          );
          if (hit) auto[f.key] = hit;
        }
        setHeaders(cols);
        setRawRows(rows);
        setMapping(auto);
        setStep(1);
      } catch {
        message.error(t('parseFailed'));
      }
    };
    if (isXml) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
    return false; // stop AntD's default upload
  };

  const mappedRows = (): Record<string, string>[] =>
    rawRows.map((r) => {
      const o: Record<string, string> = {};
      for (const f of config.fields) {
        const src = mapping[f.key];
        if (src) o[f.key] = r[src] ?? '';
      }
      return o;
    });

  const runDryRun = async () => {
    const missing = requiredKeys.find((k) => !mapping[k]);
    if (missing) {
      message.error(
        t('mapRequired', { field: config.fields.find((f) => f.key === missing)?.label ?? missing }),
      );
      return;
    }
    setBusy(true);
    try {
      setDryRun(await config.validate(mappedRows()));
      setStep(2);
    } catch {
      message.error(t('validateFailed'));
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    setBusy(true);
    try {
      setResult(await config.commit(mappedRows()));
      setStep(3);
    } catch {
      message.error(t('commitFailed'));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(0);
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setDryRun(null);
    setResult(null);
  };

  const statusColor: Record<string, string> = {
    valid: 'success',
    error: 'error',
    duplicate: 'warning',
  };

  // Download a blank CSV whose header row is exactly the field keys this entity expects, so the
  // user fills the right columns (auto-map then matches them). Client-only Blob download.
  const downloadTemplate = () => {
    const header = config.fields.map((f) => f.key).join(',');
    const blob = new Blob([`${header}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export the rows that failed (error / duplicate) with their reason, so the user fixes the file
  // offline and re-uploads instead of hunting through a paginated table.
  const downloadErrors = () => {
    if (!dryRun) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const problems = dryRun.rows.filter((r) => r.status !== 'valid');
    const csv = [
      'row,value,status,reason',
      ...problems.map(
        (r) => `${r.index + 1},${esc(config.primaryValue(r))},${r.status},${esc(r.error ?? '')}`,
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 880 }}>
      <Steps
        current={step}
        style={{ marginBottom: 24 }}
        items={[
          { title: t('step.upload') },
          { title: t('step.map') },
          { title: t('step.review') },
          { title: t('step.done') },
        ]}
      />

      {step === 0 && (
        <div>
          <Upload.Dragger
            accept={config.parseTallyXml ? '.csv,.xlsx,.xls,.xml' : '.csv,.xlsx,.xls'}
            beforeUpload={parseFile}
            maxCount={1}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t('uploadHint')}</p>
            <p className="ant-upload-hint">{t('uploadSub')}</p>
          </Upload.Dragger>
          <div style={{ marginTop: 12 }}>
            <Button onClick={downloadTemplate}>{t('downloadTemplate')}</Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <Typography.Paragraph type="secondary">{t('mapIntro')}</Typography.Paragraph>
          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            {config.fields.map((f) => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 220, fontSize: 13 }}>
                  {f.label}
                  {f.required && <span style={{ color: 'var(--cr-error)' }}> *</span>}
                </span>
                <Select
                  allowClear
                  showSearch
                  style={{ flex: 1 }}
                  placeholder={t('mapColumnPlaceholder')}
                  value={mapping[f.key]}
                  options={headers.map((h) => ({ value: h, label: h }))}
                  onChange={(v) => setMapping((m) => ({ ...m, [f.key]: v }))}
                />
              </div>
            ))}
          </Space>
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <Button onClick={reset}>{t('back')}</Button>
            <Button type="primary" loading={busy} onClick={runDryRun}>
              {t('validateBtn', { count: rawRows.length })}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && dryRun && (
        <div>
          <Alert
            type={dryRun.summary.valid > 0 ? 'info' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
            title={t('reviewSummary', {
              total: dryRun.summary.total,
              valid: dryRun.summary.valid,
              errors: dryRun.summary.errors,
              duplicates: dryRun.summary.duplicates,
            })}
          />
          <Table
            size="small"
            rowKey="index"
            pagination={{ pageSize: 10 }}
            dataSource={dryRun.rows}
            columns={[
              { title: '#', dataIndex: 'index', width: 50, render: (i: number) => i + 1 },
              {
                title: config.primaryColLabel,
                width: 240,
                render: (_: unknown, r) => config.primaryValue(r),
              },
              {
                title: t('col.status'),
                dataIndex: 'status',
                width: 110,
                render: (s: string) => <Tag color={statusColor[s]}>{t(`status.${s}`)}</Tag>,
              },
              { title: t('col.detail'), dataIndex: 'error', render: (e?: string) => e ?? '' },
            ]}
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Button onClick={() => setStep(1)}>{t('back')}</Button>
            {dryRun.summary.errors + dryRun.summary.duplicates > 0 && (
              <Button onClick={downloadErrors}>{t('downloadErrors')}</Button>
            )}
            <Button
              type="primary"
              loading={busy}
              disabled={dryRun.summary.valid === 0}
              onClick={runCommit}
            >
              {t('commitBtn', { count: dryRun.summary.valid })}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <Result
          status="success"
          title={t('doneTitle', { created: result.created })}
          subTitle={t('doneSub', { created: result.created, skipped: result.skipped })}
          extra={
            <Button type="primary" onClick={reset}>
              {t('importMore')}
            </Button>
          }
        />
      )}
    </div>
  );
}
