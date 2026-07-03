'use client';

import { useEffect, useMemo, useState, startTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Spin,
  Statistic,
  Table,
  Tabs,
  Typography,
  message,
} from 'antd';
import { useTranslations } from 'next-intl';
import { DsModal } from '@/components/ui/DsModal';
import type { ColumnsType } from 'antd/es/table';
import type {
  BankDisbursementRow,
  BankFileExportResponse,
  EcrExportResponse,
  EcrRow,
  EsiChallanExportResponse,
  EsiRow,
} from '@/types';
import { salaryApi } from '@/lib/api';
import { parseApiError } from '@/lib/utils';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  month: number;
  year: number;
}

const downloadBlobFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const maskAccountNumber = (accountNumber?: string) => {
  const value = (accountNumber || '').trim();
  if (!value) {
    return '-';
  }

  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}****${value.slice(-4)}`;
};

type ComplianceTabKey = 'ecr' | 'esi' | 'bank';

export function ComplianceExportModal({ open, onClose, workspaceId, month, year }: Props) {
  const t = useTranslations('salary.complianceExportModal');
  const [msgApi, contextHolder] = message.useMessage();
  const currencyFmt = useCurrencyFormatter();
  const [activeKey, setActiveKey] = useState<ComplianceTabKey>('ecr');
  const [ecrLoading, setEcrLoading] = useState(false);
  const [esiLoading, setEsiLoading] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [ecrData, setEcrData] = useState<EcrExportResponse | null>(null);
  const [esiData, setEsiData] = useState<EsiChallanExportResponse | null>(null);
  const [bankData, setBankData] = useState<BankFileExportResponse | null>(null);

  const ecrColumns = useMemo<ColumnsType<EcrRow>>(
    () => [
      { title: t('ecr.colUan'), dataIndex: 'uan', key: 'uan', width: 150 },
      { title: t('ecr.colEmployeeName'), dataIndex: 'memberName', key: 'memberName', width: 220 },
      {
        title: t('ecr.colGrossWages'),
        dataIndex: 'grossWages',
        key: 'grossWages',
        render: (value: number) => currencyFmt.full(value || 0),
      },
      {
        title: t('ecr.colEpfWages'),
        dataIndex: 'epfWages',
        key: 'epfWages',
        render: (value: number) => currencyFmt.full(value || 0),
      },
      {
        title: t('ecr.colEpfContrib'),
        dataIndex: 'epfContribution',
        key: 'epfContribution',
        render: (value: number) => currencyFmt.full(value || 0),
      },
      {
        title: t('ecr.colEpsContrib'),
        dataIndex: 'epsContribution',
        key: 'epsContribution',
        render: (value: number) => currencyFmt.full(value || 0),
      },
      {
        title: t('ecr.colEpfDiff'),
        dataIndex: 'epfDiff',
        key: 'epfDiff',
        render: (value: number) => currencyFmt.full(value || 0),
      },
      { title: t('ecr.colNcpDays'), dataIndex: 'ncp', key: 'ncp', width: 110 },
    ],
    [currencyFmt, t],
  );

  const esiColumns = useMemo<ColumnsType<EsiRow>>(
    () => [
      {
        title: t('esi.colEsicIpNumber'),
        dataIndex: 'esicIpNumber',
        key: 'esicIpNumber',
        width: 170,
      },
      {
        title: t('esi.colEmployeeName'),
        dataIndex: 'employeeName',
        key: 'employeeName',
        width: 220,
      },
      {
        title: t('esi.colGrossSalary'),
        dataIndex: 'grossSalary',
        key: 'grossSalary',
        render: (value: number) => currencyFmt.full(value || 0),
      },
      {
        title: t('esi.colEmployeeContrib'),
        dataIndex: 'employeeContribution',
        key: 'employeeContribution',
        render: (value: number) => currencyFmt.full(value || 0),
      },
      {
        title: t('esi.colEmployerContrib'),
        dataIndex: 'employerContribution',
        key: 'employerContribution',
        render: (value: number) => currencyFmt.full(value || 0),
      },
      {
        title: t('esi.colTotal'),
        dataIndex: 'totalContribution',
        key: 'totalContribution',
        render: (value: number) => currencyFmt.full(value || 0),
      },
    ],
    [currencyFmt, t],
  );

  const bankColumns = useMemo<ColumnsType<BankDisbursementRow>>(
    () => [
      { title: t('bank.colSr'), dataIndex: 'srNo', key: 'srNo', width: 72 },
      {
        title: t('bank.colEmployee'),
        dataIndex: 'employeeName',
        key: 'employeeName',
        width: 220,
      },
      {
        title: t('bank.colAccountNo'),
        dataIndex: 'accountNumber',
        key: 'accountNumber',
        width: 180,
        render: (value: string) => maskAccountNumber(value),
      },
      {
        title: t('bank.colIfsc'),
        dataIndex: 'ifscCode',
        key: 'ifscCode',
        width: 140,
      },
      {
        title: t('bank.colBank'),
        dataIndex: 'bankName',
        key: 'bankName',
        width: 200,
      },
      {
        title: t('bank.colAmount'),
        dataIndex: 'amount',
        key: 'amount',
        render: (value: number) => currencyFmt.full(value || 0),
      },
      {
        title: t('bank.colMode'),
        dataIndex: 'paymentMode',
        key: 'paymentMode',
        width: 110,
      },
    ],
    [currencyFmt, t],
  );

  const upiColumns = useMemo<ColumnsType<BankDisbursementRow>>(
    () => [
      { title: t('bank.colSr'), dataIndex: 'srNo', key: 'srNo', width: 72 },
      {
        title: t('bank.colEmployee'),
        dataIndex: 'employeeName',
        key: 'employeeName',
        width: 220,
      },
      {
        title: t('bank.colUpiId'),
        dataIndex: 'upiId',
        key: 'upiId',
        width: 240,
        render: (value?: string) => value || '-',
      },
      {
        title: t('bank.colAmount'),
        dataIndex: 'amount',
        key: 'amount',
        render: (value: number) => currencyFmt.full(value || 0),
      },
    ],
    [currencyFmt, t],
  );

  const missingUanCount = ecrData?.summary.excludedMissingUanCount || 0;
  const missingIpCount = esiData?.summary.missingIpNumberCount || 0;
  const skippedBankCount = bankData?.skippedRows.length || 0;

  const loadEcrExport = async () => {
    if (!workspaceId) {
      return;
    }

    startTransition(() => {
      setEcrLoading(true);
    });
    try {
      const result = await salaryApi.getEcrExport(workspaceId, month, year);
      startTransition(() => {
        setEcrData(result);
      });
    } catch (error) {
      msgApi.error(parseApiError(error) || t('loadError.ecr'));
    } finally {
      startTransition(() => {
        setEcrLoading(false);
      });
    }
  };

  const loadEsiExport = async () => {
    if (!workspaceId) {
      return;
    }

    startTransition(() => {
      setEsiLoading(true);
    });
    try {
      const result = await salaryApi.getEsiChallanExport(workspaceId, month, year);
      startTransition(() => {
        setEsiData(result);
      });
    } catch (error) {
      msgApi.error(parseApiError(error) || t('loadError.esi'));
    } finally {
      startTransition(() => {
        setEsiLoading(false);
      });
    }
  };

  const loadBankExport = async () => {
    if (!workspaceId) {
      return;
    }

    startTransition(() => {
      setBankLoading(true);
    });
    try {
      const result = await salaryApi.getBankFileExport(workspaceId, month, year);
      startTransition(() => {
        setBankData(result);
      });
    } catch (error) {
      msgApi.error(parseApiError(error) || t('loadError.bank'));
    } finally {
      startTransition(() => {
        setBankLoading(false);
      });
    }
  };

  useEffect(() => {
    if (!open) {
      startTransition(() => {
        setActiveKey('ecr');
        setEcrData(null);
        setEsiData(null);
        setBankData(null);
        setEcrLoading(false);
        setEsiLoading(false);
        setBankLoading(false);
      });
      return;
    }

    startTransition(() => {
      setEcrData(null);
      setEsiData(null);
      setBankData(null);
    });
  }, [open, month, workspaceId, year]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (activeKey === 'ecr' && !ecrData && !ecrLoading) {
      void loadEcrExport();
      return;
    }

    if (activeKey === 'esi' && !esiData && !esiLoading) {
      void loadEsiExport();
      return;
    }

    if (activeKey === 'bank' && !bankData && !bankLoading) {
      void loadBankExport();
    }
  }, [
    activeKey,
    bankData,
    bankLoading,
    ecrData,
    ecrLoading,
    esiData,
    esiLoading,
    month,
    open,
    workspaceId,
    year,
  ]);

  const renderEcrContent = () => {
    if (ecrLoading && !ecrData) {
      return (
        <div className="flex items-center justify-center py-16">
          <Spin />
        </div>
      );
    }

    if (!ecrData) {
      return <Empty description={t('empty.ecr')} />;
    }

    return (
      <div className="space-y-4">
        {missingUanCount > 0 && (
          <Alert
            type="warning"
            showIcon
            title={t('warnings.missingUan', { count: missingUanCount })}
          />
        )}

        <Card size="small">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={t('ecr.statTotalEmployees')}
                value={ecrData.summary.totalEmployees}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={t('ecr.statTotalEpf')}
                value={ecrData.summary.totalEpfContribution}
                formatter={(value) => currencyFmt.full(Number(value || 0))}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={t('ecr.statTotalEps')}
                value={ecrData.summary.totalEpsContribution}
                formatter={(value) => currencyFmt.full(Number(value || 0))}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={t('ecr.statTotalEdli')}
                value={ecrData.summary.totalEdliWages}
                formatter={(value) => currencyFmt.full(Number(value || 0))}
              />
            </Col>
          </Row>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <div>
            <Text strong>{t('ecr.previewLabel')}</Text>
            <div>
              <Text type="secondary">{t('ecr.previewDescription')}</Text>
            </div>
          </div>
          <Button
            type="primary"
            disabled={!ecrData.text}
            onClick={() => downloadBlobFile(ecrData.text, ecrData.filename, 'text/plain')}
          >
            {t('ecr.downloadButton')}
          </Button>
        </div>

        <Table<EcrRow>
          size="small"
          rowKey={(row) => `${row.uan}-${row.memberName}`}
          columns={ecrColumns}
          dataSource={ecrData.rows}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          scroll={{ x: 980 }}
          locale={{
            emptyText: t('ecr.tableEmpty'),
          }}
        />
      </div>
    );
  };

  const renderEsiContent = () => {
    if (esiLoading && !esiData) {
      return (
        <div className="flex items-center justify-center py-16">
          <Spin />
        </div>
      );
    }

    if (!esiData) {
      return <Empty description={t('empty.esi')} />;
    }

    return (
      <div className="space-y-4">
        {missingIpCount > 0 && (
          <Alert
            type="warning"
            showIcon
            title={t('warnings.missingIp', { count: missingIpCount })}
          />
        )}

        <Card size="small">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={t('esi.statTotalEmployees')}
                value={esiData.summary.totalEmployees}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={t('esi.statEmployeeContrib')}
                value={esiData.summary.totalEmployeeContrib}
                formatter={(value) => currencyFmt.full(Number(value || 0))}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={t('esi.statEmployerContrib')}
                value={esiData.summary.totalEmployerContrib}
                formatter={(value) => currencyFmt.full(Number(value || 0))}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={t('esi.statTotalContrib')}
                value={esiData.summary.totalContrib}
                formatter={(value) => currencyFmt.full(Number(value || 0))}
              />
            </Col>
          </Row>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <div>
            <Text strong>{t('esi.previewLabel')}</Text>
            <div>
              <Text type="secondary">{t('esi.previewDescription')}</Text>
            </div>
          </div>
          <Button
            type="primary"
            disabled={!esiData.csv}
            onClick={() => downloadBlobFile(esiData.csv, esiData.filename, 'text/csv')}
          >
            {t('esi.downloadButton')}
          </Button>
        </div>

        <Table<EsiRow>
          size="small"
          rowKey={(row) => `${row.esicIpNumber}-${row.employeeName}`}
          columns={esiColumns}
          dataSource={esiData.rows}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          scroll={{ x: 940 }}
          locale={{
            emptyText: t('esi.tableEmpty'),
          }}
        />
      </div>
    );
  };

  const renderBankContent = () => {
    if (bankLoading && !bankData) {
      return (
        <div className="flex items-center justify-center py-16">
          <Spin />
        </div>
      );
    }

    if (!bankData) {
      return <Empty description={t('empty.bank')} />;
    }

    return (
      <div className="space-y-4">
        <Card size="small">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title={t('bank.statTotalEmployees')} value={bankData.totalEmployees} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={t('bank.statTotalAmount')}
                value={bankData.totalAmount}
                formatter={(value) => currencyFmt.full(Number(value || 0))}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title={t('bank.statBankTransfer')} value={bankData.bankRows.length} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title={t('bank.statUpiPayments')} value={bankData.upiRows.length} />
            </Col>
          </Row>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Text strong>{t('bank.bankTransferLabel')}</Text>
              <div>
                <Text type="secondary">
                  {t('bank.bankTransferDescription', { count: bankData.bankRows.length })}
                </Text>
              </div>
            </div>
            <Button
              type="primary"
              disabled={!bankData.bankCsv}
              onClick={() => downloadBlobFile(bankData.bankCsv, bankData.bankFilename, 'text/csv')}
            >
              {t('bank.bankDownloadButton')}
            </Button>
          </div>

          <Table<BankDisbursementRow>
            size="small"
            rowKey={(row) => `bank-${row.srNo}-${row.accountNumber}`}
            columns={bankColumns}
            dataSource={bankData.bankRows}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            scroll={{ x: 980 }}
            locale={{
              emptyText: t('bank.bankTableEmpty'),
            }}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Text strong>{t('bank.upiPaymentsLabel')}</Text>
              <div>
                <Text type="secondary">
                  {t('bank.upiPaymentsDescription', { count: bankData.upiRows.length })}
                </Text>
              </div>
            </div>
            <Button
              type="primary"
              disabled={!bankData.upiCsv}
              onClick={() => downloadBlobFile(bankData.upiCsv, bankData.upiFilename, 'text/csv')}
            >
              {t('bank.upiDownloadButton')}
            </Button>
          </div>

          <Table<BankDisbursementRow>
            size="small"
            rowKey={(row) => `upi-${row.srNo}-${row.upiId || row.employeeName}`}
            columns={upiColumns}
            dataSource={bankData.upiRows}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            scroll={{ x: 760 }}
            locale={{
              emptyText: t('bank.upiTableEmpty'),
            }}
          />
        </div>

        {skippedBankCount > 0 && (
          <div className="space-y-4">
            <Alert
              type="warning"
              showIcon
              title={t('warnings.skippedPayments', { count: skippedBankCount })}
            />

            <Card size="small" title={t('bank.skippedCardTitle')}>
              <div className="space-y-2">
                {bankData.skippedRows.map((row) => (
                  <div
                    key={`${row.employeeName}-${row.reason}`}
                    className="flex items-center justify-between gap-3 border-b border-dashed border-gray-200 pb-2 last:border-b-0"
                  >
                    <Text>{row.employeeName}</Text>
                    <Text type="secondary">{row.reason}</Text>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {contextHolder}
      <DsModal
        open={open}
        onCancel={onClose}
        footer={null}
        width={1080}
        destroyOnHidden
        title={t('title', { month: String(month).padStart(2, '0'), year })}
      >
        <Tabs
          activeKey={activeKey}
          onChange={(key) => setActiveKey(key as ComplianceTabKey)}
          items={[
            {
              key: 'ecr',
              label: t('tabs.pfEcr'),
              children: renderEcrContent(),
            },
            {
              key: 'esi',
              label: t('tabs.esiChallan'),
              children: renderEsiContent(),
            },
            {
              key: 'bank',
              label: t('tabs.bankDisbursement'),
              children: renderBankContent(),
            },
          ]}
        />
      </DsModal>
    </>
  );
}
