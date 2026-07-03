'use client';

import { startTransition, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Form,
  Switch,
  TimePicker,
  Input,
  InputNumber,
  Card,
  Alert,
  Skeleton,
  Spin,
  Divider,
  Row,
  Col,
  Button,
  message,
} from 'antd';
import { SaveOutlined, ThunderboltOutlined, SettingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import { remindersApi } from '@/lib/api/modules/finance-reminders.api';
import { updateReminderSettings } from '@/lib/actions/finance-reminders.actions';
import type { ReminderSettings } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function ReminderSettingsPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.reminders');
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const entitlements = useSubscriptionStore((s) => s.entitlements);
  const remindersAccess = useFeatureAccess('reminders');

  const comms = (entitlements as any)?.communications ?? {};
  const smsBalance: number = comms.smsCreditsBalance ?? 0;
  const whatsappBalance: number = comms.whatsappCreditsBalance ?? 0;
  // Communication-credits feature hidden for this phase (owner decision
  // 2026-06-25): the "credits running low / Buy credits" alert below points at
  // the hidden Credits page, so gate it off. Flip to true to restore it as-is.
  const CREDITS_FEATURE_ENABLED = false as boolean;

  const [form] = Form.useForm();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workspaceId || !isHydrated || !firmId || remindersAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
    });
    remindersApi
      .getSettings(workspaceId, firmId)
      .then((s) => {
        setSettings(s);
        form.setFieldsValue({
          enabled: s.enabled,
          dispatchTime: s.dispatchTime ? dayjs(s.dispatchTime, 'HH:mm') : dayjs('08:00', 'HH:mm'),
          fromName: s.fromName ?? '',
          minimumOutstanding: (s.minimumOutstandingPaise ?? 0) / 100,
          maxRemindersPerDay: s.maxRemindersPerDay ?? 50,
          defaultChannelInApp: s.defaultChannelInApp,
          defaultChannelEmail: s.defaultChannelEmail,
          defaultChannelSms: s.defaultChannelSms,
          defaultChannelPush: s.defaultChannelPush,
          defaultChannelWhatsApp: s.defaultChannelWhatsApp,
        });
      })
      .catch(() => message.error(t('settings.loadFailed')))
      .finally(() => setLoading(false));
  }, [workspaceId, isHydrated, firmId, form, remindersAccess.isLocked, t]);

  const onSave = async (vals: Record<string, unknown>) => {
    if (!workspaceId || !firmId) return;
    setSaving(true);
    try {
      const dispatchTimeStr = vals.dispatchTime
        ? (vals.dispatchTime as dayjs.Dayjs).format('HH:mm')
        : '08:00';
      await updateReminderSettings(workspaceId, firmId, {
        enabled: vals.enabled as boolean,
        dispatchTime: dispatchTimeStr,
        fromName: vals.fromName as string,
        minimumOutstandingPaise: Math.round((vals.minimumOutstanding as number) * 100),
        maxRemindersPerDay: vals.maxRemindersPerDay as number,
        defaultChannelInApp: vals.defaultChannelInApp as boolean,
        defaultChannelEmail: vals.defaultChannelEmail as boolean,
        defaultChannelSms: vals.defaultChannelSms as boolean,
        defaultChannelPush: vals.defaultChannelPush as boolean,
        defaultChannelWhatsApp: vals.defaultChannelWhatsApp as boolean,
      });
      message.success(t('settings.saved'));
    } catch {
      message.error(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (remindersAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (remindersAccess.isLocked) {
    return <ModuleLockedPage module="reminders" />;
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <DsPageHeader
        title={t('settings.title')}
        sub={t('settings.subtitle')}
        icon={<SettingOutlined />}
        style={{ marginBottom: 24 }}
      />

      <Form form={form} layout="vertical" onFinish={onSave}>
        <Card style={{ marginBottom: 16 }}>
          <Form.Item name="enabled" label={t('settings.enableReminders')} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="dispatchTime" label={t('settings.dispatchTime')}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} minuteStep={15} />
              </Form.Item>
              <Alert
                type="info"
                showIcon={false}
                title={
                  <span style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>
                    {t('settings.dispatchNote')}
                  </span>
                }
                style={{
                  marginBottom: 0,
                  padding: '6px 10px',
                  background: 'var(--cr-indigo-50)',
                  border: '1px solid var(--cr-indigo-200)',
                }}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="fromName" label={t('settings.fromName')}>
                <Input placeholder={t('settings.fromNamePlaceholder')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="minimumOutstanding"
                label={t('settings.minimumOutstanding')}
                extra={t('settings.minimumOutstandingExtra')}
              >
                <InputNumber min={0} prefix="₹" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="maxRemindersPerDay"
                label={t('settings.maxRemindersPerDay')}
                extra={t('settings.maxRemindersExtra')}
              >
                <InputNumber min={1} max={500} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card
          title={t('settings.defaultChannels')}
          extra={
            <span style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>
              {t('settings.overridesNote')}
            </span>
          }
          style={{ marginBottom: 16 }}
        >
          <Form.Item
            name="defaultChannelInApp"
            label={t('settings.channelInApp')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="defaultChannelEmail"
            label={t('settings.channelEmail')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider style={{ margin: '8px 0' }} />

          <Form.Item
            name="defaultChannelSms"
            label={t('settings.channelSms')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Alert
            type="warning"
            showIcon
            title={t('settings.smsWarningTitle')}
            description={t('settings.smsWarningBody')}
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="defaultChannelPush"
            label={t('settings.channelPush')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Alert
            type="warning"
            showIcon
            title={t('settings.pushWarningTitle')}
            description={t('settings.pushWarningBody')}
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="defaultChannelWhatsApp"
            label={t('settings.channelWhatsApp')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Alert
            type="warning"
            showIcon
            title={t('settings.whatsAppWarningTitle')}
            description={t('settings.whatsAppWarningBody')}
            style={{ marginBottom: 16 }}
          />

          {/* Wave 8.1 - credits-balance CTA. Surface "Buy Credits" link
              alongside DLT/AiSensy warnings so users hit it at the
              channel-config decision point. */}
          {CREDITS_FEATURE_ENABLED && (smsBalance < 10 || whatsappBalance < 5) && (
            <Alert
              type="info"
              showIcon
              icon={<ThunderboltOutlined />}
              title={t('settings.creditsTitle')}
              description={
                <span>
                  {t('settings.creditsBalance')}{' '}
                  <strong>SMS {smsBalance.toLocaleString('en-IN')}</strong> ·{' '}
                  <strong>WhatsApp {whatsappBalance.toLocaleString('en-IN')}</strong>.{' '}
                  {t('settings.creditsTopUp')}{' '}
                  <Link href="/account/subscription/credits" style={{ fontWeight: 600 }}>
                    {t('settings.buyCredits')}
                  </Link>
                </span>
              }
              style={{ marginBottom: 0 }}
            />
          )}
        </Card>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
            {t('settings.saveSettings')}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
