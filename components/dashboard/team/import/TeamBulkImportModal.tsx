'use client';

// Team CSV bulk-import wizard.
//
// What it does: 4-step modal - upload a CSV (CSV ONLY; .xlsx is rejected),
// map columns to member fields (first/last name recombine into one `name`),
// preview + validate every row, then PIN-confirm and post to the BE.
//
// Cross-module links:
//   • Parsing/mapping/validation -> lib/team/csvImport.
//   • Submit -> lib/actions `bulkCreateTeamMembers` -> BE team.service.bulkCreate.
//   • PIN gate -> components/common/PinConfirmModal (auth/pin-verify).
//   • Mounted by app/dashboard/team/page.tsx header ("Bulk upload").
//
// Watch: import only sends rows with zero blocking errors; warnings (coerced /
// dropped cells) don't block. Keep the field list in sync with csvImport's
// IMPORT_FIELDS and the BE CreateTeamMemberDto.

import { useCallback, useMemo, useState } from 'react';
import {
  App,
  Modal,
  Steps,
  Upload,
  Button,
  Select,
  Table,
  Alert,
  Tag,
  Tooltip,
  Popover,
  Checkbox,
} from 'antd';
import {
  InboxOutlined,
  DownloadOutlined,
  CheckCircleFilled,
  WarningOutlined,
  CloseCircleFilled,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { bulkCreateTeamMembers } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import PinConfirmModal from '@/components/common/PinConfirmModal';
import {
  IMPORT_FIELDS,
  TEMPLATE_FIELDS,
  MAX_BULK_IMPORT_ROWS,
  autoMapColumns,
  buildMappedRows,
  buildTemplateCsv,
  parseCsvFile,
  type ColumnMapping,
  type ImportFieldKey,
  type MappedRow,
  type ParsedCsv,
} from '@/lib/team/csvImport';
import type { BulkCreateTeamMembersResult, Shift } from '@/types';

const { Dragger } = Upload;
const NOT_MAPPED = '__none__';

interface TeamBulkImportModalProps {
  open: boolean;
  workspaceId: string;
  /** Workspace shifts (from the Team page) used to resolve CSV shift names to shiftIds. */
  shifts: Shift[];
  onClose: () => void;
  /** Fired after a successful (even partial) import so the list refreshes. */
  onImported: () => void;
}

export default function TeamBulkImportModal({
  open,
  workspaceId,
  shifts,
  onClose,
  onImported,
}: TeamBulkImportModalProps) {
  const { message: msg } = App.useApp();
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [parsing, setParsing] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<BulkCreateTeamMembersResult | null>(null);
  // Template field picker: which employee details to include as columns.
  // Seeded from the default set; documents are never offered (CSV can't carry
  // files). Required fields (first name) are always included by buildTemplateCsv.
  const [tplFields, setTplFields] = useState<ImportFieldKey[]>(() =>
    TEMPLATE_FIELDS.filter((f) => f.defaultOn && !f.required).map((f) => f.key),
  );
  const [tplOpen, setTplOpen] = useState(false);

  const reset = useCallback(() => {
    setStep(0);
    setParsed(null);
    setMapping({});
    setParsing(false);
    setPinOpen(false);
    setSubmitting(false);
    setProgress(null);
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, reset, onClose]);

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([buildTemplateCsv(tplFields)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manekhr_team_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    setTplOpen(false);
  }, [tplFields]);

  // Manual upload: reject non-CSV up front, parse, auto-map, advance.
  const beforeUpload: NonNullable<UploadProps['beforeUpload']> = useCallback(
    (file: File) => {
      const isCsv = /\.csv$/i.test(file.name);
      if (!isCsv) {
        msg.error('Only .csv files are accepted. Re-save your sheet as CSV and try again.');
        return Upload.LIST_IGNORE;
      }
      setParsing(true);
      parseCsvFile(file)
        .then((p) => {
          if (p.rows.length === 0) {
            msg.error('That CSV has headers but no data rows.');
            setParsing(false);
            return;
          }
          setParsed(p);
          setMapping(autoMapColumns(p.headers));
          setStep(1);
        })
        .catch((e) => msg.error(e instanceof Error ? e.message : 'Could not read the CSV.'))
        .finally(() => setParsing(false));
      return Upload.LIST_IGNORE; // we handle the file ourselves
    },
    [msg],
  );

  const headerOptions = useMemo(
    () => [
      { value: NOT_MAPPED, label: '- Not mapped -' },
      ...(parsed?.headers ?? []).map((h) => ({ value: h, label: h })),
    ],
    [parsed],
  );

  // A name source is mandatory: either the combined Name column, or at least
  // the First name column (surname alone can't form a name).
  const hasNameSource = !!mapping.name || !!mapping.firstName;

  const mappedRows: MappedRow[] = useMemo(() => {
    if (!parsed) return [];
    return buildMappedRows(parsed, mapping, shifts);
  }, [parsed, mapping, shifts]);

  const validRows = useMemo(() => mappedRows.filter((r) => r.errors.length === 0), [mappedRows]);
  const invalidCount = mappedRows.length - validRows.length;
  const warnCount = useMemo(
    () => mappedRows.filter((r) => r.errors.length === 0 && r.warnings.length > 0).length,
    [mappedRows],
  );
  const overCap = validRows.length > MAX_BULK_IMPORT_ROWS;

  const runImport = useCallback(async () => {
    setSubmitting(true);
    setProgress(null);
    // Chunk the upload: one POST per CHUNK rows. The BE runs a sequential
    // per-member create() loop; bulkCreateTeamMembers gives that endpoint a 120s
    // per-request ceiling so a chunk never races the axios timeout (the old 15s
    // default surfaced phantom "timeout of 15000ms exceeded" rows for members the
    // BE had actually saved). We still chunk so the user sees steady progress and
    // a mid-run network failure only loses one batch, not the whole run. Indices
    // in the BE report are chunk-local - we offset them back to global row order.
    const CHUNK = 25;
    const rows = validRows;
    const aggregate: BulkCreateTeamMembersResult = { total: rows.length, created: [], failed: [] };
    try {
      for (let start = 0; start < rows.length; start += CHUNK) {
        const slice = rows.slice(start, start + CHUNK);
        setProgress(`Importing ${Math.min(start + slice.length, rows.length)} / ${rows.length}…`);
        try {
          const res = await bulkCreateTeamMembers(workspaceId, {
            members: slice.map((r) => r.payload),
          });
          aggregate.created.push(...res.created.map((c) => ({ ...c, index: start + c.index })));
          aggregate.failed.push(...res.failed.map((f) => ({ ...f, index: start + f.index })));
        } catch (e) {
          // A whole chunk failed (network/timeout). Mark its rows failed and
          // keep going so one bad batch doesn't lose the rest.
          const reason = parseApiError(e) ?? 'Request failed';
          slice.forEach((r, i) =>
            aggregate.failed.push({ index: start + i, name: r.payload.name, error: reason }),
          );
        }
      }
      setResult(aggregate);
      setPinOpen(false);
      setStep(3);
      if (aggregate.created.length > 0) onImported();
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }, [workspaceId, validRows, onImported]);

  // ── Mapping step columns ────────────────────────────────────────────────
  const usedHeaders = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of IMPORT_FIELDS) {
      const h = mapping[f.key];
      if (h) m.set(h, f.key);
    }
    return m;
  }, [mapping]);

  const previewColumns = useMemo(
    () => [
      {
        title: '#',
        dataIndex: 'rowNumber',
        width: 56,
        render: (n: number) => <span className="text-faint tabular-nums">{n}</span>,
      },
      {
        title: 'Status',
        key: 'status',
        width: 90,
        render: (_: unknown, r: MappedRow) =>
          r.errors.length > 0 ? (
            <Tooltip title={r.errors.join(' ')}>
              <Tag icon={<CloseCircleFilled />} color="error">
                Error
              </Tag>
            </Tooltip>
          ) : r.warnings.length > 0 ? (
            <Tooltip title={r.warnings.join(' ')}>
              <Tag icon={<WarningOutlined />} color="warning">
                Warning
              </Tag>
            </Tooltip>
          ) : (
            <Tag icon={<CheckCircleFilled />} color="success">
              OK
            </Tag>
          ),
      },
      { title: 'Name', dataIndex: ['payload', 'name'], key: 'name', ellipsis: true },
      {
        // Employee code is auto-generated on import (immutable, never from CSV),
        // so the preview shows email instead — a uniqueness-sensitive field.
        title: 'Email',
        key: 'email',
        ellipsis: true,
        render: (_: unknown, r: MappedRow) => r.payload.email ?? '-',
      },
      {
        title: 'Mobile',
        key: 'mobile',
        width: 120,
        render: (_: unknown, r: MappedRow) => r.payload.mobile ?? '-',
      },
      {
        title: 'Designation',
        key: 'designation',
        ellipsis: true,
        render: (_: unknown, r: MappedRow) => r.payload.designation ?? '-',
      },
      {
        title: 'Location',
        key: 'location',
        width: 110,
        render: (_: unknown, r: MappedRow) => r.payload.location ?? '-',
      },
      {
        title: 'Shift',
        key: 'shift',
        width: 120,
        render: (_: unknown, r: MappedRow) =>
          r.payload.shiftId
            ? (shifts.find((s) => (s.id ?? s._id) === r.payload.shiftId)?.name ?? 'Assigned')
            : '-',
      },
    ],
    [shifts],
  );

  return (
    <>
      <Modal
        open={open}
        onCancel={handleClose}
        title="Bulk upload team members"
        footer={null}
        width={step >= 2 ? 920 : 640}
        destroyOnHidden
        mask={{ closable: !submitting }}
      >
        <Steps
          size="small"
          current={step}
          className="mb-5"
          items={[
            { title: 'Upload' },
            { title: 'Map columns' },
            { title: 'Preview' },
            { title: 'Done' },
          ]}
        />

        {/* ── Step 0: upload ─────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <Alert
              type="info"
              showIcon
              title="CSV files only"
              description="Export or save your spreadsheet as .csv. Columns can be in any order - you'll map them in the next step."
            />
            <Dragger
              accept=".csv,text/csv"
              multiple={false}
              showUploadList={false}
              beforeUpload={beforeUpload}
              disabled={parsing}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                {parsing ? 'Reading file…' : 'Click or drag a .csv file here'}
              </p>
              <p className="ant-upload-hint">Surname-first sheets are fine - mapping handles it.</p>
            </Dragger>
            <div className="flex justify-between">
              <Popover
                open={tplOpen}
                onOpenChange={setTplOpen}
                trigger="click"
                placement="topLeft"
                title="Which details do you need?"
                content={
                  <div className="w-[280px] space-y-2">
                    <p className="m-0 text-xs text-subtle">
                      Tick the columns to include. Documents aren&apos;t supported in CSV - upload
                      them on each member&apos;s profile after import.
                    </p>
                    <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
                      {TEMPLATE_FIELDS.map((f) => (
                        <div key={f.key}>
                          <Checkbox
                            checked={!!f.required || tplFields.includes(f.key)}
                            disabled={!!f.required}
                            onChange={(e) =>
                              setTplFields((prev) =>
                                e.target.checked
                                  ? [...prev, f.key]
                                  : prev.filter((k) => k !== f.key),
                              )
                            }
                          >
                            {f.header}
                            {f.required && <span className="ml-1 text-faint">(required)</span>}
                          </Checkbox>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="primary"
                      size="small"
                      icon={<DownloadOutlined />}
                      block
                      onClick={downloadTemplate}
                    >
                      Download template
                    </Button>
                  </div>
                }
              >
                <Button type="link" icon={<DownloadOutlined />}>
                  Choose fields &amp; download template
                </Button>
              </Popover>
              <Button onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}

        {/* ── Step 1: map columns ────────────────────────────────────── */}
        {step === 1 && parsed && (
          <div className="space-y-4">
            <p className="m-0 text-sm text-subtle">
              We matched your columns automatically. Fix any that look wrong. First name + Last name
              combine into the member&apos;s full name in the correct order.
            </p>
            <div className="max-h-[46vh] space-y-2.5 overflow-y-auto pr-1">
              {IMPORT_FIELDS.map((f) => {
                const current = mapping[f.key] ?? NOT_MAPPED;
                const dup =
                  current !== NOT_MAPPED && usedHeaders.get(current) !== f.key ? false : true;
                return (
                  <div key={f.key} className="grid grid-cols-[180px_1fr] items-center gap-3">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-heading">{f.label}</span>
                      {f.hint && <p className="m-0 text-[11px] text-faint">{f.hint}</p>}
                    </div>
                    <Select
                      value={current}
                      options={headerOptions}
                      onChange={(v) =>
                        setMapping((prev) => ({
                          ...prev,
                          [f.key]: v === NOT_MAPPED ? undefined : v,
                        }))
                      }
                      status={!dup ? 'warning' : undefined}
                      className="w-full"
                      size="middle"
                    />
                  </div>
                );
              })}
            </div>
            {!hasNameSource && (
              <Alert
                type="error"
                showIcon
                title="Map a name source"
                description="Map either Full name, or First name (with Last name) so we can build each member's name."
              />
            )}
            <div className="flex justify-between pt-1">
              <Button onClick={() => setStep(0)}>Back</Button>
              <Button type="primary" disabled={!hasNameSource} onClick={() => setStep(2)}>
                Preview {parsed.rows.length} rows
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: preview + validate ─────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Tag color="success">{validRows.length} ready</Tag>
              {warnCount > 0 && <Tag color="warning">{warnCount} with warnings</Tag>}
              {invalidCount > 0 && <Tag color="error">{invalidCount} skipped</Tag>}
            </div>
            {overCap && (
              <Alert
                type="error"
                showIcon
                title={`Too many rows (${validRows.length})`}
                description={`Import up to ${MAX_BULK_IMPORT_ROWS} members at a time. Split the file and upload in batches.`}
              />
            )}
            {invalidCount > 0 && (
              <Alert
                type="warning"
                showIcon
                title={`${invalidCount} row(s) will be skipped`}
                description="Rows with errors (e.g. missing name) are not imported. Hover the Error tag to see why."
              />
            )}
            <Table<MappedRow>
              size="small"
              rowKey="rowNumber"
              dataSource={mappedRows}
              columns={previewColumns}
              pagination={{ pageSize: 8, size: 'small', showSizeChanger: false }}
              scroll={{ x: 760 }}
            />
            <div className="flex justify-between pt-1">
              <Button onClick={() => setStep(1)}>Back</Button>
              <Button
                type="primary"
                disabled={validRows.length === 0 || overCap}
                onClick={() => setPinOpen(true)}
              >
                Import {validRows.length} member{validRows.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: result ─────────────────────────────────────────── */}
        {step === 3 && result && (
          <div className="space-y-4">
            <Alert
              type={result.failed.length === 0 ? 'success' : 'warning'}
              showIcon
              title={
                result.failed.length === 0
                  ? `Imported ${result.created.length} member${result.created.length === 1 ? '' : 's'}`
                  : `Imported ${result.created.length} of ${result.total} - ${result.failed.length} failed`
              }
              description={
                result.failed.length === 0
                  ? 'All rows were created successfully.'
                  : 'Some rows could not be created on the server. See the list below, fix them in your CSV, and re-upload just those.'
              }
            />
            {result.failed.length > 0 && (
              <Table
                size="small"
                rowKey={(r: { index: number }) => r.index}
                dataSource={result.failed}
                pagination={false}
                scroll={{ y: 220 }}
                columns={[
                  { title: 'Row', dataIndex: 'index', width: 70, render: (i: number) => i + 1 },
                  { title: 'Name', dataIndex: 'name', ellipsis: true },
                  { title: 'Reason', dataIndex: 'error', ellipsis: true },
                ]}
              />
            )}
            <div className="flex justify-end pt-1">
              <Button type="primary" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <PinConfirmModal
        open={pinOpen}
        title="Confirm bulk import"
        description={`Enter your PIN to import ${validRows.length} team member${validRows.length === 1 ? '' : 's'}.`}
        confirmLabel={`Import ${validRows.length}`}
        submitting={submitting}
        progress={progress ?? undefined}
        onConfirmed={runImport}
        onCancel={() => setPinOpen(false)}
      />
    </>
  );
}
