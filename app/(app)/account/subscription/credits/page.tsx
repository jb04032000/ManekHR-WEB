'use client';

/**
 * Wave 7 - Credits dashboard. Shows SMS / WhatsApp balances, credit packs
 * available for purchase, auto-recharge config, and recent credit-pack
 * purchase history.
 */

import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Tag,
  Spin,
  Empty,
  Switch,
  InputNumber,
  Select,
  Tooltip,
  Statistic,
  message,
} from 'antd';
import {
  MessageOutlined,
  WhatsAppOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  ReloadOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getAvailableAddOns,
  getCreditPackHistory,
  updateAutoRechargeConfig,
  type CreditPackPaymentRecord,
} from '@/lib/actions/add-ons.actions';
import { getMySubscription } from '@/lib/actions';
import {
  purchaseCreditPack,
  CheckoutDismissedError,
  CheckoutFailedError,
} from '@/components/billing/credit-pack-checkout';
import { useSubscriptionStore } from '@/lib/store';
import { parseApiError } from '@/lib/utils';
import type { AddOnDefinition } from '@/types';
import {
  PaymentsComingSoonAlert,
  usePaymentsGate,
} from '@/components/subscription/PaymentsComingSoon';

type Channel = 'sms' | 'whatsapp';

interface CommunicationsState {
  smsCreditsBalance: number;
  whatsappCreditsBalance: number;
  autoRechargeEnabled: boolean;
  autoRechargeThresholdSms: number;
  autoRechargeThresholdWhatsapp: number;
  autoRechargeSmsPackSlug?: string;
  autoRechargeWhatsappPackSlug?: string;
  lifetimeTrialGranted?: boolean;
}

const DEFAULT_COMMS: CommunicationsState = {
  smsCreditsBalance: 0,
  whatsappCreditsBalance: 0,
  autoRechargeEnabled: false,
  autoRechargeThresholdSms: 50,
  autoRechargeThresholdWhatsapp: 50,
  autoRechargeSmsPackSlug: undefined,
  autoRechargeWhatsappPackSlug: undefined,
  lifetimeTrialGranted: false,
};

function readComms(entitlements: any): CommunicationsState {
  const c = entitlements?.communications ?? {};
  return {
    smsCreditsBalance: c.smsCreditsBalance ?? 0,
    whatsappCreditsBalance: c.whatsappCreditsBalance ?? 0,
    autoRechargeEnabled: !!c.autoRechargeEnabled,
    autoRechargeThresholdSms: c.autoRechargeThresholdSms ?? 50,
    autoRechargeThresholdWhatsapp: c.autoRechargeThresholdWhatsapp ?? 50,
    autoRechargeSmsPackSlug: c.autoRechargeSmsPackSlug,
    autoRechargeWhatsappPackSlug: c.autoRechargeWhatsappPackSlug,
    lifetimeTrialGranted: !!c.lifetimeTrialGranted,
  };
}

function isCreditPack(addOn: AddOnDefinition): boolean {
  return (addOn as any).type === 'credit_pack';
}

function packChannel(addOn: AddOnDefinition): Channel | null {
  const sms = (addOn as any).entitlementDelta?.creditsDelta?.sms ?? 0;
  const wa = (addOn as any).entitlementDelta?.creditsDelta?.whatsapp ?? 0;
  if (sms > 0 && wa === 0) return 'sms';
  if (wa > 0 && sms === 0) return 'whatsapp';
  return null;
}

function packCredits(addOn: AddOnDefinition, channel: Channel): number {
  const cd = (addOn as any).entitlementDelta?.creditsDelta ?? {};
  return channel === 'sms' ? (cd.sms ?? 0) : (cd.whatsapp ?? 0);
}

