'use client';

// 2f multi-GSTIN settings editor. Lets Owner/HR record the firm's additional
// state GSTIN registrations (beyond the primary gstin). Mirrors the branding /
// layout / numbering pages for RBAC gating (finance.settings.manage), page
// chrome (DsPageHeader, Can), and save/error/dirty handling.
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { App, Button, Form, Input, Result, Skeleton, Space } from 'antd';
import {
  BankOutlined,
  DeleteOutlined,
  InfoCircleFilled,
  LockOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { Can } from '@/components/rbac/Can';
import { DsPageHeader } from '@/components/ui';
import { getFirm, updateFirmGstins } from '@/lib/actions/finance.actions';
import { parseApiError } from '@/lib/utils';
import type { Firm } from '@/types';

interface GstinRow {
  gstin: string;
  stateCode: string;
  label?: string;
}

function GstinsEditor() {
  const t = useTranslations('finance.gstins');
  const { message } = App.useApp();
  const params = useParams<{ firmId: string }>();
  const firmId = params?.firmId ?? '';
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');

  const [form] = Form.useForm<{ additionalGstins: GstinRow[] }>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firmName, setFirmName] = useState('');
  const [primaryGstin, setPrimaryGstin] = useState<string>('');

  useEffect(() => {
    if (!wsId || !firmId) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setLoadError(false);
    });
    getFirm(wsId, firmId)
      .then((f: Firm) => {
        if (!active) return;
        setFirmName(f?.firmName ?? '');
        setPrimaryGstin(f?.gstin ?? '');
        form.setFieldsValue({ additionalGstins: f?.additionalGstins ?? [] });
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wsId, firmId, form]);

  const handleSave = useCallback(async () => {
    if (!wsId || !firmId) return;
    const values = form.getFieldsValue();
    const rows = (values.additionalGstins ?? [])
      .filter((r) => r && r.gstin)
      .map((r) => ({
        gstin: r.gstin.trim().toUpperCase(),
        stateCode: r.gstin.trim().slice(0, 2),
        label: r.label?.trim() || undefined,
      }));
    setSaving(true);
    try {
      const updated = await updateFirmGstins(wsId, firmId, rows);
      form.setFieldsValue({ additionalGstins: updated?.additionalGstins ?? [] });
      message.success(t('saveSuccess'));
    } catch (error) {
      message.error(parseApiError(error) || t('saveError'));
    } finally {
      setSaving(false);
    }
  }, [wsId, firmId, form, message, t]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
        <Skeleton active paragraph={{ rows: 3 }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <Result
          status="warning"
          title={t('loadErrorTitle')}
          subTitle={t('loadErrorSubtitle')}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              {t('retry')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <DsPageHeader
        icon={<BankOutlined />}
        title={t('pageTitle')}
        sub={firmName ? t('pageDescriptionNamed', { firm: firmName }) : t('pageDescription')}
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <InfoCircleFilled
          style={{ color: 'var(--cr-info-500)', fontSize: 14, marginTop: 2, flexShrink: 0 }}
        />
        <p className="m-0 text-[12px] leading-relaxed text-blue-700">{t('introBanner')}</p>
      </div>

      {primaryGstin && (
        <div className="mb-5 rounded-xl border border-[var(--cr-border-light)] px-4 py-3">
          <p className="m-0 text-xs text-subtle">{t('primaryLabel')}</p>
          <p className="m-0 mt-0.5 font-mono text-sm text-heading">{primaryGstin}</p>
        </div>
      )}

      <Form form={form} layout="vertical" autoComplete="off">
        <Form.List name="additionalGstins">
          {(fields, { add, remove }) => (
            <div className="space-y-3">
              {fields.map(({ key, name, ...rest }) => (
                <Space key={key} align="baseline" wrap>
                  <Form.Item
                    {...rest}
                    name={[name, 'gstin']}
                    rules={[
                      { required: true, message: t('gstinRequired') },
                      {
                        pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/,
                        message: t('gstinInvalid'),
                      },
                    ]}
                    style={{ minWidth: 240 }}
                  >
                    <Input
                      placeholder={t('gstinPlaceholder')}
                      maxLength={15}
                      style={{ textTransform: 'uppercase' }}
                    />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'label']} style={{ minWidth: 200 }}>
                    <Input placeholder={t('labelPlaceholder')} />
                  </Form.Item>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => remove(name)}
                    aria-label={t('remove')}
                  />
                </Space>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()}>
                {t('addRow')}
              </Button>
            </div>
          )}
        </Form.List>
      </Form>

      <div className="mt-6 flex items-center gap-3 border-t border-[var(--cr-border-light)] pt-5">
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          {t('save')}
        </Button>
      </div>
    </div>
  );
}

function ManagersOnly() {
  const t = useTranslations('finance.gstins');
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
      <Result
        icon={<LockOutlined style={{ color: 'var(--cr-text-4)' }} />}
        title={t('noAccessTitle')}
        subTitle={t('noAccessSubtitle')}
      />
    </div>
  );
}

export default function FirmGstinsSettingsPage() {
  return (
    <Can
      path="finance.settings.manage"
      scope="all"
      fallback={<ManagersOnly />}
      showFallbackOnLoading
    >
      <GstinsEditor />
    </Can>
  );
}
