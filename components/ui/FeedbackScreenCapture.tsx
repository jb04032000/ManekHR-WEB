'use client';

// Screen capture + redaction modal. Captures the ERP content root, lets the
// user drag opaque rectangles over sensitive regions, and returns a redacted
// PNG File to the parent (which feeds it to FeedbackAttachments). Black-box
// redaction is irreversible. Rectangles are stored as fractions (0-1) of the
// image so the overlay is resolution-independent; they convert to natural
// pixels only when rendering the final PNG. Links to: lib/services/feedback-capture.ts,
// FeedbackPanel.tsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Button, App as AntApp } from 'antd';
import { useTranslations } from 'next-intl';
import { captureContentRoot, renderRedactedFile, type Rect } from '@/lib/services/feedback-capture';

interface FracRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FeedbackScreenCaptureProps {
  open: boolean;
  onClose: () => void;
  onAttach: (file: File) => void;
}

export default function FeedbackScreenCapture({
  open,
  onClose,
  onAttach,
}: FeedbackScreenCaptureProps) {
  const t = useTranslations('feedback.capture');
  const { message } = AntApp.useApp();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rects, setRects] = useState<FracRect[]>([]);
  const [drawing, setDrawing] = useState<FracRect | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  // Capture when the modal opens. State is only set inside the async callback
  // (not synchronously in the effect body) to avoid cascading renders; the
  // previous capture's state is harmless while closed (Modal destroyOnHidden
  // unmounts the body) and is overwritten on the next open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void captureContentRoot().then((res) => {
      if (cancelled) return;
      if (!res) {
        message.error(t('failed'));
        onClose();
        return;
      }
      setImg(res);
      setRects([]);
      setDrawing(null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, message, t, onClose]);

  // Pointer -> fraction (0-1) within the displayed image box.
  const toFraction = useCallback((clientX: number, clientY: number) => {
    const box = boxRef.current;
    if (!box) return null;
    const r = box.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return { x: clamp((clientX - r.left) / r.width), y: clamp((clientY - r.top) / r.height) };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const p = toFraction(e.clientX, e.clientY);
      if (!p) return;
      startRef.current = p;
      setDrawing({ x: p.x, y: p.y, w: 0, h: 0 });
    },
    [toFraction],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      const p = toFraction(e.clientX, e.clientY);
      if (!p) return;
      setDrawing({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      });
    },
    [toFraction],
  );

  const onPointerUp = useCallback(() => {
    if (drawing && drawing.w > 0.01 && drawing.h > 0.01) {
      setRects((prev) => [...prev, drawing]);
    }
    setDrawing(null);
    startRef.current = null;
  }, [drawing]);

  const attach = useCallback(async () => {
    if (!img) return;
    setBusy(true);
    const natural: Rect[] = rects.map((r) => ({
      x: r.x * img.naturalWidth,
      y: r.y * img.naturalHeight,
      w: r.w * img.naturalWidth,
      h: r.h * img.naturalHeight,
    }));
    const file = await renderRedactedFile(img, natural);
    setBusy(false);
    if (!file) {
      message.error(t('failed'));
      return;
    }
    onAttach(file);
    onClose();
  }, [img, rects, onAttach, onClose, message, t]);

  const overlay = [...rects, ...(drawing ? [drawing] : [])];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('title')}
      width={720}
      centered
      destroyOnHidden
      // A full-page capture can be tall. Cap the BODY height and scroll it
      // internally (v6 styles.body, not the deprecated bodyStyle) so the title +
      // footer stay fixed and only the screenshot area scrolls. Pointer math uses
      // getBoundingClientRect (viewport-relative), so scrolling does not skew the
      // redaction rectangles.
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
      footer={[
        <Button key="reset" onClick={() => setRects([])} disabled={!rects.length || busy}>
          {t('reset')}
        </Button>,
        <Button key="discard" onClick={onClose} disabled={busy}>
          {t('discard')}
        </Button>,
        <Button key="attach" type="primary" loading={busy} disabled={!img} onClick={attach}>
          {t('attach')}
        </Button>,
      ]}
    >
      <p style={{ fontSize: 13, color: 'var(--cr-text-3)', marginBottom: 8 }}>
        {t('instructions')}
      </p>
      {img && (
        <div
          ref={boxRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            position: 'relative',
            width: '100%',
            cursor: 'crosshair',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- captured data URL */}
          <img src={img.src} alt="" style={{ width: '100%', display: 'block' }} />
          {overlay.map((r, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
                background: '#111',
                opacity: 0.92,
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
