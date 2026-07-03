'use client';
import React, { useRef, useState } from 'react';
import { Spin, Alert, Progress, Typography } from 'antd';
import { InboxOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { uploadVendorBillForOcrClient } from '@/lib/api/modules/finance-purchases.api';
import DsButton from '@/components/ui/DsButton';
import type { OcrExtractionResult } from '@/types';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
const ALLOWED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.tif,.tiff';

interface Props {
  wsId: string;
  onExtraction: (result: OcrExtractionResult) => void;
}

const OCR_STATUS_LABELS: Record<string, string> = {
  manual: 'Manual',
  ocr_prefilled: 'OCR Pre-filled',
  ocr_auto_filled: 'OCR Auto-filled',
};

export default function OcrUploadZone({ wsId, onExtraction }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<OcrExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function validate(file: File): string | null {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File too large: ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum is 10 MB.`;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return `Unsupported file type: ${file.type}. Allowed: PDF, JPEG, PNG, TIFF.`;
    }
    return null;
  }

  async function processFile(file: File) {
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setExtraction(null);
    setUploading(true);
    setUploadedFileName(file.name);

    try {
      const result = await uploadVendorBillForOcrClient(wsId, file);
      setExtraction(result);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message ?? 'OCR extraction failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function handlePrefill() {
    if (!extraction) return;
    // Store extraction in sessionStorage and navigate to /purchase-bills/new
    const key = `ocr_${Date.now()}`;
    sessionStorage.setItem(key, JSON.stringify(extraction));
    const firmIdMatch = window.location.pathname.match(/\/firms\/([^/]+)\//);
    const firmId = firmIdMatch?.[1] ?? '';
    const basePath = window.location.pathname.split('/firms/')[0];
    window.location.href = `${basePath}/firms/${firmId}/purchases/purchase-bills/new?fromOcr=${key}`;
    // IMPORTANT: OCR zone NEVER auto-submits a Purchase Bill - user must click Post explicitly
  }

  const confidencePct = extraction ? Math.round(extraction.confidence * 100) : 0;
  const isLowConfidence = extraction && extraction.confidence < 0.7;

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Drop zone */}
      <div
        onDragEnter={() => setDragging(true)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
          borderRadius: 12,
          padding: '48px 24px',
          textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          background: dragging ? 'var(--cr-surface-2)' : 'var(--cr-surface)',
          transition: 'all 0.2s',
          marginBottom: 16,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={uploading}
        />

        {uploading ? (
          <div>
            <Spin size="large" />
            <Typography.Text style={{ display: 'block', marginTop: 16 }}>
              Extracting from <strong>{uploadedFileName}</strong>...
            </Typography.Text>
          </div>
        ) : (
          <>
            <InboxOutlined style={{ fontSize: 48, color: 'var(--cr-text-3)' }} />
            <Typography.Title level={5} style={{ marginTop: 12 }}>
              Drop a PDF or image here
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Accepted: PDF, JPEG, PNG, TIFF - max 10 MB
            </Typography.Text>
            <br />
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              style={{ marginTop: 12 }}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              disabled={uploading}
            >
              Or click to browse
            </DsButton>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Extraction result */}
      {extraction && (
        <div>
          {isLowConfidence && (
            <Alert
              type="warning"
              icon={<WarningOutlined />}
              showIcon
              title="Low confidence - please verify all fields before posting"
              style={{ marginBottom: 12 }}
            />
          )}

          <div
            style={{
              border: '1px solid var(--cr-border)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Typography.Title level={5} style={{ margin: 0 }}>
                <CheckCircleOutlined style={{ color: 'var(--cr-success-500)', marginRight: 8 }} />
                Extraction Result
              </Typography.Title>
              <span>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Status: {OCR_STATUS_LABELS[extraction.ocrStatus] ?? extraction.ocrStatus}
                </Typography.Text>
              </span>
            </div>

            <Progress
              percent={confidencePct}
              status={isLowConfidence ? 'exception' : confidencePct >= 90 ? 'success' : 'normal'}
              format={(p) => `${p}% confidence`}
              style={{ marginBottom: 12 }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
              {extraction.vendorName && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Vendor Name
                  </Typography.Text>
                  <div>{extraction.vendorName}</div>
                </div>
              )}
              {extraction.vendorGstin && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Vendor GSTIN
                  </Typography.Text>
                  <div>{extraction.vendorGstin}</div>
                </div>
              )}
              {extraction.invoiceNumber && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Invoice #
                  </Typography.Text>
                  <div>{extraction.invoiceNumber}</div>
                </div>
              )}
              {extraction.invoiceDate && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Invoice Date
                  </Typography.Text>
                  <div>{extraction.invoiceDate}</div>
                </div>
              )}
              {extraction.totalAmountPaise !== undefined && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Total Amount
                  </Typography.Text>
                  <div>
                    ₹
                    {(extraction.totalAmountPaise / 100).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              )}
              {extraction.lineItems.length > 0 && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Line Items
                  </Typography.Text>
                  <div>{extraction.lineItems.length} item(s) extracted</div>
                </div>
              )}
            </div>
          </div>

          {/* Pre-fill action - NEVER auto-submits */}
          <DsButton dsVariant="primary" fullWidth onClick={handlePrefill}>
            Pre-fill Purchase Bill Form
          </DsButton>
          <Typography.Text
            type="secondary"
            style={{ display: 'block', marginTop: 8, fontSize: 12, textAlign: 'center' }}
          >
            You will review and manually post the bill after pre-filling
          </Typography.Text>
        </div>
      )}
    </div>
  );
}
