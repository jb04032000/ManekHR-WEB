'use client';
import { useEffect, useRef, useState } from 'react';
import { Alert, Input } from 'antd';
import { ScanOutlined } from '@ant-design/icons';
import { DsModal } from '@/components/ui/DsModal';

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}

// NOTE: This component MUST be consumed via:
//   dynamic(() => import('@/components/finance/inventory/BarcodeScanModal'), { ssr: false })
// Do NOT import it directly at the top of a page - @zxing/library requires browser APIs.

export default function BarcodeScanModal({ open, onClose, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyboardVal, setKeyboardVal] = useState('');

  const handleClose = () => {
    try {
      readerRef.current?.reset();
    } catch {}
    setKeyboardVal('');
    setError(null);
    onClose();
  };

  // CRITICAL (pitfall 3): @zxing/library import MUST be inside useEffect, never at module top.
  // This prevents SSR crash since BrowserMultiFormatReader relies on window/navigator.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } =
          await import('@zxing/library');

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.EAN_13,
        ]);

        const reader = new BrowserMultiFormatReader(hints);
        readerRef.current = reader;

        const devices = await reader.listVideoInputDevices();
        if (cancelled || devices.length === 0) {
          setError(
            'Camera not available. Use the keyboard input below to type or paste a barcode.',
          );
          return;
        }

        await reader.decodeFromVideoDevice(
          devices[0].deviceId,
          videoRef.current!,
          (result: any) => {
            if (result) {
              const text = result.getText();
              onScan(text);
              handleClose();
            }
          },
        );
      } catch {
        if (!cancelled) {
          setError(
            'Camera not available. Use the keyboard input below to type or paste a barcode.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        readerRef.current?.reset();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 300ms debounce on keyboard input per UI-SPEC §4
  // Security: no console.log of scan payloads (T-09-09-05)
  useEffect(() => {
    if (!keyboardVal) return;
    const t = setTimeout(() => {
      onScan(keyboardVal);
      handleClose();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardVal]);

  return (
    <DsModal
      open={open}
      onCancel={handleClose}
      title={
        <span>
          <ScanOutlined /> Scan Barcode
        </span>
      }
      footer={null}
      width={680}
      centered
    >
      {error ? (
        <Alert type="warning" title={error} style={{ marginBottom: 12 }} />
      ) : (
        <video ref={videoRef} style={{ width: '100%', background: '#000', borderRadius: 4 }} />
      )}
      <div style={{ marginTop: 12 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--cr-text-4)',
            display: 'block',
            marginBottom: 6,
          }}
        >
          Or type / paste barcode
        </label>
        <Input
          autoFocus
          value={keyboardVal}
          onChange={(e) => setKeyboardVal(e.target.value)}
          placeholder="Scan or type barcode and press enter"
        />
      </div>
    </DsModal>
  );
}
