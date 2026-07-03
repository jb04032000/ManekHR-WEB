'use client';
// Cash registers list (Finance > Payments & Banking). Polish: i18n via
// finance.banking.cashRegisters + DsPageHeader. Wraps DayEndTallyModal + ReplenishPettyCashModal.
import { startTransition, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, Tag, Space, Spin, Empty, Typography, Row, Col, message } from 'antd';
import { BankOutlined, AuditOutlined } from '@ant-design/icons';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { useWorkspaceStore } from '@/lib/store';
import { listFirms, listCashRegisters } from '@/lib/actions/finance.actions';
import type { Firm, CashRegisterExtended } from '@/types';
import { LowWaterAlertBanner } from '@/components/finance/cash/LowWaterAlertBanner';
import { DayEndTallyModal } from '@/components/finance/cash/DayEndTallyModal';
import { ReplenishPettyCashModal } from '@/components/finance/cash/ReplenishPettyCashModal';

const { Text } = Typography;

function formatRs(rupees: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees ?? 0);
}

export default function CashRegistersPage() {
  const t = useTranslations('finance.banking');
  // tShared only sources the shared list error-state labels (finance.sales.listCommon.*).
  const tShared = useTranslations('finance.sales');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const [firms, setFirms] = useState<Firm[]>([]);
  const [registers, setRegisters] = useState<CashRegisterExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tallyTarget, setTallyTarget] = useState<CashRegisterExtended | null>(null);
  const [replenishTarget, setReplenishTarget] = useState<CashRegisterExtended | null>(null);

  const firmId = firms[0]?._id ?? '';

  useEffect(() => {
    if (!wsId) return;
    listFirms(wsId)
      .then((f) => setFirms(f ?? []))
      .catch(() => {});
  }, [wsId]);

  function reload() {
    if (!wsId || !firmId) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listCashRegisters(wsId, firmId)
      .then((res) => setRegisters((res as unknown as CashRegisterExtended[]) ?? []))
      .catch(() => {
        setRegisters([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, firmId]);

  if (!firmId && !loading) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description={t('cashRegisters.noFirm')} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <LowWaterAlertBanner wsId={wsId} firmId={firmId} />

      <DsPageHeader
        title={t('cashRegisters.title')}
        icon={<BankOutlined />}
        titleAside={<InfoTooltip text={t('cashRegisters.info')} />}
        style={{ marginBottom: 16 }}
      />

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={reload}
        />
      ) : loading ? (
        <Spin style={{ display: 'block', marginTop: 48 }} />
      ) : registers.length === 0 ? (
        <Empty description={t('cashRegisters.empty')} />
      ) : (
        <Row gutter={[16, 16]}>
          {registers.map((reg) => (
            <Col key={reg._id} xs={24} sm={12} lg={8}>
              <Card
                size="small"
                title={
                  <Space>
                    <BankOutlined />
                    <span>{reg.name}</span>
                    <Tag color={reg.type === 'petty_cash' ? 'orange' : 'blue'}>
                      {reg.type === 'petty_cash'
                        ? t('cashRegisters.typePetty')
                        : t('cashRegisters.typeMain')}
                    </Tag>
                  </Space>
                }
              >
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">{t('cashRegisters.currentBalance')}</Text>
                  <div>
                    <Text
                      strong
                      style={{
                        fontSize: 20,
                        color:
                          reg.lowWaterThresholdPaise &&
                          reg.currentBalance * 100 < reg.lowWaterThresholdPaise
                            ? 'var(--cr-error)'
                            : 'var(--cr-success)',
                      }}
                    >
                      {formatRs(reg.currentBalance)}
                    </Text>
                  </div>
                </div>

                {reg.imprestAmount && (
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('cashRegisters.imprest', { amount: formatRs(reg.imprestAmount) })}
                    </Text>
                  </div>
                )}

                {reg.lastTallyAt && (
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('cashRegisters.lastTally', {
                        date: new Date(reg.lastTallyAt).toLocaleDateString('en-IN'),
                      })}
                    </Text>
                  </div>
                )}

                <Space style={{ marginTop: 8 }} wrap>
                  <Button size="small" icon={<AuditOutlined />} onClick={() => setTallyTarget(reg)}>
                    {t('cashRegisters.dayEndTally')}
                  </Button>
                  {reg.type === 'petty_cash' && (
                    <Button size="small" onClick={() => setReplenishTarget(reg)}>
                      {t('cashRegisters.replenish')}
                    </Button>
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {tallyTarget && (
        <DayEndTallyModal
          wsId={wsId}
          firmId={firmId}
          register={tallyTarget}
          open
          onClose={() => setTallyTarget(null)}
          onSuccess={() => {
            setTallyTarget(null);
            reload();
          }}
        />
      )}

      {replenishTarget && (
        <ReplenishPettyCashModal
          wsId={wsId}
          firmId={firmId}
          register={replenishTarget}
          open
          onClose={() => setReplenishTarget(null)}
          onSuccess={() => {
            setReplenishTarget(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
