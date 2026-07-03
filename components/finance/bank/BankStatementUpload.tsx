'use client';

import React, { useState } from 'react';
import { Steps, Upload, Button, Alert, Table, Select, Typography, Space, Tag } from 'antd';
import { InboxOutlined, FileTextOutlined, CloseOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import { financeBankReconciliationApi } from '@/lib/api/modules/finance-bank-reconciliation.api';
import type { BankStatementPreview } from '@/types';

const { Text } = Typography;

interface BankStatementUploadProps {
  wsId: string;
  firmId: string;
  bankAccountId: string;
  onConfirmed: (sessionId: string) => void;
}

const BANK_NAMES: Record<string, string> = {
  hdfc: 'HDFC Bank',
  icici: 'ICICI Bank',
  sbi: 'State Bank of India',
  axis: 'Axis Bank',
  kotak: 'Kotak Mahindra Bank',
  yes_bank: 'YES Bank',
  indusind: 'IndusInd Bank',
  pnb: 'Punjab National Bank',
  bob: 'Bank of Baroda',
  generic: 'Generic',
};

interface GenericMapping {
  dateColumn?: string;
  narrationColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  amountColumn?: string;
  drCrFlagColumn?: string;
  refColumn?: string;
  balanceColumn?: string;
}

export default function BankStatementUpload({
  wsId,
  firmId,
  bankAccountId,
  onConfirmed,
}: BankStatementUploadProps) {
  const [currentStep, setCurrentStep] = useState<0 | 1>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BankStatementPreview | null>(null);
  const [genericMapping, setGenericMapping] = useState<GenericMapping>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (file: File) => {
    // Validate file size: 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      setError('Upload failed. Check the file is a valid CSV, XLS, or XLSX file under 10MB.');
      return false;
    }
    setSelectedFile(file);
    setError(null);
    setUploading(true);
    try {
      const result = await financeBankReconciliationApi.uploadStatement(
        wsId,
        firmId,
        bankAccountId,
        file,
      );
      setPreview(result);
      setCurrentStep(1);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      if (err?.response?.status === 409) {
        setError('A statement for this period already exists.');
      } else {
        setError(
          err?.response?.data?.message ??
            'Upload failed. Check the file is a valid CSV, XLS, or XLSX file under 10MB.',
        );
      }
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
    return false; // prevent default upload
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    try {
      const result = await financeBankReconciliationApi.confirmStatement(
        wsId,
        firmId,
        bankAccountId,
        selectedFile,
        preview?.detectedFormat === 'generic' ? genericMapping : undefined,
      );
      onConfirmed(result.sessionId);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } };
      if (err?.response?.status === 409) {
        setError(
          'A statement for this period already exists. Delete the existing statement first.',
        );
      } else {
        setError('Upload failed. Check the file is a valid CSV, XLS, or XLSX file under 10MB.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setCurrentStep(0);
    setSelectedFile(null);
    setPreview(null);
    setGenericMapping({});
    setError(null);
  };

  // Get column header options from preview rows
  const columnOptions = preview?.previewRows?.[0]
    ? Object.keys(preview.previewRows[0]).map((k) => ({ label: k, value: k }))
    : Array.from({ length: 8 }, (_, i) => ({ label: `Column ${i}`, value: String(i) }));

  const isGenericMappingComplete =
    preview?.detectedFormat !== 'generic' ||
    (genericMapping.dateColumn &&
      genericMapping.narrationColumn &&
      (genericMapping.debitColumn || genericMapping.creditColumn || genericMapping.amountColumn));

  const previewColumns = [
    {
      title: 'Date',
      dataIndex: 'txnDate',
      key: 'txnDate',
      render: (v: string) => (v ? dayjs(v).format('DD MMM YYYY') : '-'),
    },
    { title: 'Narration', dataIndex: 'narration', key: 'narration', ellipsis: true },
    {
      title: 'Debit',
      dataIndex: 'debitPaise',
      key: 'debitPaise',
      render: (v: number) =>
        v ? (
          <Text type="danger">
            ₹{(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        ) : (
          '-'
        ),
    },
    {
      title: 'Credit',
      dataIndex: 'creditPaise',
      key: 'creditPaise',
      render: (v: number) =>
        v ? (
          <Text type="success">
            ₹{(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        ) : (
          '-'
        ),
    },
    {
      title: 'Balance',
      dataIndex: 'closingBalancePaise',
      key: 'closingBalancePaise',
      render: (v: number) =>
        v != null ? `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-',
    },
  ];

  const formatRupees = (paise: number | null | undefined) => {
    if (paise == null) return '-';
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Steps
        progressDot
        current={currentStep}
        items={[{ title: 'Upload File' }, { title: 'Preview & Confirm' }]}
        style={{ marginBottom: 32 }}
      />

      {/* Step 1: Upload */}
      {currentStep === 0 && (
        <div>
          {selectedFile ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-md)',
                background: 'var(--cr-surface)',
                marginBottom: 16,
              }}
            >
              <FileTextOutlined style={{ fontSize: 20, color: 'var(--cr-primary)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text
                  strong
                  style={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedFile.name}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatBytes(selectedFile.size)}
                </Text>
              </div>
              <Button
                type="text"
                icon={<CloseOutlined />}
                size="small"
                onClick={() => {
                  setSelectedFile(null);
                  setError(null);
                }}
                disabled={uploading}
              >
                Remove
              </Button>
            </div>
          ) : (
            <Upload.Dragger
              accept=".csv,.xls,.xlsx"
              multiple={false}
              showUploadList={false}
              beforeUpload={(file) => {
                handleFileSelect(file);
                return false;
              }}
              style={{ marginBottom: 16 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 36, color: 'var(--cr-text-4)' }} />
              </p>
              <p className="ant-upload-text" style={{ color: 'var(--cr-text-3)', fontSize: 14 }}>
                Drag CSV, XLS, or XLSX here
              </p>
              <p className="ant-upload-hint" style={{ color: 'var(--cr-primary)', fontSize: 13 }}>
                or click to browse
              </p>
              <p style={{ fontSize: 12, color: 'var(--cr-text-4)', marginTop: 8 }}>
                Max 10MB - HDFC, ICICI, SBI, Axis, Kotak, YES Bank, IndusInd, PNB, BOB + Generic
              </p>
            </Upload.Dragger>
          )}
          {uploading && (
            <Alert
              type="info"
              title="Parsing file and detecting format..."
              style={{ marginTop: 8 }}
            />
          )}
          {error && <Alert type="error" title={error} style={{ marginTop: 8 }} />}
        </div>
      )}

      {/* Step 2: Preview */}
      {currentStep === 1 && preview && (
        <div>
          {/* Format detection banner */}
          {preview.detectedFormat !== 'generic' ? (
            <Alert
              type="info"
              title={`Format detected: ${BANK_NAMES[preview.detectedFormat] ?? preview.detectedFormat} - ${preview.rowCount} rows found`}
              style={{ marginBottom: 16 }}
            />
          ) : (
            <Alert
              type="warning"
              title="Unknown format - please map columns below"
              style={{ marginBottom: 16 }}
            />
          )}

          {/* FY boundary warning */}
          {preview.fyBoundaryWarning && (
            <Alert type="warning" title={preview.fyBoundaryWarning} style={{ marginBottom: 16 }} />
          )}

          {/* Opening balance chain warning */}
          {preview.openingBalanceChainWarning && (
            <Alert
              type="info"
              title={preview.openingBalanceChainWarning}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Duplicate / confirm error */}
          {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} />}

          {/* Generic column mapping */}
          {preview.detectedFormat === 'generic' && (
            <div
              style={{
                background: 'var(--cr-surface-2)',
                borderRadius: 'var(--cr-radius-md)',
                padding: 16,
                marginBottom: 16,
              }}
            >
              <Text strong style={{ display: 'block', marginBottom: 12 }}>
                Map Columns
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Date Column *', key: 'dateColumn' },
                  { label: 'Narration Column *', key: 'narrationColumn' },
                  { label: 'Debit Column', key: 'debitColumn' },
                  { label: 'Credit Column', key: 'creditColumn' },
                  { label: 'Amount Column', key: 'amountColumn' },
                  { label: 'DR/CR Flag Column', key: 'drCrFlagColumn' },
                  { label: 'Reference Column', key: 'refNumberColumn' },
                  { label: 'Balance Column', key: 'balanceColumn' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <Text
                      style={{
                        fontSize: 12,
                        display: 'block',
                        marginBottom: 4,
                        color: 'var(--cr-text-3)',
                      }}
                    >
                      {label}
                    </Text>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Select column"
                      options={columnOptions}
                      value={(genericMapping as Record<string, string | undefined>)[key]}
                      onChange={(val) => setGenericMapping((prev) => ({ ...prev, [key]: val }))}
                      allowClear
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Column preview table */}
          <Table
            size="small"
            dataSource={preview.previewRows.slice(0, 10)}
            columns={previewColumns}
            pagination={false}
            rowKey="rowIndex"
            scroll={{ x: true }}
            style={{ marginBottom: 8 }}
          />

          {/* Summary row */}
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
            {preview.rowCount} transactions detected
            {preview.openingBalancePaise != null &&
              ` • Opening: ${formatRupees(preview.openingBalancePaise)}`}
            {preview.closingBalancePaise != null &&
              ` • Closing: ${formatRupees(preview.closingBalancePaise)}`}
          </Text>

          {/* Footer buttons */}
          <Space>
            <Button onClick={handleBack} disabled={loading}>
              Back
            </Button>
            <Button
              type="primary"
              onClick={handleConfirmImport}
              loading={loading}
              disabled={!isGenericMappingComplete}
            >
              Confirm Import
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
}
