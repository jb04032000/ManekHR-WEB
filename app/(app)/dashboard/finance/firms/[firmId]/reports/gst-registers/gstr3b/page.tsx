'use client';
// GSTR-3B Summary report (auto-computed from books). i18n via finance.reports
// (gstRegisters.gstr3b.*). Cross-link: header from ReportToolbar; data from financeReportsApi.gstr3b.
import { use, useState } from 'react';
import { Alert, DatePicker, Skeleton, Statistic, Row, Col } from 'antd';
import { useTranslations } from 'next-intl';
import dayjs, { Dayjs } from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import DsButton from '@/components/ui/DsButton';
import DsCard from '@/components/ui/DsCard';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';

export default function Gstr3bPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [period, setPeriod] = useState<Dayjs>(dayjs());
  const [report, setReport] = useState<any>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleRun = async () => {
    if (!ws?._id) return;
    setState('loading');
    try {
      // F-12-01: period format is MMYYYY per STATE.md decision (backend DTO enforces /^\d{6}$/)
      const data = await financeReportsApi.gstr3b(ws._id, firmId, period.format('MMYYYY'));
      setReport(data);
      setState('success');
    } catch {
      setState('error');
    }
  };

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('gstRegisters.gstr3b.title')}
        category={t('gstRegisters.gstr3b.category')}
        categoryPath="gst-registers"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <DsCard style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <DatePicker
              picker="month"
              value={period}
              onChange={(d) => d && setPeriod(d)}
              allowClear={false}
              placeholder={t('gstRegisters.gstr3b.selectPeriod')}
            />
            <DsButton dsVariant="primary" onClick={handleRun} loading={state === 'loading'}>
              {t('common.runReport')}
            </DsButton>
          </div>
        </DsCard>

        {state === 'success' && report && (
          <div>
            <Alert
              type="info"
              title={t('gstRegisters.gstr3b.computedFor', { period: period.format('MMMM YYYY') })}
              style={{ marginBottom: 16 }}
            />
            {/* 3.1 Output Tax */}
            <DsCard style={{ marginBottom: 16 }}>
              <h4 style={{ fontWeight: 700, marginBottom: 12 }}>
                {t('gstRegisters.gstr3b.section31')}
              </h4>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={t('gstRegisters.gstr3b.taxableIgst')}
                    value={fmtPaise(report.outwardSupplies?.igstTaxablePaise ?? 0)}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={t('common.igst')}
                    value={fmtPaise(report.outwardSupplies?.igstPaise ?? 0)}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={t('common.cgst')}
                    value={fmtPaise(report.outwardSupplies?.cgstPaise ?? 0)}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={t('common.sgst')}
                    value={fmtPaise(report.outwardSupplies?.sgstPaise ?? 0)}
                  />
                </Col>
              </Row>
            </DsCard>
            {/* 4 ITC */}
            <DsCard style={{ marginBottom: 16 }}>
              <h4 style={{ fontWeight: 700, marginBottom: 12 }}>
                {t('gstRegisters.gstr3b.section4')}
              </h4>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={t('gstRegisters.gstr3b.igstItc')}
                    value={fmtPaise(report.itc?.igstPaise ?? 0)}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={t('gstRegisters.gstr3b.cgstItc')}
                    value={fmtPaise(report.itc?.cgstPaise ?? 0)}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={t('gstRegisters.gstr3b.sgstItc')}
                    value={fmtPaise(report.itc?.sgstPaise ?? 0)}
                  />
                </Col>
              </Row>
            </DsCard>
            {/* Net Payable */}
            <DsCard>
              <h4 style={{ fontWeight: 700, marginBottom: 12 }}>
                {t('gstRegisters.gstr3b.netPayable')}
              </h4>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8}>
                  <Statistic
                    title={t('gstRegisters.gstr3b.igstPayable')}
                    value={fmtPaise(report.netPayable?.igstPaise ?? 0)}
                    styles={{
                      content: {
                        color:
                          (report.netPayable?.igstPaise ?? 0) > 0
                            ? 'var(--cr-error)'
                            : 'var(--cr-success)',
                      },
                    }}
                  />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic
                    title={t('gstRegisters.gstr3b.cgstPayable')}
                    value={fmtPaise(report.netPayable?.cgstPaise ?? 0)}
                    styles={{
                      content: {
                        color:
                          (report.netPayable?.cgstPaise ?? 0) > 0
                            ? 'var(--cr-error)'
                            : 'var(--cr-success)',
                      },
                    }}
                  />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic
                    title={t('gstRegisters.gstr3b.sgstPayable')}
                    value={fmtPaise(report.netPayable?.sgstPaise ?? 0)}
                    styles={{
                      content: {
                        color:
                          (report.netPayable?.sgstPaise ?? 0) > 0
                            ? 'var(--cr-error)'
                            : 'var(--cr-success)',
                      },
                    }}
                  />
                </Col>
              </Row>
            </DsCard>
          </div>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('gstRegisters.gstr3b.error')} />}
      </div>
    </div>
  );
}
