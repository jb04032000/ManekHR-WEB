'use client';
/**
 * Editable line-items table for the voucher editor.
 * Per F-02 UI-SPEC. Calls useLineItems internally. Supports Alt+N to add a row.
 * Item autocomplete: debounced AntD Select calling /items?q=... endpoint.
 */
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  Select,
  InputNumber,
  Button,
  Tooltip,
  Modal,
  Form,
  Input,
  App,
  AutoComplete,
  Popover,
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  WarningOutlined,
  CalculatorOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Control } from 'react-hook-form';
import { useLineItems } from '@/hooks/useLineItems';
import { useDebounce } from '@/hooks/useDebounce';
import { useWorkspaceStore } from '@/lib/store';
import http, { unwrap } from '@/lib/api/client';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { createItem } from '@/lib/actions/finance.actions';
// R11: reuse the inventory LotPicker on sales rows so a lot-tracked item can be billed from a
// specific lot; the chosen lotId persists on the line and InventoryService.stockOut decrements it.
import { LotPicker } from '@/components/finance/inventory/LotPicker';
import type { LineItem, FinanceItem } from '@/types';
import { useState, useCallback, startTransition } from 'react';

const TAX_OPTIONS = [0, 5, 12, 18, 28].map((v) => ({ value: v, label: `${v}%` }));

interface ItemSuggestion {
  _id: string;
  name: string;
  hsnSacCode?: string;
  unit?: string;
  defaultRate?: number;
  gstRate?: number;
}

function usePaiseFormatter() {
  return (paise?: number) =>
    paise == null ? '-' : '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

interface ItemAutoCompleteProps {
  value: string;
  onChange: (val: string, item?: ItemSuggestion) => void;
  wsId: string;
  firmId: string;
  /** Fired when the search has text but no match and the user clicks "Create X".
   *  Lets the caller open an inline item-create flow seeded with the typed name. */
  onCreateNew?: (text: string) => void;
  /** Keeps the chosen item's name visible after the search options reset (e.g. an
   *  inline-created item that is not in the last search results). */
  selectedLabel?: string;
}

function ItemAutoComplete({
  value,
  onChange,
  wsId,
  firmId,
  onCreateNew,
  selectedLabel,
}: ItemAutoCompleteProps) {
  const t = useTranslations('finance.sales');
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<ItemSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      startTransition(() => {
        setOptions([]);
      });
      return;
    }
    startTransition(() => {
      setLoading(true);
    });
    http
      .get(`workspaces/${wsId}/finance/firms/${firmId}/items`, {
        params: { q: debouncedSearch, limit: 10 },
      })
      .then((res) => {
        const data = unwrap<ItemSuggestion[] | { data: ItemSuggestion[] }>(res);
        setOptions(Array.isArray(data) ? data : ((data as { data: ItemSuggestion[] }).data ?? []));
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [debouncedSearch, wsId, firmId]);

  // Keep the selected item's name visible even after the search options reset.
  const mergedOptions = [
    ...(value && selectedLabel && !options.some((o) => o._id === value)
      ? [{ value, label: selectedLabel }]
      : []),
    ...options.map((o) => ({ value: o._id, label: o.name })),
  ];

  return (
    <Select
      showSearch
      filterOption={false}
      value={value || undefined}
      placeholder={t('editor.grid.searchItem')}
      style={{ width: '100%', minWidth: 160 }}
      onSearch={setSearch}
      // R8: Alt+C inline-creates an item from whatever is typed in the search box.
      onKeyDown={(e) => {
        if (
          e.altKey &&
          (e.key === 'c' || e.key === 'C') &&
          onCreateNew &&
          search.trim().length >= 2
        ) {
          e.preventDefault();
          onCreateNew(search.trim());
        }
      }}
      loading={loading}
      notFoundContent={
        onCreateNew && search.trim().length >= 2 && !loading ? (
          <div style={{ padding: '6px 4px' }}>
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onCreateNew(search.trim())}
            >
              {t('editor.grid.createItem', { name: search.trim() })}
            </Button>
          </div>
        ) : undefined
      }
      onChange={(val) => {
        const found = options.find((o) => o._id === val);
        onChange(val, found);
      }}
      options={mergedOptions}
    />
  );
}

