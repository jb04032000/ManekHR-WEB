'use client';
import { useMemo, useState } from 'react';
import { Drawer, Button, Empty, Table, Tag, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { InboxOutlined, FileSearchOutlined } from '@ant-design/icons';

type Finding = {
  file: string;
  line: number;
  kind: 'jsx-text' | 'jsx-attr';
  attr?: string;
  snippet: string;
};

type ReportFile = {
  generatedAt?: string;
  findings: Finding[];
};

type Props = {
  buttonProps?: { label?: string; size?: 'small' | 'middle' | 'large' };
};

export function HardcodedReportPanel({ buttonProps }: Props) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<ReportFile | null>(null);
  const [msg, ctx] = message.useMessage();

  const summary = useMemo(() => {
    if (!report) return null;
    const byFile = new Map<string, number>();
    const byKind: Record<string, number> = {};
    for (const f of report.findings) {
      byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
      byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
    }
    const top = Array.from(byFile, ([file, count]) => ({ file, count })).sort(
      (a, b) => b.count - a.count,
    );
    return { total: report.findings.length, byKind, top };
  }, [report]);

  const handleUpload: UploadProps['beforeUpload'] = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ReportFile;
        if (!Array.isArray(parsed.findings)) throw new Error('not a valid report');
        setReport(parsed);
        msg.success(`Loaded ${parsed.findings.length} findings`);
      } catch (e) {
        msg.error(`Invalid report JSON${e instanceof Error ? `: ${e.message}` : ''}`);
      }
    };
    reader.readAsText(file);
    return false;
  };

  return (
    <>
      {ctx}
      <Button
        icon={<FileSearchOutlined />}
        size={buttonProps?.size ?? 'middle'}
        onClick={() => setOpen(true)}
      >
        {buttonProps?.label ?? 'Hardcoded report'}
      </Button>

      <Drawer
        title="Hardcoded i18n report"
        placement="right"
        width={720}
        open={open}
        onClose={() => setOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border bg-surface px-4 py-3 text-[12px] text-subtle">
            Run{' '}
            <code className="rounded bg-[var(--cr-surface-2,var(--cr-bg))] px-1 py-0.5 font-mono text-[11px]">
              pnpm detect:hardcoded-i18n -- --report-file .tmp/hardcoded.json
            </code>{' '}
            in <span className="font-mono">crewroster-web</span>, then upload the resulting JSON
            below to drill into findings by file. Phase 1A scaffold; Phase 1C migrates these strings
            to i18n keys.
          </div>

          <Upload.Dragger
            multiple={false}
            beforeUpload={handleUpload}
            maxCount={1}
            accept="application/json,.json"
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Drop hardcoded.json here, or click</p>
            <p className="ant-upload-hint text-[11px]">
              Output of <code>detect:hardcoded-i18n --report-file</code>
            </p>
          </Upload.Dragger>

          {report && summary && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Tag color="blue" className="text-[12px]">
                  {summary.total} findings
                </Tag>
                {Object.entries(summary.byKind).map(([k, n]) => (
                  <Tag key={k} className="text-[11px]">
                    {k}: {n}
                  </Tag>
                ))}
                {report.generatedAt && (
                  <span className="text-[11px] text-subtle">
                    {new Date(report.generatedAt).toLocaleString()}
                  </span>
                )}
              </div>

              <Table
                size="small"
                pagination={{ pageSize: 25, showSizeChanger: false }}
                rowKey={(r) => r.file}
                dataSource={summary.top}
                columns={[
                  { title: 'File', dataIndex: 'file', key: 'file' },
                  {
                    title: 'Findings',
                    dataIndex: 'count',
                    key: 'count',
                    width: 110,
                    align: 'right',
                    render: (v: number) => <span className="font-mono tabular-nums">{v}</span>,
                  },
                ]}
              />
            </div>
          )}

          {!report && (
            <Empty
              description="Upload a hardcoded report JSON to view drilldown"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
      </Drawer>
    </>
  );
}
