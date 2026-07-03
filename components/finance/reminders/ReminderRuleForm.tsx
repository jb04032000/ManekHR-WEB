'use client';

import { Form, Input, InputNumber, Select, Switch, Card, Button, Row, Col, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createReminderRule, updateReminderRule } from '@/lib/actions/finance-reminders.actions';
import type { ReminderRule } from '@/types';

const { TextArea } = Input;
const { Option } = Select;

interface Props {
  wsId: string;
  firmId: string;
  initialValues?: Partial<ReminderRule>;
  ruleId?: string;
  parties: { _id: string; name: string }[];
  onSuccess: () => void;
}

// Trigger-type value -> finance.reminders.ruleForm.triggerLabel i18n key.
const TRIGGER_TYPE_I18N: Record<string, string> = {
  invoice_overdue: 'invoiceOverdue',
  invoice_due_soon: 'invoiceDueSoon',
  service_maintenance: 'serviceMaintenance',
};

// Escalation level -> finance.reminders.ruleForm.escalation i18n key.
const ESCALATION_I18N: Record<number, string> = {
  1: 'level1',
  2: 'level2',
  3: 'level3',
};

export function ReminderRuleForm({
  wsId,
  firmId,
  initialValues,
  ruleId,
  parties,
  onSuccess,
}: Props) {
  const t = useTranslations('finance.reminders');
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(ruleId);

  const onFinish = async (vals: Record<string, unknown>) => {
    setSaving(true);
    try {
      const dto = {
        name: vals.name as string,
        description: vals.description as string | undefined,
        triggerType: vals.triggerType as
          | 'invoice_overdue'
          | 'invoice_due_soon'
          | 'service_maintenance',
        daysOffset: vals.daysOffset as number,
        escalationLevel: vals.escalationLevel as 1 | 2 | 3,
        cooldownHours: vals.cooldownHours as number,
        partyId: (vals.partyId === '__global__' ? undefined : vals.partyId) as string | undefined,
        channelInApp: vals.channelInApp as boolean,
        channelEmail: vals.channelEmail as boolean,
        channelSms: vals.channelSms as boolean,
        channelPush: vals.channelPush as boolean,
        channelWhatsApp: vals.channelWhatsApp as boolean,
        emailTemplateKey: vals.emailTemplateKey as string | undefined,
        smsTemplateKey: vals.smsTemplateKey as string | undefined,
        whatsAppCampaignName: vals.whatsAppCampaignName as string | undefined,
        priority: vals.priority as number,
        isActive: vals.isActive as boolean,
      };

      if (isEdit && ruleId) {
        await updateReminderRule(wsId, firmId, ruleId, dto);
        message.success(t('ruleForm.ruleUpdated'));
      } else {
        await createReminderRule(wsId, firmId, dto);
        message.success(t('ruleForm.ruleCreated'));
      }
      onSuccess();
    } catch {
      message.error(isEdit ? t('ruleForm.updateFailed') : t('ruleForm.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const initial = {
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    triggerType: initialValues?.triggerType ?? 'invoice_overdue',
    daysOffset: initialValues?.daysOffset ?? 1,
    escalationLevel: initialValues?.escalationLevel ?? 1,
    cooldownHours: initialValues?.cooldownHours ?? 24,
    partyId: initialValues?.partyId ?? '__global__',
    channelInApp: initialValues?.channelInApp ?? true,
    channelEmail: initialValues?.channelEmail ?? true,
    channelSms: initialValues?.channelSms ?? false,
    channelPush: initialValues?.channelPush ?? false,
    channelWhatsApp: initialValues?.channelWhatsApp ?? false,
    emailTemplateKey: initialValues?.emailTemplateKey ?? '',
    smsTemplateKey: initialValues?.smsTemplateKey ?? '',
    whatsAppCampaignName: initialValues?.whatsAppCampaignName ?? '',
    priority: initialValues?.priority ?? 0,
    isActive: initialValues?.isActive ?? true,
  };

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} initialValues={initial}>
      <Card title={t('ruleForm.basicInfo')} style={{ marginBottom: 16 }}>
        <Form.Item
          name="name"
          label={t('ruleForm.ruleName')}
          rules={[
            { required: true, message: t('ruleForm.nameRequired') },
            { max: 100, message: t('ruleForm.maxChars') },
          ]}
        >
          <Input placeholder={t('ruleForm.ruleNamePlaceholder')} />
        </Form.Item>

        <Form.Item name="description" label={t('ruleForm.description')}>
          <TextArea rows={2} maxLength={500} placeholder={t('ruleForm.descriptionPlaceholder')} />
        </Form.Item>
      </Card>

      <Card title={t('ruleForm.triggerConfig')} style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="triggerType"
              label={t('ruleForm.triggerType')}
              rules={[{ required: true }]}
            >
              <Select>
                {Object.entries(TRIGGER_TYPE_I18N).map(([val, key]) => (
                  <Option key={val} value={val}>
                    {t(`ruleForm.triggerLabel.${key}` as Parameters<typeof t>[0])}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="daysOffset"
              label={t('ruleForm.daysOffset')}
              extra={t('ruleForm.daysOffsetExtra')}
              rules={[{ required: true, type: 'number' }]}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="escalationLevel"
              label={t('ruleForm.escalationLevel')}
              rules={[{ required: true }]}
            >
              <Select>
                {Object.entries(ESCALATION_I18N).map(([val, key]) => (
                  <Option key={val} value={Number(val)}>
                    {t(`ruleForm.escalation.${key}` as Parameters<typeof t>[0])}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="cooldownHours"
              label={t('ruleForm.cooldownHours')}
              extra={t('ruleForm.cooldownExtra')}
              rules={[{ required: true, type: 'number', min: 1 }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="partyId" label={t('common.party')} extra={t('ruleForm.partyExtra')}>
          <Select showSearch optionFilterProp="children">
            <Option value="__global__">{t('ruleForm.globalRule')}</Option>
            {parties.map((p) => (
              <Option key={p._id} value={p._id}>
                {p.name}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Card>

      <Card title={t('ruleForm.channels')} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 0]}>
          <Col xs={12} sm={8}>
            <Form.Item
              name="channelInApp"
              label={t('ruleForm.channelInApp')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item
              name="channelEmail"
              label={t('ruleForm.channelEmail')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="channelSms" label={t('ruleForm.channelSms')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="channelPush" label={t('ruleForm.channelPush')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item
              name="channelWhatsApp"
              label={t('ruleForm.channelWhatsApp')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card title={t('ruleForm.templateOverrides')} style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="emailTemplateKey" label={t('ruleForm.emailTemplateKey')}>
              <Input placeholder={t('ruleForm.emailTemplatePlaceholder')} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="smsTemplateKey" label={t('ruleForm.smsTemplateKey')}>
              <Input placeholder={t('ruleForm.smsTemplatePlaceholder')} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="whatsAppCampaignName" label={t('ruleForm.whatsAppCampaignName')}>
              <Input placeholder={t('ruleForm.whatsAppCampaignPlaceholder')} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card title={t('ruleForm.priorityStatus')} style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="priority"
              label={t('ruleForm.priority')}
              extra={t('ruleForm.priorityExtra')}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="isActive" label={t('ruleForm.active')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
          {isEdit ? t('ruleForm.updateRule') : t('ruleForm.createRule')}
        </Button>
      </Form.Item>
    </Form>
  );
}
