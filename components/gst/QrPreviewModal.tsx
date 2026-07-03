'use client';

import React from 'react';
import { DsModal } from '@/components/ui/DsModal';

interface QrPreviewModalProps {
  open: boolean;
  qrDataUrl: string;
  irn: string;
  ackNo: string;
  onClose: () => void;
}

/**
 * QrPreviewModal - displays the signed IRN QR code image returned
 * by the backend as a base64 PNG data URL (rendered via qrcode npm package
 * server-side - no frontend QR library needed).
 */
export default function QrPreviewModal({
  open,
  qrDataUrl,
  irn,
  ackNo,
  onClose,
}: QrPreviewModalProps) {
  return (
    <DsModal open={open} title="IRN QR Code" onCancel={onClose} footer={null} width={360}>
      <div className="flex flex-col items-center gap-4 py-2">
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="IRN QR Code"
            width={256}
            height={256}
            style={{ imageRendering: 'pixelated' }}
          />
        )}

        <div className="flex w-full flex-col gap-1">
          <p
            className="font-body text-[11px] font-bold tracking-wide uppercase"
            style={{ color: 'var(--cr-text-3)' }}
          >
            IRN
          </p>
          <p
            className="font-mono text-[12px] break-all"
            style={{ color: 'var(--cr-text-2)' }}
            title={irn}
          >
            {irn}
          </p>
        </div>

        <div className="flex w-full flex-col gap-1">
          <p
            className="font-body text-[11px] font-bold tracking-wide uppercase"
            style={{ color: 'var(--cr-text-3)' }}
          >
            Ack No
          </p>
          <p className="font-mono text-[13px]" style={{ color: 'var(--cr-text)' }}>
            {ackNo}
          </p>
        </div>
      </div>
    </DsModal>
  );
}