interface HsnResult {
  code: string;
  description: string;
  gstRate: number;
}

// Plain-language HSN/SAC picker (D18): type "saree"/"dyeing"/"dalali" or a code, pick a
// result to fill the code AND suggest its GST rate. Built as an AutoComplete so a free-typed
// code still works (items whose HSN isn't in the directory). Hits the cached search endpoint.
// value/onChange are injected by the wrapping Form.Item (binds hsnSacCode); onRate sets the
// sibling gstRate field on pick.
function HsnPicker({
  value,
  onChange,
  onRate,
  wsId,
  firmId,
}: {
  value?: string;
  onChange?: (val: string) => void;
  onRate: (rate: number) => void;
  wsId: string;
  firmId: string;
}) {
  const t = useTranslations('finance.sales');
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<HsnResult[]>([]);
  const debounced = useDebounce(search, 350);

  useEffect(() => {
    if (!debounced || debounced.length < 2) {
      startTransition(() => setOptions([]));
      return;
    }
    http
      .get(`workspaces/${wsId}/finance/hsn/search`, { params: { q: debounced, limit: 10 } })
      .then((res) => {
        const data = unwrap<HsnResult[] | { data: HsnResult[] }>(res);
        setOptions(Array.isArray(data) ? data : ((data as { data: HsnResult[] }).data ?? []));
      })
      .catch(() => setOptions([]));
  }, [debounced, wsId, firmId]);

  return (
    <AutoComplete
      value={value}
      style={{ width: '100%' }}
      placeholder={t('editor.grid.hsnPlaceholder')}
      onSearch={setSearch}
      onChange={(v) => onChange?.(v as string)}
      onSelect={(code) => {
        const found = options.find((o) => o.code === code);
        onChange?.(code as string);
        if (found) onRate(found.gstRate);
      }}
      options={options.map((o) => ({
        value: o.code,
        label: `${o.code} - ${o.description} (${o.gstRate}%)`,
      }))}
    />
  );
}

interface LineItemsTableProps {
  control: Control<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  firmId: string;
  wsId: string;
  /** Invoice/voucher date used for the as-of HSN rate-master lookup. Defaults to today. */
  voucherDate?: string | Date;
  /** Tax context (state codes + rounding) so the per-line CGST/SGST-vs-IGST
   *  columns match the totals footer and the posted invoice. Defaults to a
   *  neutral intra-state context when omitted (e.g. a recurring template that
   *  has no party / place-of-supply yet). */
  taxContext?: {
    firmStateCode: string;
    partyStateCode: string;
    placeOfSupplyStateCode: string;
    roundingPolicy: 'half_up' | 'round_off_to_rupee';
  };
  /** Phase 1b: the selected party's remembered per-item rates (itemId -> ratePaise). When
   *  a repeat item is chosen we pre-fill the LAST price charged to this party instead of
   *  the item-master default. Sourced from the backend FieldPredictionMemory store. */
  partyItemRates?: Record<string, number>;
}

/** Master GST rate looked up for a line's HSN, used to default + warn at entry. */
interface MasterRateHint {
  rate: number;
  prefix: string;
}

