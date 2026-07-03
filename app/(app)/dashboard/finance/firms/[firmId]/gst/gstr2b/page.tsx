'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { DatePicker, Spin, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { reconcileGstr2bData } from '@/lib/actions/finance/gst.actions';
import DsButton from '@/components/ui/DsButton';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import Gstr2bWorksheet from '@/components/finance/gst/gstr2b/Gstr2bWorksheet';
import type { Gstr2bReconResult } from '@/components/finance/gst/gstr2b/types';

/**
 * GSTR-2B reconciliation page. Upload the GSTN GSTR-2B JSON for a tax period; the
 * backend matches it against posted purchase bills and returns a 4-bucket result
 * rendered by Gstr2bWorksheet. Cross-link: reconcileGstr2bData -> BE POST /gstr2b/reconcile.
 * Watch: parsing happens server-side; here we only read the file text + JSON.parse it.
 */
export default function Gstr2bPage() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const gstAccess = useFeatureAccess('gst_compliance');
  const t = useTranslations('finance.gstr2b');

  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs().subtract(1, 'month'));
  const period = selectedMonth.format('MMYYYY');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Gstr2bReconResult | null>(null);
  const [fileName, setFileName] = useState<string>('');

  async function runReconcile(twoB: Record<string, unknown>, name: string) {
    if (!wsId || !firmId) return;
    setLoading(true);
    try {
      const res = await reconcileGstr2bData(wsId, firmId, period, twoB);
      setResult(res);
      setFileName(name);
      message.success(t('toast.done', { matched: res.summary.matched, total: res.twoBRows }));
    } catch {
      message.error(t('toast.error'));
    } finally {
      setLoading(false);
    }
  }

  // beforeUpload returns false so AntD never POSTs the file itself; we read the text,
  // JSON.parse it, and hand the object to the server action.
  const uploadProps: UploadProps = {
    accept: '.json,application/json',
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          void runReconcile(parsed, file.name);
        } catch {
          message.error(t('toast.parseError'));
        }
      };
      reader.onerror = () => message.error(t('toast.parseError'));
      reader.readAsText(file);
      return false;
    },
  };

  if (gstAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (gstAccess.isLocked) {
    return <ModuleLockedPage module="gst_compliance" />;
  }

  return (
    <div className="p-lg">
      {/* Header - matches the canonical finance page title pattern */}
      <div className="mb-md flex flex-wrap items-center justify-between gap-sm">
        <div>
          <h1 className="m-0 font-display text-[20px] leading-[1.25] font-semibold text-heading">
            {t('title')}
          </h1>
          <p className="m-0 mt-xs text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={(val) => val && setSelectedMonth(val)}
            format="MMM YYYY"
            allowClear={false}
            style={{ width: 140 }}
          />
          {result && (
            <Upload {...uploadProps}>
              <DsButton dsVariant="secondary" loading={loading}>
                {t('reupload')}
              </DsButton>
            </Upload>
          )}
        </div>
      </div>

      {loading && !result ? (
        <div className="flex items-center justify-center" style={{ minHeight: 360 }}>
          <Spin tip={t('matching')} size="large" />
        </div>
      ) : !result ? (
        /* Empty state: dropzone */
        <div
          className="rounded-xl p-xl"
          style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
        >
          <Upload.Dragger {...uploadProps} disabled={loading} style={{ background: 'transparent' }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: 'var(--cr-primary, var(--cr-primary-600))' }} />
            </p>
            <p className="ant-upload-text" style={{ fontWeight: 600 }}>
              {t('dropzone.title', { period: selectedMonth.format('MMM YYYY') })}
            </p>
            <p className="ant-upload-hint" style={{ color: 'var(--cr-text-3)' }}>
              {t('dropzone.hint')}
            </p>
          </Upload.Dragger>
          <p className="mt-md text-center text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('dropzone.help')}
          </p>
        </div>
      ) : (
        <>
          <div
            className="mb-md flex items-center gap-sm text-[13px]"
            style={{ color: 'var(--cr-text-3)' }}
          >
            <span>
              {t('context', {
                file: fileName,
                twoB: result.twoBRows,
                bills: result.billsInPeriod,
              })}
            </span>
          </div>
          <Gstr2bWorksheet result={result} />
        </>
      )}
    </div>
  );
}
