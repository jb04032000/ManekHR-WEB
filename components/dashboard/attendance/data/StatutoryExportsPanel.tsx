'use client';

import { useState, useEffect } from 'react';
import { Alert, App, Form, Select, DatePicker, InputNumber, Tooltip, Space, Card } from 'antd';
import { DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs, { Dayjs } from 'dayjs';
import type { AxiosError } from 'axios';
import DsButton from '@/components/ui/DsButton';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import {
  attendanceStatutoryApi,
  StatutoryTemplate,
} from '@/lib/api/modules/attendance-statutory.api';
import { teamApi } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { parseApiError } from '@/lib/utils';
import type { TeamMember } from '@/types';

const { RangePicker } = DatePicker;

type RangeValue = [Dayjs | null, Dayjs | null] | null;

interface FormValues {
  template: StatutoryTemplate;
  range: [Dayjs, Dayjs];
  memberScope?: string[];
  customDailyRate?: number;
}

const TEMPLATE_LABELS: Record<StatutoryTemplate, string> = {
  [StatutoryTemplate.MH_FORM_T]: 'MH Form T (Shops & Establishments Muster Roll + Wages)',
  [StatutoryTemplate.FORM_25_OT]: 'Factories Act Form 25 - OT Register',
  [StatutoryTemplate.PF_ESI_WAGE]: 'PF/ESI Wage Register (Excel)',
  [StatutoryTemplate.LOP_AUDIT]: 'LOP Audit (Loss of Pay per-day)',
  [StatutoryTemplate.GJ_FORM_D]: 'GJ Form D (Gujarat S&E Act 2019 - Attendance Register)',
};

export function StatutoryExportsPanel() {
  const t = useTranslations('attendanceStatutory');
  const tx = useTranslations('attendanceStatutoryExtras');
  const { currentWorkspaceId } = useWorkspace();
  const [form] = Form.useForm<FormValues>();
  const { message: msgApi } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<StatutoryTemplate | null>(null);

  // Load active team members for optional scope picker
  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    void (async () => {
      setMembersLoading(true);
      try {
        const res = await teamApi.list(currentWorkspaceId);
        if (cancelled) return;
        const list = Array.isArray(res) ? res : ((res as { data: TeamMember[] }).data ?? []);
        setMembers(list.filter((m: TeamMember) => m.isActive !== false));
      } catch {
        // Non-critical; member filter is optional
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId]);

  // Disable future dates and enforce max 366-day range on the end picker
  const disabledDate = (current: Dayjs): boolean => {
    if (!current) return false;
    // No future dates
    if (current.isAfter(dayjs(), 'day')) return true;
    // Enforce ≤ 366 days from selected start (frontend UX - backend enforces too)
    const range = form.getFieldValue('range') as RangeValue;
    if (range && range[0] && !range[1]) {
      const start = range[0];
      if (current.isBefore(start, 'day')) return true;
      if (current.diff(start, 'day') > 365) return true;
    }
    return false;
  };

  const handleSubmit = async (values: FormValues) => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const { blob, filename, mimeType } = await attendanceStatutoryApi.generate(
        currentWorkspaceId,
        {
          template: values.template,
          from: values.range[0].format('YYYY-MM-DD'),
          to: values.range[1].format('YYYY-MM-DD'),
          memberScope: values.memberScope?.length ? values.memberScope : undefined,
          customDailyRate:
            values.template === StatutoryTemplate.FORM_25_OT ? values.customDailyRate : undefined,
        },
      );

      // Trigger browser download (T-G06-07: revoke URL immediately after click)
      const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      msgApi.success(t('alerts.downloadStarted'));
    } catch (err) {
      // Blob-wrapped error: axios gives a Blob even on 4xx when responseType:'blob'
      const axiosErr = err as AxiosError<Blob>;
      if (axiosErr.response?.data instanceof Blob) {
        const text = await axiosErr.response.data.text();
        try {
          const parsed = JSON.parse(text) as { message?: string };
          msgApi.error(parsed?.message || t('alerts.exportFailed'));
        } catch {
          msgApi.error(t('alerts.exportFailed'));
        }
      } else {
        msgApi.error(parseApiError(err) || t('alerts.exportFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureGate module="attendance" subFeature="statutory_exports" as="h1">
      <div className="mx-auto max-w-[42rem]">
        {/* InfoTooltip toolbar - preserves the DsPageHeader right={} content */}
        <div className="mb-3 flex justify-end">
          <InfoTooltip text={t('headerExplainer')} body={t('headerExplainerBody')} />
        </div>

        {/* Info alert */}
        <Alert type="info" showIcon title={t('alerts.noHistory')} className="mb-6" />

        <Card>
          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark="optional">
            {/* Template picker */}
            <Form.Item
              name="template"
              label={t('form.template')}
              rules={[{ required: true, message: 'Please select a template' }]}
            >
              <Select
                placeholder={tx('selectTemplate')}
                onChange={(val: StatutoryTemplate) => setSelectedTemplate(val)}
                options={Object.entries(TEMPLATE_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
                size="large"
              />
            </Form.Item>

            {/* Date range */}
            <Form.Item
              name="range"
              label={
                <Space size={4}>
                  {t('form.dateRange')}
                  <Tooltip title={t('tooltips.dateRange')}>
                    <InfoCircleOutlined className="cursor-help text-faint" />
                  </Tooltip>
                </Space>
              }
              rules={[{ required: true, message: 'Please select a date range' }]}
            >
              <RangePicker
                disabledDate={disabledDate}
                format="DD MMM YYYY"
                size="large"
                className="w-full"
                allowClear
              />
            </Form.Item>

            {/* Optional member scope */}
            <Form.Item
              name="memberScope"
              label={
                <Space size={4}>
                  {t('form.members')}
                  <Tooltip title={t('tooltips.members')}>
                    <InfoCircleOutlined className="cursor-help text-faint" />
                  </Tooltip>
                </Space>
              }
            >
              <Select
                mode="multiple"
                placeholder={tx('defaultAllActive')}
                loading={membersLoading}
                allowClear
                optionFilterProp="label"
                size="large"
                options={members.map((m) => ({
                  value: m.id,
                  label: m.name,
                }))}
              />
            </Form.Item>

            {/* Custom Daily Rate - only shown for OT template */}
            {selectedTemplate === StatutoryTemplate.FORM_25_OT && (
              <Form.Item
                name="customDailyRate"
                label={
                  <Space size={4}>
                    {t('form.customDailyRate')}
                    <Tooltip title={t('tooltips.customDailyRate')}>
                      <InfoCircleOutlined className="cursor-help text-faint" />
                    </Tooltip>
                  </Space>
                }
              >
                <InputNumber
                  min={0}
                  prefix="₹"
                  placeholder={tx('exampleNumber')}
                  size="large"
                  className="w-full"
                />
              </Form.Item>
            )}

            {/* Submit */}
            <Form.Item className="mt-2 !mb-0">
              <DsButton
                dsVariant="primary"
                dsSize="lg"
                icon={<DownloadOutlined />}
                htmlType="submit"
                loading={loading}
                disabled={loading}
              >
                {t('buttons.download')}
              </DsButton>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </FeatureGate>
  );
}
