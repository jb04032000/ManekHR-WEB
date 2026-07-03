'use client';
// Finance polish (items/inventory): i18n via finance.inventory.labels (label printing belongs
// to the inventory namespace since lots/items share it); DsPageHeader title. Label-size options
// built inside the component so labels can use the translator. No data logic changed.
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Radio, InputNumber, Spin, Alert } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { getItemLabelPdf, listLots } from '@/lib/actions/inventory.actions';
import type { Lot } from '@/types';

export default function ItemLabelPage() {
  const params = useParams<{ firmId: string; id: string }>();
  const search = useSearchParams();
  const t = useTranslations('finance.inventory.labels');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');

  const SIZES = [
    { value: '20x10', label: t('sizeTiny') },
    { value: '30x20', label: t('sizeSmall') },
    { value: '38x25', label: t('sizeMedium') },
    { value: '50x30', label: t('sizeLarge') },
    { value: 'a4_sheet', label: t('sizeA4') },
  ];
  const [labelSize, setLabelSize] = useState<string>('38x25');
  const [lotId, setLotId] = useState<string | undefined>(search.get('lotId') ?? undefined);
  const [copies, setCopies] = useState<number>(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!wsId) return;
    listLots(wsId, params.firmId, { itemId: params.id }).then(setLots);
  }, [wsId, params.firmId, params.id]);

  // Revoke stale blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const blob = await getItemLabelPdf(wsId, params.firmId, params.id, {
        labelSize,
        lotId,
        copies,
      });
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || t('generateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => iframeRef.current?.contentWindow?.print();

  return (
    <div className="p-6">
      <DsPageHeader title={t('title')} icon={<PrinterOutlined />} style={{ marginBottom: 16 }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40% 60%',
          gap: 24,
        }}
      >
        {/* Left: controls */}
        <div>
          <h3
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--cr-text-4)',
              marginBottom: 8,
            }}
          >
            {t('labelSize')}
          </h3>
          <Radio.Group
            value={labelSize}
            onChange={(e) => setLabelSize(e.target.value)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {SIZES.map((s) => (
              <Radio key={s.value} value={s.value}>
                {s.label}
              </Radio>
            ))}
          </Radio.Group>

          <h3
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--cr-text-4)',
              marginBottom: 8,
            }}
          >
            {t('lotOptional')}
          </h3>
          <select
            value={lotId ?? ''}
            onChange={(e) => setLotId(e.target.value || undefined)}
            style={{ width: '100%', marginBottom: 16, padding: 8 }}
          >
            <option value="">{t('noLot')}</option>
            {lots.map((l) => (
              <option key={l._id} value={l._id}>
                {l.lotNo}
              </option>
            ))}
          </select>

          <h3
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--cr-text-4)',
              marginBottom: 8,
            }}
          >
            {t('copies')}
          </h3>
          <InputNumber
            min={1}
            max={500}
            value={copies}
            onChange={(v) => setCopies(Number(v) || 1)}
            style={{ width: '100%', marginBottom: 16 }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <DsButton dsVariant="primary" loading={loading} onClick={handleGenerate}>
              {t('generatePdf')}
            </DsButton>
            <DsButton dsVariant="ghost" disabled={!pdfUrl} onClick={handlePrint}>
              {t('printLabels')}
            </DsButton>
          </div>

          {error && <Alert type="error" title={error} style={{ marginTop: 12 }} />}
        </div>

        {/* Right: preview */}
        <div>
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 600,
              }}
            >
              <Spin />
            </div>
          ) : pdfUrl ? (
            <iframe
              ref={iframeRef}
              src={pdfUrl}
              style={{
                width: '100%',
                height: 600,
                border: '1px solid var(--cr-border)',
              }}
            />
          ) : (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--cr-text-3)',
                padding: 48,
                height: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed var(--cr-border)',
                borderRadius: 8,
              }}
            >
              {t('previewPrompt')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
