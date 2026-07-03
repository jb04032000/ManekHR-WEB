'use client';

/**
 * Wave 7 - admin Communications panel for plan-level credit-pack defaults.
 *
 * Edits the `entitlements.communications.*` slice of a Plan document. New
 * subscriptions on this plan inherit these defaults; existing subscribers
 * are not retroactively reset (admin must use the per-subscription
 * override panel).
 */

import { useEffect, useState, startTransition } from 'react';
import { Card, Switch, InputNumber, Input, Row, Col, Tag } from 'antd';
import { ThunderboltOutlined, MessageOutlined, WhatsAppOutlined } from '@ant-design/icons';
import type { PlanCommunicationsEntitlements } from '@/types';

interface Props {
  value?: PlanCommunicationsEntitlements;
  onChange: (next: PlanCommunicationsEntitlements) => void;
}

const DEFAULTS: PlanCommunicationsEntitlements = {
  smsCreditsBalance: 0,
  whatsappCreditsBalance: 0,
  autoRechargeEnabled: false,
  autoRechargeThresholdSms: 50,
  autoRechargeThresholdWhatsapp: 50,
  autoRechargeSmsPackSlug: undefined,
  autoRechargeWhatsappPackSlug: undefined,
};

export function CommunicationsEditor({ value, onChange }: Props) {
  const [local, setLocal] = useState<PlanCommunicationsEntitlements>(value ?? DEFAULTS);

  useEffect(() => {
    startTransition(() => {
      setLocal(value ?? DEFAULTS);
    });
  }, [value]);

  const patch = (p: Partial<PlanCommunicationsEntitlements>) => {
    const next = { ...local, ...p };
    setLocal(next);
    onChange(next);
  };

  return (
    <Card
      className="mb-4 rounded-2xl"
      title={<span className="font-display font-bold">Communications &amp; Credit Packs</span>}
      extra={<Tag color="blue">Plan defaults</Tag>}
    >
      <p className="m-0 mb-3 text-xs text-muted">
        Default starting balances + auto-recharge config for new subscriptions on this plan. Empty
        values inherit zero / false.
      </p>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card size="small" className="rounded-xl">
            <p className="m-0 mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <MessageOutlined /> SMS
            </p>
            <p className="m-0 mb-1 text-xs text-muted">Starting balance</p>
            <InputNumber
              className="mb-3 w-full"
              min={0}
              value={local.smsCreditsBalance ?? 0}
              onChange={(v) => typeof v === 'number' && patch({ smsCreditsBalance: v })}
            />
            <p className="m-0 mb-1 text-xs text-muted">Auto-recharge threshold</p>
            <InputNumber
              className="mb-3 w-full"
              min={0}
              max={100_000}
              value={local.autoRechargeThresholdSms ?? 50}
              onChange={(v) => typeof v === 'number' && patch({ autoRechargeThresholdSms: v })}
            />
            <p className="m-0 mb-1 text-xs text-muted">Auto-buy pack slug</p>
            <Input
              placeholder="e.g. sms-pack-500"
              value={local.autoRechargeSmsPackSlug ?? ''}
              onChange={(e) =>
                patch({
                  autoRechargeSmsPackSlug: e.target.value ? e.target.value : undefined,
                })
              }
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" className="rounded-xl">
            <p className="m-0 mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
              <WhatsAppOutlined /> WhatsApp
            </p>
            <p className="m-0 mb-1 text-xs text-muted">Starting balance</p>
            <InputNumber
              className="mb-3 w-full"
              min={0}
              value={local.whatsappCreditsBalance ?? 0}
              onChange={(v) => typeof v === 'number' && patch({ whatsappCreditsBalance: v })}
            />
            <p className="m-0 mb-1 text-xs text-muted">Auto-recharge threshold</p>
            <InputNumber
              className="mb-3 w-full"
              min={0}
              max={100_000}
              value={local.autoRechargeThresholdWhatsapp ?? 50}
              onChange={(v) => typeof v === 'number' && patch({ autoRechargeThresholdWhatsapp: v })}
            />
            <p className="m-0 mb-1 text-xs text-muted">Auto-buy pack slug</p>
            <Input
              placeholder="e.g. whatsapp-pack-500"
              value={local.autoRechargeWhatsappPackSlug ?? ''}
              onChange={(e) =>
                patch({
                  autoRechargeWhatsappPackSlug: e.target.value ? e.target.value : undefined,
                })
              }
            />
          </Card>
        </Col>
      </Row>

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
        <ThunderboltOutlined className="text-blue-700" />
        <div className="flex-1">
          <p className="m-0 text-sm font-medium text-blue-900">Default auto-recharge</p>
          <p className="m-0 text-xs text-blue-700">
            On = new subscribers start with auto-recharge active. Off = users must opt in from their
            credits dashboard.
          </p>
        </div>
        <Switch
          checked={!!local.autoRechargeEnabled}
          onChange={(checked) => patch({ autoRechargeEnabled: checked })}
        />
      </div>
    </Card>
  );
}