// D13 dual-unit (taka/than -> meters): a compact opt-in calculator on the Qty cell. The user enters
// a secondary quantity (e.g. 5 thans) and how much one equals in the billing unit (e.g. 100 m); it
// sets the primary qty = secondaryQty x conversion. Web-only helper - the billing qty (which drives
// tax + amount) stays the single source of truth; the breakdown is not persisted in this slice.
function DualUnitPopover({
  label,
  intro,
  secLabel,
  convLabel,
  applyLabel,
  resultLabel,
  unitLabel,
  onApply,
}: {
  label: string;
  intro: string;
  secLabel: string;
  convLabel: string;
  applyLabel: string;
  resultLabel: (q: number) => string;
  unitLabel: string;
  // R11: returns the computed billing qty PLUS the breakdown so it can be persisted on the line
  // (schema secondaryQty/conversionFactor/secondaryUnit) and printed (e.g. "5 than x 100 m").
  onApply: (payload: {
    qty: number;
    secondaryQty: number;
    conversionFactor: number;
    secondaryUnit: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sec, setSec] = useState<number | null>(null);
  const [conv, setConv] = useState<number | null>(null);
  const [secUnit, setSecUnit] = useState('than'); // R11: secondary unit name (taka/than)
  const result = Math.round((sec ?? 0) * (conv ?? 0) * 10000) / 10000;
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      content={
        <div style={{ width: 210 }}>
          <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--cr-text-2)' }}>{intro}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Input
              size="small"
              style={{ width: '100%' }}
              placeholder={unitLabel}
              value={secUnit}
              onChange={(e) => setSecUnit(e.target.value)}
            />
            <InputNumber
              size="small"
              min={0}
              style={{ width: '100%' }}
              placeholder={secLabel}
              value={sec}
              onChange={setSec}
            />
            <InputNumber
              size="small"
              min={0}
              style={{ width: '100%' }}
              placeholder={convLabel}
              value={conv}
              onChange={setConv}
            />
            <div style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>{resultLabel(result)}</div>
            <Button
              size="small"
              type="primary"
              disabled={result <= 0}
              onClick={() => {
                onApply({
                  qty: result,
                  secondaryQty: sec ?? 0,
                  conversionFactor: conv ?? 0,
                  secondaryUnit: secUnit.trim(),
                });
                setOpen(false);
              }}
            >
              {applyLabel}
            </Button>
          </div>
        </div>
      }
    >
      <Button
        type="text"
        size="small"
        icon={<CalculatorOutlined />}
        aria-label={label}
        style={{ padding: 0, width: 18, minWidth: 18 }}
      />
    </Popover>
  );
}

