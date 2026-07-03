'use client';
import { useParams, useRouter } from 'next/navigation';
import { Result } from 'antd';
import DsButton from '@/components/ui/DsButton';

/**
 * PAUSED 2026-06-06 - OCR Capture (Vendor Bill OCR) held: needs a paid AI/OCR API
 * + owner provider decision (Google Document AI / AWS Textract / LLM-vision).
 *
 * The page body that rendered OcrUploadZone is commented out below (kept intact for
 * revival). While paused this route shows a short notice and routes the user to
 * manual purchase-bill entry, so a direct-URL visit never hits the disabled
 * POST /finance/ocr/upload-vendor-bill endpoint. Manual entry is unaffected.
 * Revive via: rg "PAUSED 2026-06-06 . OCR Capture" (restore the block below, the
 * Sidebar "OCR Intake" nav item, and the OcrModule registration in the backend
 * crewroster-backend src/modules/finance/purchases/purchases.module.ts).
 */
export default function OcrUploadPage() {
  const router = useRouter();
  const { firmId } = useParams<{ firmId: string }>();
  return (
    <div style={{ padding: 24 }}>
      <Result
        status="info"
        title="Vendor Bill OCR is not available yet"
        subTitle="Automatic bill scanning is on hold. You can add purchase bills manually in the meantime."
        extra={
          <DsButton
            dsVariant="primary"
            onClick={() =>
              router.push(`/dashboard/finance/firms/${firmId}/purchases/purchase-bills/new`)
            }
          >
            Add purchase bill manually
          </DsButton>
        }
      />
    </div>
  );
}

/* PAUSED 2026-06-06 - OCR Capture: original upload page kept for revival.
import React from 'react';
import { useParams } from 'next/navigation';
import { Typography, Divider } from 'antd';
import { ScanOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import OcrUploadZone from '@/components/finance/purchases/OcrUploadZone';
import type { OcrExtractionResult } from '@/types';

export default function OcrUploadPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');

  // onExtraction is handled inside OcrUploadZone which navigates to /purchase-bills/new
  // This page just renders the full-page upload zone
  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <ScanOutlined style={{ fontSize: 28, color: 'var(--cr-primary)' }} />
        <Typography.Title level={1} style={{ margin: 0, fontSize: 22 }}>
          Vendor Bill OCR Intake
        </Typography.Title>
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Drop a PDF or image to extract fields. You will review all extracted data before creating a
        Purchase Bill.
        <br />
        <strong>
          Note: OCR extraction never auto-posts a bill. You must click Post explicitly.
        </strong>
      </Typography.Text>
      <Divider />
      <OcrUploadZone
        wsId={wsId}
        onExtraction={(result: OcrExtractionResult) => {
          // Navigation is handled inside OcrUploadZone via sessionStorage + window.location
        }}
      />
    </div>
  );
}
*/
