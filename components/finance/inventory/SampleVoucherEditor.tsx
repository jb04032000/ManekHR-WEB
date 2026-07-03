'use client';
// Finance polish (inventory): user-facing strings localised via finance.inventory.editor
// (shared) + .editor.sample (screen-specific). Used by the samples new/[id] pages.
// No data/validation logic changed.
import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Form,
  Input,
  DatePicker,
  InputNumber,
  Select,
  Radio,
  Popconfirm,
  message,
  Button,
  Table,
} from 'antd';
import dayjs from 'dayjs';
import dynamic from 'next/dynamic';
import { ScanOutlined } from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';
import DsCard from '@/components/ui/DsCard';
import { GodownSelector } from './GodownSelector';
import { LotPicker } from './LotPicker';
import { ItemAutoComplete } from '../ItemAutoComplete';
import {
  createSampleVoucher,
  updateSampleVoucher,
  postSampleVoucher,
} from '@/lib/actions/inventory.actions';
import { listParties } from '@/lib/actions/finance.actions';
import type { SampleVoucher, SampleVoucherLine, Party } from '@/types';

const BarcodeScanModal = dynamic(() => import('./BarcodeScanModal'), {
  ssr: false,
});

interface Line extends SampleVoucherLine {
  _key: string;
  itemTrackBatch?: boolean;
}

interface Props {
  workspaceId: string;
  firmId: string;
  initial?: SampleVoucher | null;
  viewOnly?: boolean;
}

