'use client';
import React, { useEffect, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, Typography, Skeleton, Timeline, Descriptions } from 'antd';
import DsDrawer from '@/components/ui/DsDrawer';
import AssetQrCode from './AssetQrCode';
import AssetVerifyButton from './AssetVerifyButton';
import MachineLinkSection from './MachineLinkSection';
import {
  getFixedAsset,
  getLinkedMachine,
  getLinkedItcSchedule,
} from '@/lib/actions/finance-fixed-assets.actions';
import { useWorkspaceStore } from '@/lib/store';
import { fmt, formatCurrencyFull } from '@/lib/utils';
import type { FixedAsset, FixedAssetAuditEntry } from '@/types';

interface FixedAssetDetailDrawerProps {
  assetId: string | null;
  firmId: string;
  open: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

const formatPaise = (v: number) => formatCurrencyFull(v / 100);

export default function FixedAssetDetailDrawer({
  assetId,
  firmId,
  open,
  onClose,
  onRefresh,
}: FixedAssetDetailDrawerProps) {
  const t = useTranslations('finance.fixedAssets.detail');
  const tStatus = useTranslations('finance.fixedAssets.status');
  const tForm = useTranslations('finance.fixedAssets.form');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const [asset, setAsset] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkedMachine, setLinkedMachine] = useState<unknown>(null);
  const [linkedItc, setLinkedItc] = useState<unknown>(null);

  const fetchAsset = async () => {
    if (!assetId || !wsId) return;
    startTransition(() => {
      setLoading(true);
    });
    try {
      const a = await getFixedAsset(wsId, firmId, assetId);
      startTransition(() => {
        setAsset(a);
      });
    } catch {
      startTransition(() => {
        setAsset(null);
      });
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  };

  const fetchLinks = async () => {
    if (!assetId || !wsId) return;
    try {
      const m = await getLinkedMachine(wsId, firmId, assetId);
      startTransition(() => {
        setLinkedMachine(m);
      });
    } catch {
      startTransition(() => {
        setLinkedMachine(null);
      });
    }
    try {
      const itc = await getLinkedItcSchedule(wsId, firmId, assetId);
      startTransition(() => {
        setLinkedItc(itc);
      });
    } catch {
      startTransition(() => {
        setLinkedItc(null);
      });
    }
  };

  useEffect(() => {
    if (open && assetId) {
      fetchAsset();
      fetchLinks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assetId, wsId]);

  const handleVerified = () => {
    fetchAsset();
    onRefresh?.();
  };

  return (
    <DsDrawer
      open={open}
      onClose={onClose}
      title={
        asset ? t('titleWithCode', { code: asset.assetCode, name: asset.name }) : t('fallbackTitle')
      }
      subtitle={
        asset
          ? `${tStatus(asset.status)}${asset.isFullyDepreciated ? ' · ' + t('fullyDepreciated') : ''}`
          : undefined
      }
    >
      {loading && <Skeleton active />}
      {!loading && !asset && <Typography.Text type="secondary">{t('notFound')}</Typography.Text>}
      {!loading && asset && (
        <>
          {/* NBV header */}
          <div
            style={{
              display: 'flex',
              gap: 32,
              padding: '12px 0',
              borderBottom: '1px solid var(--cr-border-light)',
              marginBottom: 16,
            }}
          >
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('cost')}
              </Typography.Text>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{formatPaise(asset.costPaise)}</div>
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('accDepreciation')}
              </Typography.Text>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                {formatPaise(asset.accumulatedDepreciationPaise)}
              </div>
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('nbv')}
              </Typography.Text>
              <div style={{ fontWeight: 600, fontSize: 20, color: 'var(--cr-primary)' }}>
                {formatPaise(asset.nbvPaise)}
              </div>
            </div>
          </div>

          <Tabs
            items={[
              {
                key: 'overview',
                label: t('tabs.overview'),
                children: (
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label={t('fields.assetCode')}>
                      {asset.assetCode}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.financialYear')}>
                      {asset.financialYear}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.purchaseDate')}>
                      {fmt(asset.purchaseDate)}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.purchaseBill')}>
                      {asset.purchaseBillNumber ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.vendor')}>
                      {asset.partyName ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.serialNo')}>
                      {asset.serialNumber ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.method')}>
                      {asset.depreciationMethod.toUpperCase()} /{' '}
                      {tForm(`frequency.${asset.depreciationFrequency}`)}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.shiftType')}>
                      {t(`shift.${asset.shiftType}`)}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.usefulLife')}>
                      {t('yrs', { years: asset.usefulLifeYears })}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.nextDeprMonth')}>
                      {asset.nextDepreciationMonth ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.location')}>
                      {asset.locationId ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.custodian')}>
                      {asset.custodianMemberId ?? '-'}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'audit',
                label: t('tabs.audit'),
                children:
                  asset.auditLog && asset.auditLog.length > 0 ? (
                    <Timeline
                      items={asset.auditLog.map((e: FixedAssetAuditEntry) => ({
                        children: (
                          <div>
                            <Typography.Text strong>{e.action}</Typography.Text>
                            <Typography.Text
                              type="secondary"
                              style={{ marginLeft: 8, fontSize: 12 }}
                            >
                              {t('auditMeta', { at: fmt(e.at), by: e.by })}
                            </Typography.Text>
                          </div>
                        ),
                      }))}
                    />
                  ) : (
                    <Typography.Text type="secondary">{t('noAudit')}</Typography.Text>
                  ),
              },
              {
                key: 'links',
                label: t('tabs.links'),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {t('machine')}
                    </Typography.Text>
                    <MachineLinkSection
                      assetId={asset._id}
                      firmId={firmId}
                      currentMachineId={asset.machineId}
                      currentMachine={linkedMachine as { _id: string; name: string } | null}
                      onChange={() => {
                        fetchAsset();
                        fetchLinks();
                      }}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 13, marginTop: 8 }}>
                      {t('itcSchedule')}
                    </Typography.Text>
                    {linkedItc ? (
                      <pre
                        style={{
                          fontSize: 12,
                          background: 'var(--cr-neutral-100)',
                          padding: 8,
                          borderRadius: 4,
                        }}
                      >
                        {JSON.stringify(linkedItc, null, 2)}
                      </pre>
                    ) : (
                      <Typography.Text type="secondary">{t('noItc')}</Typography.Text>
                    )}
                  </div>
                ),
              },
              {
                key: 'verification',
                label: t('tabs.verification'),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {asset.qrCodeData && (
                      <AssetQrCode
                        qrCodeData={asset.qrCodeData}
                        assetName={asset.name}
                        assetCode={asset.assetCode}
                      />
                    )}
                    <AssetVerifyButton
                      assetId={asset._id}
                      firmId={firmId}
                      lastVerifiedAt={asset.lastVerifiedAt}
                      onVerified={handleVerified}
                    />
                    {asset.lastVerifiedAt && (
                      <Typography.Text type="secondary">
                        {t('lastVerified', { date: fmt(asset.lastVerifiedAt) })}
                      </Typography.Text>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
    </DsDrawer>
  );
}
