'use client';
import React from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import DsButton from '@/components/ui/DsButton';
import { PrinterOutlined } from '@ant-design/icons';

// Lazy-load qrcode.react to avoid SSR bloat
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), {
  ssr: false,
  loading: () => <div style={{ width: 128, height: 128, background: 'var(--cr-neutral-100)' }} />,
});

interface AssetQrCodeProps {
  qrCodeData?: string;
  assetName?: string;
  assetCode?: string;
  size?: number;
}

export default function AssetQrCode({
  qrCodeData,
  assetName,
  assetCode,
  size = 128,
}: AssetQrCodeProps) {
  const t = useTranslations('finance.fixedAssets.actions.qr');
  if (!qrCodeData) {
    return <div style={{ color: '#999', padding: 8 }}>{t('notGenerated')}</div>;
  }

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset QR - ${assetCode ?? ''}</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px; }
            h2 { font-size: 18px; margin: 0 0 4px; }
            p  { font-size: 13px; color: #555; margin: 0 0 16px; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h2>${assetName ?? ''}</h2>
          <p>${assetCode ?? ''}</p>
          <div id="qr"></div>
          <script src="https://unpkg.com/qrcode/build/qrcode.min.js"></script>
          <script>
            QRCode.toCanvas(document.createElement('canvas'), ${JSON.stringify(qrCodeData)}, function(err, canvas) {
              if (!err) document.getElementById('qr').appendChild(canvas);
            });
          </script>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
      <QRCodeSVG value={qrCodeData} size={size} />
      <DsButton dsVariant="ghost" dsSize="sm" icon={<PrinterOutlined />} onClick={handlePrint}>
        {t('printButton')}
      </DsButton>
    </div>
  );
}