export function LineItemsTable({
  control,
  firmId,
  wsId,
  voucherDate,
  taxContext: taxContextProp,
  partyItemRates,
}: LineItemsTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const fmt = usePaiseFormatter();
  // Per-line master GST rate hint (keyed by row index), populated on item select.
  const [masterRates, setMasterRates] = useState<Record<number, MasterRateHint | null>>({});

  // Inline item-create: a "Create X" affordance in the item search opens this modal,
  // creates the item via the items API, then drops it into the row that triggered it.
  const { message } = App.useApp();
  const t = useTranslations('finance.sales');
  const [itemCreateOpen, setItemCreateOpen] = useState(false);
  const [itemCreating, setItemCreating] = useState(false);
  const itemCreateRow = useRef<number | null>(null);
  const [itemForm] = Form.useForm();

  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const effectiveWsId = wsId || ws?._id || '';

  // Real tax context from the editor (state codes drive the CGST/SGST-vs-IGST
  // columns). Neutral intra-state default when no context is supplied.
  const taxContext = taxContextProp ?? {
    firmStateCode: '',
    partyStateCode: '',
    placeOfSupplyStateCode: '',
    roundingPolicy: 'half_up' as const,
  };

  const { fields, lines, addLine, addServiceLine, removeLine, updateLine, taxResult } =
    useLineItems({ control, taxContext });

  // Alt+N keyboard shortcut - owned by this component
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        addLine();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addLine]);

  const asOfDate = useCallback((): string | undefined => {
    if (!voucherDate) return undefined;
    const d = voucherDate instanceof Date ? voucherDate : new Date(voucherDate);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  }, [voucherDate]);

  const handleItemSelect = useCallback(
    (index: number, _itemId: string, item?: ItemSuggestion) => {
      if (!item) return;
      // Phase 1b: pre-fill the LAST rate charged to this party for this item if we
      // remember one; otherwise fall back to the item-master default rate.
      const rememberedRate = partyItemRates?.[item._id];
      const rate = typeof rememberedRate === 'number' ? rememberedRate : (item.defaultRate ?? 0);
      // Build the full row once so the async rate-default below cannot clobber
      // the freshly selected item with a stale closure value.
      const nextLine: LineItem = {
        ...lines[index],
        itemId: item._id,
        itemName: item.name,
        hsnSacCode: item.hsnSacCode ?? '',
        unit: item.unit ?? 'NOS',
        ratePaise: rate,
        rateCentiPaise: rate * 100,
        taxRate: (item.gstRate as LineItem['taxRate']) ?? 18,
      };
      updateLine(index, nextLine);

      // 2b: validate the tax rate against the HSN rate master. Default the rate
      // when the item carries no gstRate; otherwise keep a hint to warn on drift.
      const hsn = (item.hsnSacCode ?? '').trim();
      if (!hsn || !effectiveWsId || !firmId) {
        setMasterRates((prev) => ({ ...prev, [index]: null }));
        return;
      }
      financeSalesApi.invoices
        .gstRate(effectiveWsId, firmId, hsn, asOfDate())
        .then((res) => {
          if (!res.found || typeof res.totalRate !== 'number') {
            setMasterRates((prev) => ({ ...prev, [index]: null }));
            return;
          }
          const masterRate = res.totalRate;
          setMasterRates((prev) => ({
            ...prev,
            [index]: { rate: masterRate, prefix: res.matchedPrefix ?? hsn },
          }));
          // Item brought no gstRate of its own: adopt the master rate.
          if (item.gstRate == null) {
            updateLine(index, { ...nextLine, taxRate: masterRate as LineItem['taxRate'] });
          }
        })
        .catch(() => setMasterRates((prev) => ({ ...prev, [index]: null })));
    },
    [lines, updateLine, effectiveWsId, firmId, asOfDate, partyItemRates],
  );

  const applyMasterRate = useCallback(
    (index: number) => {
      const hint = masterRates[index];
      if (!hint) return;
      updateLine(index, { ...lines[index], taxRate: hint.rate as LineItem['taxRate'] });
    },
    [masterRates, lines, updateLine],
  );

  const openItemCreate = useCallback(
    (index: number, presetName: string) => {
      itemCreateRow.current = index;
      itemForm.setFieldsValue({
        name: presetName,
        itemType: 'goods',
        unit: 'NOS',
        gstRate: 18,
        hsnSacCode: '',
      });
      setItemCreateOpen(true);
    },
    [itemForm],
  );

  const submitItemCreate = useCallback(async () => {
    let values: Record<string, unknown>;
    try {
      values = await itemForm.validateFields();
    } catch {
      return; // validation errors render inline
    }
    setItemCreating(true);
    try {
      const created = await createItem(effectiveWsId, firmId, values as Partial<FinanceItem>);
      message.success(t('editor.grid.itemCreated', { name: created.name }));
      setItemCreateOpen(false);
      const row = itemCreateRow.current;
      if (row != null) {
        // Drop the new item into the originating row (fills HSN/unit/rate/gst).
        handleItemSelect(row, created._id, {
          _id: created._id,
          name: created.name,
          hsnSacCode: created.hsnSacCode,
          unit: created.unit,
          gstRate: created.gstRate,
          defaultRate: 0,
        });
      }
    } catch {
      message.error(t('editor.grid.createFailed'));
    } finally {
      setItemCreating(false);
    }
  }, [itemForm, effectiveWsId, firmId, message, handleItemSelect, t]);

  const isIntraState = taxContext.firmStateCode === taxContext.placeOfSupplyStateCode;

  const columns: ColumnsType<LineItem & { id: string }> = [
    {
      title: '#',
      key: 'index',
      width: 40,
      render: (_v, _r, i) => i + 1,
    },
    {
      title: t('editor.grid.colItem'),
      key: 'item',
      width: 180,
      render: (_v, _r, i) => (
        <ItemAutoComplete
          value={lines[i]?.itemId ?? ''}
          selectedLabel={lines[i]?.itemName}
          onChange={(val, item) => handleItemSelect(i, val, item)}
          onCreateNew={(text) => openItemCreate(i, text)}
          wsId={effectiveWsId}
          firmId={firmId}
        />
      ),
    },
    {
      title: t('editor.grid.colHsn'),
      key: 'hsn',
      width: 90,
      render: (_v, _r, i) => (
        <span style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>
          {lines[i]?.hsnSacCode || '-'}
        </span>
      ),
    },
    {
      title: t('editor.grid.colQty'),
      key: 'qty',
      width: 92,
      render: (_v, _r, i) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <InputNumber
            min={0}
            size="small"
            value={lines[i]?.qty ?? 1}
            onChange={(v) => updateLine(i, { ...lines[i], qty: v ?? 1 })}
            style={{ width: 60 }}
          />
          <DualUnitPopover
            label={t('editor.grid.dualUnit.label')}
            intro={t('editor.grid.dualUnit.intro')}
            secLabel={t('editor.grid.dualUnit.secondaryQty')}
            convLabel={t('editor.grid.dualUnit.conversion')}
            applyLabel={t('editor.grid.dualUnit.apply')}
            unitLabel={t('editor.grid.dualUnit.secondaryUnit')}
            resultLabel={(q) => t('editor.grid.dualUnit.result', { qty: q })}
            // R11: persist the breakdown alongside the computed billing qty so it prints
            // (e.g. "5 than x 100 m") and survives reload.
            onApply={(p) =>
              updateLine(i, {
                ...lines[i],
                qty: p.qty,
                secondaryQty: p.secondaryQty,
                conversionFactor: p.conversionFactor,
                secondaryUnit: p.secondaryUnit,
              })
            }
          />
        </div>
      ),
    },
    {
      title: t('editor.grid.colUnit'),
      key: 'unit',
      width: 72,
      // R11: unit is now editable (was a read-only label). Free text so textile units
      // (than, taka, meter, kg) can be typed; defaults to NOS.
      render: (_v, _r, i) => (
        <Input
          size="small"
          value={lines[i]?.unit ?? ''}
          placeholder="NOS"
          onChange={(e) => updateLine(i, { ...lines[i], unit: e.target.value })}
          style={{ width: 64 }}
        />
      ),
    },
    {
      // R11: lot/bale picker on the row. Only shown once an item is chosen; lists lots with
      // stock remaining (empty for non-lot-tracked items). Binds line.lotId, which the backend
      // stock-out decrements on post. Pass the line's godown so lots are scoped to it.
      title: t('editor.grid.colLot'),
      key: 'lot',
      width: 150,
      render: (_v, _r, i) =>
        lines[i]?.itemId ? (
          <LotPicker
            workspaceId={effectiveWsId}
            firmId={firmId}
            itemId={String(lines[i].itemId)}
            godownId={lines[i]?.godownId ? String(lines[i].godownId) : undefined}
            value={lines[i]?.lotId ? String(lines[i].lotId) : undefined}
            onChange={(lotId) => updateLine(i, { ...lines[i], lotId })}
          />
        ) : (
          <span style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>-</span>
        ),
    },
    {
      title: <Tooltip title={t('editor.grid.rateTooltip')}>{t('editor.grid.colRate')}</Tooltip>,
      key: 'rate',
      width: 100,
      render: (_v, _r, i) => (
        <InputNumber
          min={0}
          size="small"
          value={(lines[i]?.rateCentiPaise ?? (lines[i]?.ratePaise ?? 0) * 100) / 10000}
          onChange={(v) =>
            updateLine(i, {
              ...lines[i],
              rateCentiPaise: Math.round((v ?? 0) * 10000),
              ratePaise: Math.round((v ?? 0) * 100),
            })
          }
          formatter={(v) => `₹${v}`}
          parser={(v) => (v ? parseFloat(v.replace('₹', '')) : 0) as unknown as 0}
          style={{ width: 90 }}
        />
      ),
    },
    {
      title: t('editor.grid.colDisc'),
      key: 'disc',
      width: 70,
      render: (_v, _r, i) => (
        <InputNumber
          min={0}
          max={100}
          size="small"
          value={lines[i]?.discountPct ?? 0}
          onChange={(v) => updateLine(i, { ...lines[i], discountPct: v ?? 0 })}
          style={{ width: 60 }}
        />
      ),
    },
    {
      title: t('editor.grid.colTaxable'),
      key: 'taxable',
      width: 104,
      render: (_v, _r, i) => (
        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--cr-text)' }}>
          {fmt(taxResult.lines[i]?.taxableValuePaise)}
        </span>
      ),
    },
    {
      // Combined GST cell: editable rate + the derived split label (IGST vs CGST+SGST).
      // The per-rate money breakdown now lives in the summary rail, so the row stays compact.
      title: t('editor.grid.colGst'),
      key: 'tax',
      width: 116,
      render: (_v, _r, i) => {
        const hint = masterRates[i];
        const current = lines[i]?.taxRate ?? 18;
        const mismatch = hint != null && hint.rate !== current;
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Select
                size="small"
                value={current}
                options={TAX_OPTIONS}
                onChange={(v) => updateLine(i, { ...lines[i], taxRate: v as LineItem['taxRate'] })}
                style={{ width: 72 }}
                status={mismatch ? 'warning' : undefined}
              />
              {mismatch && (
                <Tooltip
                  title={t('editor.grid.masterRateTooltip', {
                    prefix: hint!.prefix,
                    rate: hint!.rate,
                  })}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<WarningOutlined style={{ color: 'var(--cr-warning, #d48806)' }} />}
                    onClick={() => applyMasterRate(i)}
                    aria-label={t('editor.grid.masterRateAria', {
                      rate: hint!.rate,
                      prefix: hint!.prefix,
                    })}
                    style={{ padding: 0, width: 18, minWidth: 18 }}
                  />
                </Tooltip>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--cr-text-3)', marginTop: 2 }}>
              {current === 0
                ? t('editor.grid.noGst')
                : isIntraState
                  ? t('editor.grid.cgstSgst', { rate: current })
                  : t('editor.grid.igst', { rate: current })}
            </div>
          </div>
        );
      },
    },
    {
      title: t('editor.grid.colAmount'),
      key: 'amount',
      width: 100,
      fixed: 'right' as const,
      render: (_v, _r, i) => fmt(taxResult.lines[i]?.lineTotalPaise),
    },
    {
      title: <span className="sr-only">{t('editor.grid.colDelete')}</span>,
      key: 'del',
      width: 40,
      fixed: 'right' as const,
      render: (_v, _r, i) => (
        <Tooltip title={t('editor.grid.removeLine')}>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => removeLine(i)}
            aria-label={t('editor.grid.removeLineAria')}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div ref={tableRef}>
      <Table
        dataSource={fields as unknown as (LineItem & { id: string })[]}
        columns={columns}
        rowKey="id"
        size="middle"
        bordered={false}
        pagination={false}
        scroll={{ x: 'max-content' }}
        style={{ marginBottom: 0 }}
        locale={{
          emptyText: (
            <div style={{ padding: '26px 0 22px', color: 'var(--cr-text-3)', fontSize: 13 }}>
              {/* R12: i18n empty state. Rich <add> chunk keeps the bolded "Add item" inline. */}
              {t.rich('editor.grid.emptyItems', {
                add: (chunks) => <strong style={{ color: 'var(--cr-text-2)' }}>{chunks}</strong>,
              })}
            </div>
          ),
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 0 2px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addLine}>
            Add item <span style={{ opacity: 0.5, fontSize: 11 }}>Alt+N</span>
          </Button>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addServiceLine}>
            Add service
          </Button>
        </div>
        <span style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>
          <strong style={{ color: 'var(--cr-text-2)' }}>{lines.length}</strong> line
          {lines.length === 1 ? '' : 's'} ·{' '}
          <strong style={{ color: 'var(--cr-text-2)' }}>
            {lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)}
          </strong>{' '}
          units
        </span>
      </div>

      <Modal
        title={t('editor.grid.modalTitle')}
        open={itemCreateOpen}
        onCancel={() => setItemCreateOpen(false)}
        onOk={submitItemCreate}
        okText={t('editor.grid.modalOk')}
        confirmLoading={itemCreating}
        destroyOnHidden
      >
        <Form form={itemForm} layout="vertical" requiredMark="optional">
          <Form.Item label={t('editor.grid.fieldName')} name="name" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item
            label={t('editor.grid.fieldType')}
            name="itemType"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'goods', label: t('editor.grid.typeGoods') },
                { value: 'services', label: t('editor.grid.typeService') },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('editor.grid.fieldUnit')} name="unit" rules={[{ required: true }]}>
            <Input placeholder={t('editor.grid.unitPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('editor.grid.fieldHsn')} name="hsnSacCode">
            <HsnPicker
              wsId={effectiveWsId}
              firmId={firmId}
              onRate={(rate) => itemForm.setFieldsValue({ gstRate: rate })}
            />
          </Form.Item>
          <Form.Item
            label={t('editor.grid.fieldGstRate')}
            name="gstRate"
            rules={[{ required: true }]}
          >
            <Select options={TAX_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
