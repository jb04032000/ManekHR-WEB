'use client';
import React from 'react';
import { InputNumber, Input, Switch, Button, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import DsTable from '@/components/ui/DsTable';
import type { PurchaseLineItem } from '@/types';

interface Props {
  lineItems: PurchaseLineItem[];
  onChange: (next: PurchaseLineItem[]) => void;
  readOnly?: boolean;
}

const formatPaise = (v?: number) =>
  v !== undefined && v !== null
    ? `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : '-';

function recompute(item: PurchaseLineItem): PurchaseLineItem {
  const qty = item.qty || 0;
  const rate = item.ratePaise || 0;
  const discountPct = item.discountPct || 0;
  const taxRate = item.taxRate || 0;

  const grossPaise = qty * rate;
  const discountPaise = Math.round(grossPaise * (discountPct / 100));
  const taxableValuePaise = grossPaise - discountPaise;
  const totalGst = Math.round(taxableValuePaise * (taxRate / 100));

  // Intra-state: CGST + SGST; inter-state: IGST only - default to intra
  const halfGst = Math.round(totalGst / 2);
  const cgstPaise = halfGst;
  const sgstPaise = totalGst - halfGst;
  const igstPaise = 0;
  const lineTotalPaise = taxableValuePaise + totalGst;

  return {
    ...item,
    taxableValuePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    lineTotalPaise,
  };
}

export default function PurchaseBillLineItemsTable({ lineItems, onChange, readOnly }: Props) {
  const t = useTranslations('finance.purchases');
  const update = (idx: number, patch: Partial<PurchaseLineItem>) => {
    const updated = lineItems.map((item, i) =>
      i === idx ? recompute({ ...item, ...patch }) : item,
    );
    onChange(updated);
  };

  const addRow = () => {
    onChange([
      ...lineItems,
      recompute({
        itemName: '',
        qty: 1,
        ratePaise: 0,
        discountPct: 0,
        taxRate: 18,
        lineTotalPaise: 0,
        isCapitalGoods: false,
      }),
    ]);
  };

  const removeRow = (idx: number) => {
    onChange(lineItems.filter((_, i) => i !== idx));
  };

  const columns = [
    {
      title: t('editor.lineItemsTable.item'),
      dataIndex: 'itemName',
      key: 'itemName',
      width: 160,
      render: (v: string, _: PurchaseLineItem, idx: number) =>
        readOnly ? (
          <span>{v}</span>
        ) : (
          <Input
            value={v}
            placeholder={t('editor.lineItemsTable.itemNamePlaceholder')}
            onChange={(e) => update(idx, { itemName: e.target.value })}
            size="small"
          />
        ),
    },
    {
      title: t('editor.lineItemsTable.hsn'),
      dataIndex: 'hsnSacCode',
      key: 'hsnSacCode',
      width: 90,
      render: (v: string | undefined, _: PurchaseLineItem, idx: number) =>
        readOnly ? (
          <span>{v ?? '-'}</span>
        ) : (
          <Input
            value={v}
            placeholder={t('editor.lineItemsTable.hsnPlaceholder')}
            onChange={(e) => update(idx, { hsnSacCode: e.target.value })}
            size="small"
          />
        ),
    },
    {
      title: t('editor.lineItemsTable.qty'),
      dataIndex: 'qty',
      key: 'qty',
      width: 70,
      render: (v: number, _: PurchaseLineItem, idx: number) =>
        readOnly ? (
          <span>{v}</span>
        ) : (
          <InputNumber
            value={v}
            min={0}
            style={{ width: '100%' }}
            size="small"
            onChange={(val) => update(idx, { qty: val ?? 0 })}
          />
        ),
    },
    {
      title: t('editor.lineItemsTable.unit'),
      dataIndex: 'unit',
      key: 'unit',
      width: 60,
      render: (v: string | undefined, _: PurchaseLineItem, idx: number) =>
        readOnly ? (
          <span>{v ?? '-'}</span>
        ) : (
          <Input
            value={v}
            placeholder={t('editor.lineItemsTable.unitPlaceholder')}
            onChange={(e) => update(idx, { unit: e.target.value })}
            size="small"
          />
        ),
    },
    {
      title: t('editor.lineItemsTable.rate'),
      dataIndex: 'ratePaise',
      key: 'ratePaise',
      width: 100,
      render: (v: number, _: PurchaseLineItem, idx: number) =>
        readOnly ? (
          <span>{formatPaise(v)}</span>
        ) : (
          <InputNumber
            value={v / 100}
            min={0}
            precision={2}
            style={{ width: '100%' }}
            size="small"
            onChange={(val) => update(idx, { ratePaise: Math.round((val ?? 0) * 100) })}
          />
        ),
    },
    {
      title: t('editor.lineItemsTable.discPct'),
      dataIndex: 'discountPct',
      key: 'discountPct',
      width: 70,
      render: (v: number | undefined, _: PurchaseLineItem, idx: number) =>
        readOnly ? (
          <span>{v ?? 0}%</span>
        ) : (
          <InputNumber
            value={v ?? 0}
            min={0}
            max={100}
            style={{ width: '100%' }}
            size="small"
            onChange={(val) => update(idx, { discountPct: val ?? 0 })}
          />
        ),
    },
    {
      title: t('editor.lineItemsTable.taxPct'),
      dataIndex: 'taxRate',
      key: 'taxRate',
      width: 70,
      render: (v: number | undefined, _: PurchaseLineItem, idx: number) =>
        readOnly ? (
          <span>{v ?? 0}%</span>
        ) : (
          <InputNumber
            value={v ?? 0}
            min={0}
            max={100}
            style={{ width: '100%' }}
            size="small"
            onChange={(val) => update(idx, { taxRate: val ?? 0 })}
          />
        ),
    },
    {
      title: t('editor.lineItemsTable.taxable'),
      dataIndex: 'taxableValuePaise',
      key: 'taxableValuePaise',
      width: 100,
      align: 'right' as const,
      render: (v?: number) => formatPaise(v),
    },
    {
      title: t('editor.lineItemsTable.cgst'),
      dataIndex: 'cgstPaise',
      key: 'cgstPaise',
      width: 90,
      align: 'right' as const,
      render: (v?: number) => formatPaise(v),
    },
    {
      title: t('editor.lineItemsTable.sgst'),
      dataIndex: 'sgstPaise',
      key: 'sgstPaise',
      width: 90,
      align: 'right' as const,
      render: (v?: number) => formatPaise(v),
    },
    {
      title: t('editor.lineItemsTable.igst'),
      dataIndex: 'igstPaise',
      key: 'igstPaise',
      width: 90,
      align: 'right' as const,
      render: (v?: number) => formatPaise(v),
    },
    {
      title: t('editor.lineItemsTable.total'),
      dataIndex: 'lineTotalPaise',
      key: 'lineTotalPaise',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <Typography.Text strong>{formatPaise(v)}</Typography.Text>,
    },
    {
      title: t('editor.lineItemsTable.capGoods'),
      dataIndex: 'isCapitalGoods',
      key: 'isCapitalGoods',
      width: 90,
      align: 'center' as const,
      render: (v: boolean | undefined, _: PurchaseLineItem, idx: number) =>
        readOnly ? (
          <span>{v ? t('editor.lineItemsTable.yes') : t('editor.lineItemsTable.no')}</span>
        ) : (
          <Switch
            checked={!!v}
            size="small"
            onChange={(checked) => update(idx, { isCapitalGoods: checked })}
          />
        ),
    },
    ...(!readOnly
      ? [
          {
            title: <span className="sr-only">{t('editor.lineItemsTable.delete')}</span>,
            key: 'actions',
            width: 40,
            render: (_: unknown, __: PurchaseLineItem, idx: number) => (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => removeRow(idx)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <DsTable
        dataSource={lineItems}
        columns={columns}
        rowKey={(_, idx) => String(idx)}
        pagination={false}
        size="small"
        scrollX={readOnly ? 900 : 1200}
      />
      {!readOnly && (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addRow}
          style={{ marginTop: 8, width: '100%' }}
        >
          {t('editor.lineItemsTable.addRow')}
        </Button>
      )}
    </div>
  );
}
