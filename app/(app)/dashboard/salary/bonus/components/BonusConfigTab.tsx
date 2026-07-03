'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Form, InputNumber, Skeleton, Tooltip } from 'antd';
import { InfoCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { BonusConfig, UpdateBonusConfigPayload } from '@/types';

interface Props {
  config: BonusConfig | null;
  loading: boolean;
  saving: boolean;
  onSave: (payload: UpdateBonusConfigPayload) => void;
}

export function BonusConfigTab({ config, loading, saving, onSave }: Props) {
  const t = useTranslations('salary.bonus');
  const [form] = Form.useForm<UpdateBonusConfigPayload>();

  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        eligibilityWageCeiling: config.eligibilityWageCeiling,
        calculationWageFloor: config.calculationWageFloor,
        allocableSurplusPercent: config.allocableSurplusPercent,
        clawbackMonthsDefault: config.clawbackMonthsDefault,
        newEstablishment: config.newEstablishment,
      });
    }
  }, [config, form]);

  if (loading || !config) {
    return (
      <div className="py-4">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  return (
    <div className="py-4">
      <Alert
        title={t('configCaTitle')}
        description={t('configCaDesc')}
        type="warning"
        showIcon
        className="mb-6"
        style={{ borderRadius: 10 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => onSave(values)}
        style={{ maxWidth: 540 }}
      >
        {/* Eligibility wage ceiling */}
        <Form.Item
          name="eligibilityWageCeiling"
          label={
            <span className="flex items-center gap-1">
              {t('configEligibilityCeiling')}
              <Tooltip
                title={t('configEligibilityCeilingTooltip')}
                styles={{ root: { maxWidth: 340 } }}
              >
                <InfoCircleOutlined
                  className="text-[12px] text-subtle"
                  style={{ cursor: 'help' }}
                />
              </Tooltip>
            </span>
          }
          rules={[{ required: true, message: t('configFieldRequired') }]}
        >
          <InputNumber min={1} precision={0} prefix="Rs" style={{ width: '100%' }} />
        </Form.Item>

        {/* Calculation wage floor */}
        <Form.Item
          name="calculationWageFloor"
          label={
            <span className="flex items-center gap-1">
              {t('configCalcFloor')}
              <Tooltip title={t('configCalcFloorTooltip')} styles={{ root: { maxWidth: 340 } }}>
                <InfoCircleOutlined
                  className="text-[12px] text-subtle"
                  style={{ cursor: 'help' }}
                />
              </Tooltip>
            </span>
          }
          rules={[{ required: true, message: t('configFieldRequired') }]}
        >
          <InputNumber min={1} precision={0} prefix="Rs" style={{ width: '100%' }} />
        </Form.Item>

        {/* Allocable surplus */}
        <Form.Item
          name="allocableSurplusPercent"
          label={
            <span className="flex items-center gap-1">
              {t('configAllocableSurplus')}
              <Tooltip
                title={t('configAllocableSurplusTooltip')}
                styles={{ root: { maxWidth: 360 } }}
              >
                <InfoCircleOutlined
                  className="text-[12px] text-subtle"
                  style={{ cursor: 'help' }}
                />
              </Tooltip>
            </span>
          }
          extra={t('configAllocableSurplusHint')}
        >
          <InputNumber
            min={0}
            max={20}
            step={0.01}
            precision={2}
            suffix="%"
            style={{ width: '100%' }}
          />
        </Form.Item>

        {/* Clawback window */}
        <Form.Item
          name="clawbackMonthsDefault"
          label={
            <span className="flex items-center gap-1">
              {t('configClawback')}
              <Tooltip title={t('configClawbackTooltip')} styles={{ root: { maxWidth: 340 } }}>
                <InfoCircleOutlined
                  className="text-[12px] text-subtle"
                  style={{ cursor: 'help' }}
                />
              </Tooltip>
            </span>
          }
          extra={t('configClawbackHint')}
        >
          <InputNumber
            min={0}
            max={24}
            precision={0}
            suffix={t('monthsSuffix')}
            style={{ width: '100%' }}
          />
        </Form.Item>

        {/* New establishment toggle */}
        <Form.Item name="newEstablishment" valuePropName="checked">
          <Checkbox>
            <span className="flex items-center gap-1">
              {t('configNewEstablishment')}
              <Tooltip
                title={t('configNewEstablishmentTooltip')}
                styles={{ root: { maxWidth: 340 } }}
              >
                <InfoCircleOutlined
                  className="text-[12px] text-subtle"
                  style={{ cursor: 'help' }}
                />
              </Tooltip>
            </span>
          </Checkbox>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
            {t('configSaveBtn')}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