export default function CreditsPage() {
  const [packs, setPacks] = useState<AddOnDefinition[]>([]);
  const [history, setHistory] = useState<CreditPackPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);
  const [comms, setComms] = useState<CommunicationsState>(DEFAULT_COMMS);
  const [msgApi, ctx] = message.useMessage();
  const setSubscription = useSubscriptionStore((s) => s.setSubscription);
  const setEntitlements = useSubscriptionStore((s) => s.setEntitlements);

  const refresh = useCallback(async () => {
    const [addOns, hist, subData] = await Promise.all([
      getAvailableAddOns().catch(() => []),
      getCreditPackHistory().catch(() => []),
      getMySubscription().catch(() => null),
    ]);
    startTransition(() => {
      setPacks((Array.isArray(addOns) ? addOns : []).filter(isCreditPack));
      setHistory(Array.isArray(hist) ? hist : []);
    });
    if (subData) {
      setSubscription((subData as any).subscription ?? null);
      if ((subData as any).entitlements) {
        setEntitlements((subData as any).entitlements);
      }
    }
    const ent =
      (subData as any)?.entitlements ?? (subData as any)?.subscription?.appliedEntitlements ?? null;
    startTransition(() => {
      setComms(readComms(ent));
    });
  }, [setSubscription, setEntitlements]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const smsPacks = useMemo(() => packs.filter((p) => packChannel(p) === 'sms'), [packs]);
  const whatsappPacks = useMemo(() => packs.filter((p) => packChannel(p) === 'whatsapp'), [packs]);

  // Coming-soon gate for credit-pack top-up (online payments not live yet -
  // env.paymentsEnabled defaults off). Viewing balances + history stays live.
  const { guard } = usePaymentsGate();

  const handleBuy = (addOn: AddOnDefinition) => {
    guard(async () => {
      setPurchasingId(addOn._id);
      try {
        const result = await purchaseCreditPack({
          addOnDefinitionId: addOn._id,
          quantity: 1,
          packName: addOn.name,
        });
        msgApi.success(
          `Credits added. SMS: ${result.smsBalance} · WhatsApp: ${result.whatsappBalance}`,
        );
        await refresh();
      } catch (e) {
        if (e instanceof CheckoutDismissedError) {
          msgApi.info('Checkout cancelled.');
        } else if (e instanceof CheckoutFailedError) {
          msgApi.error('Payment failed. Try again or pick another method.');
        } else {
          msgApi.error(parseApiError(e));
        }
      } finally {
        setPurchasingId(null);
      }
    });
  };

  const patchAuto = async (patch: Partial<CommunicationsState>) => {
    setSavingAuto(true);
    try {
      const updated = await updateAutoRechargeConfig(patch as any);
      setComms((prev) => ({ ...prev, ...readComms({ communications: updated.communications }) }));
      msgApi.success('Auto-recharge updated');
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSavingAuto(false);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-15">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      {ctx}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="m-0 mb-1 font-display text-xl font-bold text-heading">Credits</h2>
            <p className="m-0 text-sm text-muted">
              Pre-paid SMS &amp; WhatsApp balances. Top up packs and configure auto-recharge.
            </p>
            <p className="m-0 mt-1 text-xs text-subtle">
              1 credit = 1 SMS up to 160 EN / 70 HI chars. Longer messages cost 2–3 credits per
              send. WhatsApp: 1 credit per 24-hour conversation window per peer.
            </p>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => refresh()}>
            Refresh
          </Button>
        </div>

        <PaymentsComingSoonAlert />

        {/* Wave 8 - Free-tier trial banner. Shown once until first top-up. */}
        {comms.lifetimeTrialGranted &&
          (comms.smsCreditsBalance > 0 || comms.whatsappCreditsBalance > 0) &&
          history.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-2xl">🎁</span>
              <div className="flex-1">
                <p className="m-0 font-semibold text-amber-900">Free trial credits active</p>
                <p className="m-0 text-xs text-amber-800">
                  10 SMS + 5 WhatsApp credits granted on signup. Top up a pack once you&apos;ve used
                  them - packs never expire.
                </p>
              </div>
            </div>
          )}

        {/* Balances */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card className="rounded-2xl border-blue-200 bg-blue-50/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Statistic
                    title={
                      <span className="flex items-center gap-2 font-semibold text-blue-700">
                        <MessageOutlined /> SMS Credits
                      </span>
                    }
                    value={comms.smsCreditsBalance}
                    suffix="left"
                  />
                  <p className="m-0 mt-2 text-xs text-muted">
                    Each SMS reminder consumes 1 credit. Provider: MSG91 (DLT-templated).
                  </p>
                </div>
                <Button
                  type="primary"
                  icon={<ShoppingOutlined />}
                  onClick={() => scrollToSection('sms-packs-section')}
                  disabled={smsPacks.length === 0}
                >
                  Buy SMS Credits
                </Button>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card className="rounded-2xl border-green-200 bg-green-50/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Statistic
                    title={
                      <span className="flex items-center gap-2 font-semibold text-green-700">
                        <WhatsAppOutlined /> WhatsApp Credits
                      </span>
                    }
                    value={comms.whatsappCreditsBalance}
                    suffix="left"
                  />
                  <p className="m-0 mt-2 text-xs text-muted">
                    Each WhatsApp reminder consumes 1 credit. Provider: AiSensy BSP.
                  </p>
                </div>
                <Button
                  type="primary"
                  icon={<ShoppingOutlined />}
                  style={{
                    background: 'var(--cr-success-700)',
                    borderColor: 'var(--cr-success-700)',
                  }}
                  onClick={() => scrollToSection('whatsapp-packs-section')}
                  disabled={whatsappPacks.length === 0}
                >
                  Buy WhatsApp Credits
                </Button>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Top up - SMS */}
        <Card
          id="sms-packs-section"
          className="rounded-2xl"
          title={
            <span className="font-display text-base font-bold">
              <MessageOutlined className="mr-2" />
              SMS Packs
            </span>
          }
        >
          {smsPacks.length === 0 ? (
            <Empty description="No SMS packs available - admin needs to seed defaults (set SEED_DEFAULTS_ON_BOOTSTRAP=true on backend boot)" />
          ) : (
            <Row gutter={[16, 16]}>
              {smsPacks.map((p) => (
                <PackCard
                  key={p._id}
                  pack={p}
                  channel="sms"
                  loading={purchasingId === p._id}
                  onBuy={() => handleBuy(p)}
                />
              ))}
            </Row>
          )}
        </Card>

        {/* Top up - WhatsApp */}
        <Card
          id="whatsapp-packs-section"
          className="rounded-2xl"
          title={
            <span className="font-display text-base font-bold">
              <WhatsAppOutlined className="mr-2" />
              WhatsApp Packs
            </span>
          }
        >
          {whatsappPacks.length === 0 ? (
            <Empty description="No WhatsApp packs available - admin needs to seed defaults (set SEED_DEFAULTS_ON_BOOTSTRAP=true on backend boot)" />
          ) : (
            <Row gutter={[16, 16]}>
              {whatsappPacks.map((p) => (
                <PackCard
                  key={p._id}
                  pack={p}
                  channel="whatsapp"
                  loading={purchasingId === p._id}
                  onBuy={() => handleBuy(p)}
                />
              ))}
            </Row>
          )}
        </Card>

        {/* Auto-recharge */}
        <Card
          className="rounded-2xl"
          title={
            <span className="font-display text-base font-bold">
              <ThunderboltOutlined className="mr-2" />
              Auto-Recharge
            </span>
          }
          extra={
            <Switch
              checked={comms.autoRechargeEnabled}
              loading={savingAuto}
              aria-label="Enable auto-recharge"
              onChange={(checked) => patchAuto({ autoRechargeEnabled: checked })}
            />
          }
        >
          <p className="m-0 mb-3 text-sm text-muted">
            When a balance falls below the threshold, the configured pack auto-purchases. Skips
            low-balance email alerts when on.
          </p>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <ChannelAutoRecharge
                label="SMS"
                threshold={comms.autoRechargeThresholdSms}
                packSlug={comms.autoRechargeSmsPackSlug}
                packs={smsPacks}
                disabled={!comms.autoRechargeEnabled || savingAuto}
                onThresholdChange={(v) => patchAuto({ autoRechargeThresholdSms: v })}
                onPackChange={(slug) => patchAuto({ autoRechargeSmsPackSlug: slug })}
              />
            </Col>
            <Col xs={24} md={12}>
              <ChannelAutoRecharge
                label="WhatsApp"
                threshold={comms.autoRechargeThresholdWhatsapp}
                packSlug={comms.autoRechargeWhatsappPackSlug}
                packs={whatsappPacks}
                disabled={!comms.autoRechargeEnabled || savingAuto}
                onThresholdChange={(v) => patchAuto({ autoRechargeThresholdWhatsapp: v })}
                onPackChange={(slug) => patchAuto({ autoRechargeWhatsappPackSlug: slug })}
              />
            </Col>
          </Row>
        </Card>

        {/* History */}
        <Card
          className="rounded-2xl"
          title={
            <span className="font-display text-base font-bold">
              <HistoryOutlined className="mr-2" />
              Purchase History
            </span>
          }
        >
          {history.length === 0 ? (
            <Empty description="No credit-pack purchases yet" />
          ) : (
            <div className="flex flex-col gap-2">
              {history.slice(0, 20).map((row) => {
                const def =
                  typeof row.addOnDefinitionId === 'object'
                    ? (row.addOnDefinitionId as AddOnDefinition)
                    : null;
                const name = def?.name ?? 'Credit pack';
                return (
                  <div
                    key={row._id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-heading">
                        {name} × {row.quantity}
                      </span>
                      <span className="text-xs text-subtle">
                        {dayjs(row.activatedAt ?? row.capturedAt ?? row.createdAt).format(
                          'DD MMM YYYY HH:mm',
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Tag
                        color={
                          row.status === 'activated'
                            ? 'green'
                            : row.status === 'captured'
                              ? 'blue'
                              : 'default'
                        }
                      >
                        {row.status}
                      </Tag>
                      <span className="text-sm font-semibold text-heading">
                        ₹{(row.amountPaise / 100).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function PackCard({
  pack,
  channel,
  loading,
  onBuy,
}: {
  pack: AddOnDefinition;
  channel: Channel;
  loading: boolean;
  onBuy: () => void;
}) {
  const credits = packCredits(pack, channel);
  const price = (pack as any).lifetimePrice ?? 0;
  const perCredit = credits > 0 ? price / credits : 0;
  return (
    <Col xs={24} sm={12} lg={8} xl={6}>
      <div className="flex h-full flex-col rounded-2xl border-[1.5px] border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="m-0 text-base font-semibold text-heading">{pack.name}</h3>
          <Tag>{credits.toLocaleString('en-IN')}</Tag>
        </div>
        <p className="m-0 mb-3 flex-1 text-xs text-muted">
          {pack.description ?? `${credits} ${channel === 'sms' ? 'SMS' : 'WhatsApp'} credits`}
        </p>
        <div className="mb-3">
          <span className="text-2xl font-bold text-heading">₹{price.toLocaleString('en-IN')}</span>
          {perCredit > 0 && (
            <Tooltip title={`₹${perCredit.toFixed(2)} per credit`}>
              <span className="ml-2 text-xs text-subtle">₹{perCredit.toFixed(2)}/credit</span>
            </Tooltip>
          )}
        </div>
        <Button type="primary" block loading={loading} onClick={onBuy}>
          Buy Pack
        </Button>
      </div>
    </Col>
  );
}

function ChannelAutoRecharge({
  label,
  threshold,
  packSlug,
  packs,
  disabled,
  onThresholdChange,
  onPackChange,
}: {
  label: string;
  threshold: number;
  packSlug?: string;
  packs: AddOnDefinition[];
  disabled: boolean;
  onThresholdChange: (v: number) => void;
  onPackChange: (slug: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 px-3 py-3">
      <p className="m-0 text-sm font-semibold text-heading">{label}</p>
      <div>
        <p className="m-0 mb-1 text-xs text-muted">Threshold</p>
        <InputNumber
          className="w-full"
          min={0}
          max={100_000}
          value={threshold}
          disabled={disabled}
          aria-label={`${label} auto-recharge threshold`}
          onChange={(v) => typeof v === 'number' && onThresholdChange(v)}
        />
      </div>
      <div>
        <p className="m-0 mb-1 text-xs text-muted">Pack to auto-buy</p>
        <Select
          className="w-full"
          value={packSlug}
          disabled={disabled}
          placeholder="Select pack"
          aria-label={`${label} auto-recharge pack`}
          onChange={(slug) => onPackChange(slug)}
          options={packs.map((p) => ({
            value: p.slug,
            label: `${p.name} - ₹${(p as any).lifetimePrice ?? 0}`,
          }))}
        />
      </div>
    </div>
  );
}