export function SampleVoucherEditor({ workspaceId, firmId, initial, viewOnly }: Props) {
  const router = useRouter();
  const t = useTranslations('finance.inventory.editor');
  const [form] = Form.useForm();
  const [lines, setLines] = useState<Line[]>([]);
  const [scanLineKey, setScanLineKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const isPosted =
    initial?.status === 'sent' ||
    initial?.status === 'partially_accepted' ||
    initial?.status === 'fully_accepted' ||
    initial?.status === 'rejected_returned' ||
    initial?.status === 'overdue';
  const readonly = viewOnly || isPosted;

  useEffect(() => {
    listParties(workspaceId, firmId)
      .then((r) => setParties((r as { items?: Party[] })?.items ?? []))
      .catch(() => {});
  }, [workspaceId, firmId]);

  useEffect(() => {
    if (initial) {
      form.setFieldsValue({
        sampleType: initial.sampleType,
        date: dayjs(initial.date),
        partyId: initial.partyId,
        expectedReturnDate: dayjs(initial.expectedReturnDate),
        autoAlarmDays: initial.autoAlarmDays,
        narration: initial.narration,
      });
      startTransition(() => {
        setLines(initial.lines.map((l, i) => ({ ...l, _key: `l${i}` })));
      });
    } else {
      form.setFieldsValue({
        sampleType: 'sample',
        date: dayjs(),
        autoAlarmDays: 7,
      });
      startTransition(() => {
        setLines([]);
      });
    }
  }, [initial, form]);

  const addLine = () =>
    setLines([
      ...lines,
      {
        _key: `l${Date.now()}`,
        itemId: '',
        godownId: '',
        qty: 0,
        acceptedQty: 0,
        returnedQty: 0,
      },
    ]);

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines(lines.map((l) => (l._key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) => setLines(lines.filter((l) => l._key !== key));

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        sampleType: values.sampleType,
        date: dayjs(values.date).toISOString(),
        partyId: values.partyId,
        expectedReturnDate: dayjs(values.expectedReturnDate).toISOString(),
        autoAlarmDays: values.autoAlarmDays ?? 7,
        lines: lines.map(({ _key, itemTrackBatch, ...l }) => l),
        narration: values.narration,
      };
      if (initial) {
        await updateSampleVoucher(workspaceId, firmId, initial._id, payload);
        message.success(t('sample.updated'));
      } else {
        const created = await createSampleVoucher(workspaceId, firmId, payload);
        message.success(t('draftSaved'));
        router.replace(`/dashboard/finance/firms/${firmId}/inventory/samples/${created._id}`);
      }
    } catch (err: unknown) {
      const e = err as { errorFields?: unknown; message?: string };
      if (!e?.errorFields) message.error(e?.message ?? t('failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    if (!initial) return;
    try {
      setSaving(true);
      await postSampleVoucher(workspaceId, firmId, initial._id);
      message.success(t('postedSuccess', { voucher: initial.voucherNo }));
      router.refresh();
    } catch (err: unknown) {
      const e = err as { message?: string };
      message.error(t('cannotPost', { error: e?.message ?? 'unknown error' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form form={form} layout="vertical">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Form.Item name="sampleType" label={t('sample.type')} rules={[{ required: true }]}>
          <Radio.Group disabled={readonly}>
            <Radio value="sample">{t('sample.sample')}</Radio>
            <Radio value="consignment">{t('sample.consignment')}</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="date" label={t('date')} rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} disabled={readonly} />
        </Form.Item>
        <Form.Item
          name="partyId"
          label={t('sample.party')}
          rules={[{ required: true, message: t('sample.selectPartyRequired') }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            disabled={readonly}
            placeholder={t('sample.selectParty')}
            style={{ width: '100%' }}
            options={parties.map((p) => ({ value: p._id, label: p.name }))}
          />
        </Form.Item>
        <Form.Item
          name="expectedReturnDate"
          label={t('sample.expectedReturnDate')}
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: '100%' }} disabled={readonly} />
        </Form.Item>
        <Form.Item name="autoAlarmDays" label={t('sample.autoAlarmDays')}>
          <InputNumber min={1} max={90} style={{ width: '100%' }} disabled={readonly} />
        </Form.Item>
      </div>

      <DsCard style={{ marginBottom: 16 }}>
        <Table
          dataSource={lines}
          rowKey="_key"
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: <span className="sr-only">{t('scan')}</span>,
              width: 40,
              render: (_: unknown, r: Line) => (
                <Button
                  type="text"
                  size="small"
                  icon={<ScanOutlined />}
                  aria-label={t('scanBarcode')}
                  onClick={() => setScanLineKey(r._key)}
                />
              ),
            },
            {
              title: t('item'),
              dataIndex: 'itemId',
              width: 180,
              render: (v: string, r: Line) => (
                <ItemAutoComplete
                  value={v}
                  disabled={readonly}
                  wsId={workspaceId}
                  firmId={firmId}
                  onChange={(val) => updateLine(r._key, { itemId: val })}
                />
              ),
            },
            {
              title: t('godown'),
              width: 180,
              render: (_: unknown, r: Line) => (
                <GodownSelector
                  firmId={firmId}
                  workspaceId={workspaceId}
                  value={r.godownId}
                  onChange={(v) => updateLine(r._key, { godownId: v })}
                  disabled={readonly}
                />
              ),
            },
            {
              title: t('lot'),
              width: 150,
              render: (_: unknown, r: Line) =>
                r.itemTrackBatch ? (
                  <LotPicker
                    workspaceId={workspaceId}
                    firmId={firmId}
                    itemId={r.itemId}
                    godownId={r.godownId}
                    value={r.lotId}
                    onChange={(v) => updateLine(r._key, { lotId: v })}
                    disabled={readonly}
                  />
                ) : (
                  '-'
                ),
            },
            {
              title: t('qty'),
              width: 100,
              render: (_: unknown, r: Line) => (
                <InputNumber
                  min={0}
                  value={r.qty}
                  disabled={readonly}
                  onChange={(v) => updateLine(r._key, { qty: Number(v) })}
                />
              ),
            },
            {
              title: t('rate'),
              width: 120,
              render: (_: unknown, r: Line) => (
                <InputNumber
                  min={0}
                  precision={2}
                  value={r.rate !== undefined ? r.rate / 100 : undefined}
                  disabled={readonly}
                  onChange={(v) =>
                    updateLine(r._key, {
                      rate: v !== null ? Math.round(Number(v) * 100) : undefined,
                    })
                  }
                  prefix="₹"
                  placeholder={t('sample.rateIndicative')}
                />
              ),
            },
            {
              title: t('remarks'),
              width: 150,
              render: (_: unknown, r: Line) => (
                <Input
                  value={r.remarks}
                  disabled={readonly}
                  onChange={(e) => updateLine(r._key, { remarks: e.target.value })}
                  placeholder={t('remarksPlaceholder')}
                />
              ),
            },
            {
              title: <span className="sr-only">{t('deleteCol')}</span>,
              width: 60,
              render: (_: unknown, r: Line) =>
                !readonly && (
                  <Button type="link" danger size="small" onClick={() => removeLine(r._key)}>
                    {t('remove')}
                  </Button>
                ),
            },
          ]}
          footer={() =>
            !readonly && (
              <Button type="dashed" block onClick={addLine}>
                {t('addLine')}
              </Button>
            )
          }
        />
      </DsCard>

      <Form.Item name="narration" label={t('narration')}>
        <Input.TextArea rows={2} disabled={readonly} />
      </Form.Item>

      {!readonly && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            position: 'sticky',
            bottom: 0,
            background: 'var(--cr-surface)',
            padding: 16,
            borderTop: '1px solid var(--cr-border)',
          }}
        >
          <DsButton dsVariant="ghost" onClick={() => router.back()}>
            {t('cancel')}
          </DsButton>
          <DsButton dsVariant="ghost" onClick={handleSaveDraft} loading={saving}>
            {t('saveDraft')}
          </DsButton>
          {initial && (
            <Popconfirm
              title={t('sample.postConfirmTitle')}
              description={t('sample.postConfirmDesc')}
              okText={t('postVoucher')}
              cancelText={t('cancel')}
              onConfirm={handlePost}
            >
              <DsButton dsVariant="primary" loading={saving}>
                {t('postVoucher')}
              </DsButton>
            </Popconfirm>
          )}
        </div>
      )}

      {scanLineKey && (
        <BarcodeScanModal
          open={!!scanLineKey}
          onClose={() => setScanLineKey(null)}
          onScan={(value) => {
            updateLine(scanLineKey, { itemId: value });
            setScanLineKey(null);
          }}
        />
      )}
    </Form>
  );
}
