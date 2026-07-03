'use client';
/**
 * Master voucher editor - orchestrates all sub-components and hooks.
 * Supports all 5 voucher types via voucherType prop.
 * Per F-02 D-01: 10-tab layout, hybrid autosave, crash recovery, concurrent-edit banner,
 *   live tax preview, TCS info box, e-Invoice retry banner, UPI QR, 30s undo toast, keyboard shortcuts.
 */
import { useEffect, useState, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import dayjs from 'dayjs';
import { App, Modal, notification } from 'antd';
import { VoucherEditorHeader } from './VoucherEditorHeader';
import { LivePreviewPanel } from './LivePreviewPanel';
import { SendInvoiceDialog } from './SendInvoiceDialog';
import { LineItemsTable } from './LineItemsTable';
import { InvoiceSummaryRail } from './InvoiceSummaryRail';
import { TcsInfoBox } from './TcsInfoBox';
import { EInvoiceBanner } from './EInvoiceBanner';
import { DraftRecoveryDialog } from './DraftRecoveryDialog';
import { ConcurrentEditBanner } from './ConcurrentEditBanner';
import { useDraftAutosave } from '@/hooks/useDraftAutosave';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';
import { computeTaxClient } from '@/lib/finance/taxComputeClient';
import { loadDraft, deleteDraft } from '@/lib/finance/draftStore';
import { loadVoucherPrefs, saveVoucherPrefs } from '@/lib/finance/voucherPrefs';
import type { DraftRecord } from '@/lib/finance/draftStore';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import http, { unwrap } from '@/lib/api/client';
import { useWorkspaceStore } from '@/lib/store';
import type { VoucherType, SaleInvoice, AuditEntry, LineItem, AdditionalCharge } from '@/types';
import {
  Input,
  DatePicker,
  Select,
  Row,
  Col,
  Form,
  Space,
  Switch,
  Timeline,
  Typography,
  Button,
  Collapse,
  Tabs,
  Tooltip,
  InputNumber,
  ConfigProvider,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  CheckCircleFilled,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { listParties, getFirm, createParty, gstinLookup } from '@/lib/actions/finance.actions';
import { GST_STATE_CODES } from '@/lib/billing/gst-states';

const { TextArea } = Input;
const { Text } = Typography;

type ApiKey = 'invoices' | 'quotations' | 'orders' | 'proforma' | 'deliveryChallans';

const VOUCHER_SEGMENTS: Record<VoucherType, string> = {
  sale_invoice: 'invoices',
  quotation: 'quotations',
  sale_order: 'orders',
  proforma: 'proforma',
  delivery_challan: 'delivery-challans',
};

const VOUCHER_API_KEYS: Record<VoucherType, ApiKey> = {
  sale_invoice: 'invoices',
  quotation: 'quotations',
  sale_order: 'orders',
  proforma: 'proforma',
  delivery_challan: 'deliveryChallans',
};

// i18n key suffixes for the posted-toast voucher label (finance.sales.editor.header.title*).
// Reuses the header title strings so the "{label} {number} posted." toast stays consistent.
const VOUCHER_LABEL_KEYS: Record<VoucherType, string> = {
  sale_invoice: 'header.titleSaleInvoice',
  quotation: 'header.titleQuotation',
  sale_order: 'header.titleSaleOrder',
  proforma: 'header.titleProforma',
  delivery_challan: 'header.titleDeliveryChallan',
};

// ── Inline simple tab content components ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyForm = ReturnType<typeof useForm<any>>;

interface InfoTabProps {
  form: AnyForm;
  wsId: string;
  firmId: string;
  voucherType: VoucherType;
  /** Phase 1b: lifts this party's remembered per-item rates (itemId -> ratePaise) up to
   *  the editor so LineItemsTable can pre-fill the last price on a repeat item. */
  onPartyItemRates?: (rates: Record<string, number>) => void;
  /** Lifts this party's credit limit + outstanding balance (RUPEES) up to the editor
   *  so handlePost can soft-block when an invoice would breach the credit limit. */
  onPartyCreditInfo?: (info: { creditLimit?: number; currentBalance?: number }) => void;
}

interface PartyOption {
  _id: string;
  name: string;
  gstin?: string;
  state?: string;
  address?: unknown;
  pan?: string;
  partyType?: string;
  /** Outstanding balance in RUPEES (party ledger), shown as "Balance due" on the card. */
  currentBalance?: number;
  /** Credit limit in RUPEES, if the party record carries one. */
  creditLimit?: number;
  /** R3: party's saved print locale; copied into partySnapshot so the live preview
   *  and the saved print page seed the print language from it. */
  preferredLocale?: 'en' | 'gu' | 'hi';
}

// Best-effort one-line address from a party's address (string or structured object).
function formatPartyAddress(addr: unknown): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object') {
    const a = addr as Record<string, unknown>;
    return [a.line1, a.line2, a.city, a.state, a.pincode ?? a.pin]
      .filter((p) => typeof p === 'string' && p.trim())
      .join(', ');
  }
  return '';
}

const fmtRupees = (rupees: number) =>
  '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 });

// Stacked label-over-value stat for the party card (Balance due / Credit limit).
function PartyStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: 'var(--cr-text-4)',
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <div
        style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginTop: 3 }}
      >
        {children}
      </div>
    </div>
  );
}

function InfoTab({
  form,
  wsId,
  firmId,
  voucherType,
  onPartyItemRates,
  onPartyCreditInfo,
}: InfoTabProps) {
  const t = useTranslations('finance.sales');
  const { control, setValue, getValues, watch } = form;
  // Watch the party snapshot so the card can show a compact party-context line
  // (GSTIN + state) once a customer is chosen, without opening the record.
  const partySnapshot = watch('partySnapshot') as PartyOption | undefined;
  const [parties, setParties] = useState<PartyOption[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [firm, setFirm] = useState<any>(null);

  useEffect(() => {
    if (!wsId || !firmId) return;
    let active = true;
    listParties(wsId, firmId)
      .then((r) => {
        if (active) setParties(((r as { items?: PartyOption[] })?.items ?? []) as PartyOption[]);
      })
      .catch(() => {});
    getFirm(wsId, firmId)
      .then((f) => {
        if (!active) return;
        setFirm(f);
        // Default composition firms to Bill of Supply unless already chosen.
        const isComposition =
          f?.businessType === 'composition' ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (f as any)?.compliance?.compositionScheme === true;
        if (isComposition && getValues('isBillOfSupply') === undefined) {
          setValue('isBillOfSupply', true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [wsId, firmId, setValue, getValues]);

  // ── Inline party quick-create ───────────────────────────────────────────────
  // Lets you bill a brand-new customer without leaving the invoice (the Party
  // dropdown offers "Add new party" when the typed name has no match).
  const { message } = App.useApp();
  const [createPartyOpen, setCreatePartyOpen] = useState(false);
  const [partySearch, setPartySearch] = useState('');
  const [creatingParty, setCreatingParty] = useState(false);
  const [gstinFetching, setGstinFetching] = useState(false);
  const [partyForm] = Form.useForm();

  const openPartyCreate = (presetName: string) => {
    partyForm.resetFields();
    partyForm.setFieldsValue({ partyType: 'customer', name: presetName });
    setCreatePartyOpen(true);
  };

  const fetchPartyGstin = async () => {
    const gstin = String(partyForm.getFieldValue('gstin') ?? '').trim();
    if (!gstin) {
      message.warning(t('editor.toast.enterGstinWarn'));
      return;
    }
    setGstinFetching(true);
    try {
      const info = await gstinLookup(wsId, gstin, firmId);
      partyForm.setFieldsValue({ name: info.legalName, state: info.stateCode });
      message.success(t('editor.toast.gstinFetched'));
    } catch {
      message.error(t('editor.toast.gstinFetchFailed'));
    } finally {
      setGstinFetching(false);
    }
  };

  const submitPartyCreate = async () => {
    let values: Record<string, unknown>;
    try {
      values = await partyForm.validateFields();
    } catch {
      return; // inline validation errors are already shown
    }
    setCreatingParty(true);
    try {
      const created = (await createParty(
        wsId,
        firmId,
        values as Parameters<typeof createParty>[2],
      )) as PartyOption;
      setParties((prev) => [created, ...prev]);
      // Select the new party and mirror the existing onChange side-effects.
      setValue('partyId', created._id);
      setValue('partySnapshot', {
        name: created.name,
        gstin: created.gstin,
        state: created.state,
        address: created.address,
        pan: created.pan,
        preferredLocale: created.preferredLocale, // R3: carry print locale into the preview/print
      });
      const pos = created.gstin ? created.gstin.slice(0, 2) : (created.state ?? '');
      if (pos) setValue('placeOfSupplyStateCode', pos);
      setCreatePartyOpen(false);
      message.success(t('editor.toast.partyAdded', { name: created.name }));
    } catch {
      message.error(t('editor.toast.partyCreateFailed'));
    } finally {
      setCreatingParty(false);
    }
  };

  // Seller GSTIN options: primary + any additional state registrations.
  const gstinOptions: { value: string; label: string }[] = [];
  if (firm?.gstin)
    gstinOptions.push({
      value: firm.gstin,
      label: t('editor.value.primaryGstin', { gstin: firm.gstin }),
    });
  for (const g of (firm?.additionalGstins ?? []) as { gstin: string; label?: string }[]) {
    if (g?.gstin)
      gstinOptions.push({ value: g.gstin, label: g.label ? `${g.gstin} (${g.label})` : g.gstin });
  }

  const isSaleInvoice = voucherType === 'sale_invoice';

  // Derived display values for the bill-to card, supply callout, and due date.
  const partyId = watch('partyId') as string | undefined;
  const selectedParty = parties.find((p) => p._id === partyId);
  // Lift this party's credit limit + outstanding (rupees) to the editor for the
  // post-time credit-limit soft-block.
  useEffect(() => {
    onPartyCreditInfo?.({
      creditLimit: selectedParty?.creditLimit,
      currentBalance: selectedParty?.currentBalance,
    });
  }, [
    selectedParty?._id,
    selectedParty?.creditLimit,
    selectedParty?.currentBalance,
    onPartyCreditInfo,
  ]);
  const voucherDateVal = watch('voucherDate') as string | undefined;
  // Payment terms persist under `dueDays` (the SaleInvoice contract + form default);
  // reading/writing any other key silently drops the chosen Net-N term on save.
  const paymentTermsVal = watch('paymentTerms') as { dueDays?: number } | undefined;
  const stateName = (code?: string) =>
    code ? (GST_STATE_CODES.find((s) => s.code === code)?.name ?? code) : '';
  const firmStateCode =
    (firm?.gstin as string | undefined)?.slice(0, 2) ||
    (firm?.address?.stateCode as string | undefined) ||
    '';
  const posCode =
    (watch('placeOfSupplyStateCode') as string | undefined) ||
    (partySnapshot?.gstin ? String(partySnapshot.gstin).slice(0, 2) : '') ||
    partySnapshot?.state ||
    '';
  const hasSupplyStates = !!firmStateCode && !!posCode;
  const isIntra = hasSupplyStates && firmStateCode === posCode;
  const partyAddress = formatPartyAddress(selectedParty?.address ?? partySnapshot?.address);
  const partyName = partySnapshot?.name || selectedParty?.name || '';
  const partyGstin = partySnapshot?.gstin || selectedParty?.gstin;
  const partyBalance =
    typeof selectedParty?.currentBalance === 'number' ? selectedParty.currentBalance : null;
  const partyCreditLimit =
    typeof selectedParty?.creditLimit === 'number' ? selectedParty.creditLimit : null;
  const dueDate = (() => {
    if (!voucherDateVal) return null;
    const d = dayjs(voucherDateVal);
    return d.isValid() ? d.add(paymentTermsVal?.dueDays ?? 0, 'day') : null;
  })();
  const clearParty = () => {
    setValue('partyId', '');
    setValue('partySnapshot', undefined);
    onPartyItemRates?.({});
  };

  // Phase 1b: pull this party's REMEMBERED defaults (last payment terms + place of supply
  // from the backend FieldPredictionMemory store) and pre-fill them. Best-effort - a party
  // with no history just returns nothing. Remembered values override the party-state guess.
  const applyPartySmartDefaults = async (partyId: string) => {
    if (!wsId || !firmId || !partyId) return;
    try {
      const res = await http.get(`workspaces/${wsId}/finance/firms/${firmId}/smart-defaults`, {
        params: { partyId },
      });
      const data = unwrap<{
        dueDays?: number;
        placeOfSupplyStateCode?: string;
        itemRates?: Record<string, number>;
      }>(res);
      if (typeof data?.dueDays === 'number') setValue('paymentTerms', { dueDays: data.dueDays });
      if (data?.placeOfSupplyStateCode) {
        setValue('placeOfSupplyStateCode', data.placeOfSupplyStateCode);
      }
      // Lift remembered per-item rates so the line table pre-fills the last price.
      onPartyItemRates?.(data?.itemRates ?? {});
    } catch {
      /* best-effort: no remembered defaults is fine */
    }
  };

  return (
    <div>
      {/* Vertical labels (above inputs, no colons) match the app's standard form
          convention (Team/Salary forms). component={false} = layout context only, no
          <form> element, so react-hook-form Controllers stay the source of truth. */}
      <Form layout="vertical" colon={false} component={false}>
        <Row gutter={[28, 0]}>
          {/* Left: who we are billing + the auto-derived tax explanation. */}
          <Col xs={24} lg={11} className="lg:pr-3">
            {/* Bill-to: a rich party card once a customer is chosen, search-or-create
            otherwise. The card mirrors how Zoho/Vyapar confirm "who am I billing". */}
            <Form.Item label={t('editor.field.party')} required style={{ marginBottom: 14 }}>
              {partyName ? (
                <div
                  style={{
                    border: '1px solid var(--cr-primary-light, #e3e8fa)',
                    borderRadius: 14,
                    padding: 16,
                    background: 'var(--cr-primary-light, #E7F2EE)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        background:
                          'var(--cr-grad-indigo, linear-gradient(135deg, #3b4bb0, #0B6E4F))',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      {partyName.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 16,
                            color: 'var(--cr-text)',
                          }}
                        >
                          {partyName}
                        </span>
                        {partyGstin && (
                          <Tooltip title={t('editor.party.gstRegistered')}>
                            <CheckCircleFilled
                              style={{ color: 'var(--cr-info-500, #2e6be6)', fontSize: 14 }}
                            />
                          </Tooltip>
                        )}
                      </div>
                      {partyAddress && (
                        <div style={{ fontSize: 12.5, color: 'var(--cr-text-3)', marginTop: 3 }}>
                          {partyAddress}
                        </div>
                      )}
                    </div>
                    <Button
                      type="link"
                      size="small"
                      onClick={clearParty}
                      style={{ padding: 0, fontWeight: 600 }}
                    >
                      {t('editor.party.change')}
                    </Button>
                  </div>

                  {partyGstin && (
                    <div
                      style={{
                        marginTop: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 12px',
                        background: 'var(--cr-surface)',
                        border: '1px solid var(--cr-border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      <span
                        style={{ color: 'var(--cr-text-4)', fontWeight: 700, letterSpacing: 0.3 }}
                      >
                        {t('editor.field.gstin')}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontWeight: 600,
                          color: 'var(--cr-text-2)',
                        }}
                      >
                        {partyGstin}
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      borderTop: '1px dashed var(--cr-border-strong, #cdd2dd)',
                      margin: '14px 0 0',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 36, marginTop: 12 }}>
                    <PartyStat label={t('editor.party.balanceDue')}>
                      <span
                        style={{
                          color:
                            (partyBalance ?? 0) > 0
                              ? 'var(--cr-error, #b42318)'
                              : 'var(--cr-text-2)',
                        }}
                      >
                        {partyBalance != null ? fmtRupees(partyBalance) : t('editor.value.dash')}
                      </span>
                    </PartyStat>
                    <PartyStat label={t('editor.party.creditLimit')}>
                      {partyCreditLimit != null ? (
                        <span style={{ color: 'var(--cr-text)' }}>
                          {fmtRupees(partyCreditLimit)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--cr-text-4)', fontWeight: 400, fontSize: 13 }}>
                          {t('editor.value.notSet')}
                        </span>
                      )}
                    </PartyStat>
                  </div>
                </div>
              ) : (
                <Controller
                  name="partyId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      showSearch
                      aria-label={t('editor.field.party')}
                      placeholder={t('editor.placeholder.searchCustomer')}
                      optionFilterProp="label"
                      style={{ width: '100%' }}
                      value={field.value || undefined}
                      options={parties.map((p) => ({ value: p._id, label: p.name }))}
                      onSearch={(v) => setPartySearch(v)}
                      // R8: Alt+C inline-creates a party from whatever is typed in the search box.
                      onKeyDown={(e) => {
                        if (e.altKey && (e.key === 'c' || e.key === 'C')) {
                          e.preventDefault();
                          openPartyCreate(partySearch.trim());
                        }
                      }}
                      notFoundContent={
                        partySearch.trim() ? (
                          <div style={{ padding: '4px 0' }}>
                            <Button
                              type="link"
                              size="small"
                              icon={<PlusOutlined />}
                              // preventDefault stops the dropdown closing before the click lands
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => openPartyCreate(partySearch.trim())}
                            >
                              {t('editor.party.addNewParty', { name: partySearch.trim() })}
                            </Button>
                          </div>
                        ) : undefined
                      }
                      onChange={(val) => {
                        field.onChange(val);
                        const p = parties.find((x) => x._id === val);
                        if (p) {
                          setValue('partySnapshot', {
                            name: p.name,
                            gstin: p.gstin,
                            state: p.state,
                            address: p.address,
                            pan: p.pan,
                            preferredLocale: p.preferredLocale, // R3: carry print locale into preview/print
                          });
                          // Default place-of-supply to the party's state code.
                          const pos = p.gstin ? p.gstin.slice(0, 2) : (p.state ?? '');
                          if (pos) setValue('placeOfSupplyStateCode', pos);
                          // Phase 1b: override with this party's REMEMBERED terms/POS (if any).
                          void applyPartySmartDefaults(val);
                        }
                      }}
                    />
                  )}
                />
              )}
            </Form.Item>

            {/* D13: optional broker/dalali for this deal + commission %. A broker is a party, so we
                reuse the party list. Feeds the Broker Commission Register (R-25); auto-flows to the
                payload via the watched form values (brokerPartyId / brokerCommissionPct). */}
            <Form.Item label={t('editor.field.broker')}>
              <Space.Compact style={{ width: '100%' }}>
                <Controller
                  name="brokerPartyId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      showSearch
                      allowClear
                      aria-label={t('editor.field.broker')}
                      placeholder={t('editor.placeholder.broker')}
                      optionFilterProp="label"
                      style={{ width: '70%' }}
                      value={field.value || undefined}
                      options={parties.map((p) => ({ value: p._id, label: p.name }))}
                      onChange={(val) => field.onChange(val ?? undefined)}
                    />
                  )}
                />
                <Controller
                  name="brokerCommissionPct"
                  control={control}
                  render={({ field }) => (
                    <InputNumber
                      aria-label={t('editor.field.brokerCommissionPct')}
                      placeholder="%"
                      min={0}
                      max={100}
                      step={0.5}
                      style={{ width: '30%' }}
                      value={field.value as number | undefined}
                      onChange={(v) => field.onChange(v ?? undefined)}
                    />
                  )}
                />
              </Space.Compact>
            </Form.Item>

            {/* Why this tax: the intra/inter-state derivation made explicit, so the user
          never wonders why CGST+SGST vs IGST appeared. Driven by firm vs POS state. */}
            {hasSupplyStates && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  marginTop: 14,
                  background: isIntra
                    ? 'var(--cr-success-50, #ecfdf3)'
                    : 'var(--cr-primary-light, #E7F2EE)',
                  border: '1px solid var(--cr-border)',
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--cr-surface)',
                    border: '1px solid var(--cr-border)',
                    color: isIntra ? 'var(--cr-success, #1a7f4b)' : 'var(--cr-primary, #0B6E4F)',
                  }}
                >
                  {isIntra ? <EnvironmentOutlined /> : <ArrowRightOutlined />}
                </div>
                <div
                  style={{ flex: 1, fontSize: 12.5, color: 'var(--cr-text-2)', lineHeight: 1.45 }}
                >
                  {isIntra ? (
                    <>
                      <strong>{t('editor.supply.intraStrong')}</strong>
                      {t('editor.supply.intraBody', { state: stateName(firmStateCode) })}
                    </>
                  ) : (
                    <>
                      <strong>{t('editor.supply.interStrong')}</strong>
                      {t('editor.supply.interBody', {
                        buyerState: stateName(posCode),
                        sellerState: stateName(firmStateCode),
                      })}
                    </>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 11px',
                    borderRadius: 999,
                    background: 'var(--cr-surface)',
                    border: `1px solid ${isIntra ? 'var(--cr-success, #1a7f4b)' : 'var(--cr-primary, #0B6E4F)'}`,
                    color: isIntra ? 'var(--cr-success, #1a7f4b)' : 'var(--cr-primary, #0B6E4F)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isIntra ? t('editor.supply.cgstSgst') : t('editor.supply.igst')}
                </span>
              </div>
            )}
          </Col>
          {/* Right: invoice meta (2-up), divided from the left on wide screens. */}
          <Col xs={24} lg={13} className="lg:border-l lg:border-border-light lg:pl-7">
            {/* Invoice meta grid */}
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12} lg={12}>
                <Form.Item label={t('editor.field.invoiceNo')}>
                  <Input
                    disabled
                    value={
                      (watch('voucherNumber') as string) || t('editor.placeholder.autoOnPosting')
                    }
                    aria-label={t('editor.field.invoiceNo')}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} lg={12}>
                <Form.Item label={t('editor.field.invoiceDate')} required>
                  <Controller
                    name="voucherDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        style={{ width: '100%' }}
                        format="DD MMM YYYY"
                        value={field.value ? dayjs(field.value) : undefined}
                        onChange={(d) => field.onChange(d ? d.toISOString() : '')}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} lg={12}>
                <Form.Item
                  label={t('editor.field.placeOfSupply')}
                  tooltip={t('editor.field.placeOfSupplyTooltip')}
                >
                  <Controller
                    name="placeOfSupplyStateCode"
                    control={control}
                    render={({ field }) => (
                      <Select
                        showSearch
                        aria-label={t('editor.field.placeOfSupply')}
                        placeholder={t('editor.placeholder.selectState')}
                        optionFilterProp="label"
                        style={{ width: '100%' }}
                        value={field.value || undefined}
                        onChange={field.onChange}
                        suffixIcon={<EnvironmentOutlined />}
                        options={GST_STATE_CODES.map((s) => ({
                          value: s.code,
                          label: t('editor.value.stateCodeName', { code: s.code, name: s.name }),
                        }))}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} lg={12}>
                <Form.Item label={t('editor.field.paymentTerms')}>
                  <Controller
                    name="paymentTerms"
                    control={control}
                    render={({ field }) => (
                      <Select
                        aria-label={t('editor.field.paymentTerms')}
                        style={{ width: '100%' }}
                        value={field.value?.dueDays ?? 0}
                        onChange={(v) => field.onChange({ dueDays: v })}
                        options={[
                          { value: 0, label: t('editor.value.immediate') },
                          { value: 15, label: t('editor.value.net15') },
                          { value: 30, label: t('editor.value.net30') },
                          { value: 45, label: t('editor.value.net45') },
                          { value: 60, label: t('editor.value.net60') },
                        ]}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} lg={12}>
                <Form.Item label={t('editor.field.dueDate')}>
                  <DatePicker
                    disabled
                    style={{ width: '100%' }}
                    format="DD MMM YYYY"
                    value={dueDate ?? undefined}
                    aria-label={t('editor.field.dueDate')}
                  />
                </Form.Item>
              </Col>
              {isSaleInvoice && (
                <Col xs={24} sm={12} lg={12}>
                  <Form.Item
                    label={t('editor.field.reverseCharge')}
                    tooltip={t('editor.field.reverseChargeTooltip')}
                  >
                    <Controller
                      name="isReverseCharge"
                      control={control}
                      render={({ field }) => (
                        <Select
                          aria-label={t('editor.field.reverseCharge')}
                          style={{ width: '100%' }}
                          value={field.value ? 'yes' : 'no'}
                          onChange={(v) => {
                            const on = v === 'yes';
                            field.onChange(on);
                            // RCM and Bill of Supply are mutually exclusive (server
                            // assertRcmBosExclusive); turning one on clears the other.
                            if (on) setValue('isBillOfSupply', false);
                          }}
                          options={[
                            { value: 'no', label: t('editor.value.no') },
                            { value: 'yes', label: t('editor.value.yes') },
                          ]}
                        />
                      )}
                    />
                  </Form.Item>
                </Col>
              )}
            </Row>
          </Col>
        </Row>

        {/* More options: low-frequency fields collapsed by default so the common path
          (party -> items -> totals) stays uncluttered. Progressive disclosure of
          advanced invoice settings, mirroring Zoho/Stripe. */}
        <Collapse
          ghost
          style={{ marginTop: 4 }}
          items={[
            {
              key: 'more',
              label: <span style={{ fontWeight: 600 }}>{t('editor.more.label')}</span>,
              children: (
                <Row gutter={[16, 0]}>
                  {isSaleInvoice && (
                    <Col xs={24} sm={12} lg={8}>
                      <Form.Item
                        label={t('editor.field.billOfSupply')}
                        tooltip={t('editor.field.billOfSupplyTooltip')}
                      >
                        <Controller
                          name="isBillOfSupply"
                          control={control}
                          render={({ field }) => (
                            <Select
                              aria-label={t('editor.field.billOfSupply')}
                              style={{ width: '100%' }}
                              value={field.value ? 'yes' : 'no'}
                              onChange={(v) => {
                                const on = v === 'yes';
                                field.onChange(on);
                                if (on) setValue('isReverseCharge', false);
                              }}
                              options={[
                                { value: 'no', label: t('editor.value.no') },
                                { value: 'yes', label: t('editor.value.yes') },
                              ]}
                            />
                          )}
                        />
                      </Form.Item>
                    </Col>
                  )}
                  {isSaleInvoice && gstinOptions.length > 1 && (
                    <Col xs={24} sm={12} lg={8}>
                      <Form.Item
                        label={t('editor.field.issuedUnderGstin')}
                        tooltip={t('editor.field.issuedUnderGstinTooltip')}
                      >
                        <Controller
                          name="sellerGstin"
                          control={control}
                          render={({ field }) => (
                            <Select
                              aria-label={t('editor.field.issuedUnderGstin')}
                              style={{ width: '100%' }}
                              placeholder={t('editor.placeholder.primaryGstin')}
                              allowClear
                              value={field.value || undefined}
                              onChange={field.onChange}
                              options={gstinOptions}
                            />
                          )}
                        />
                      </Form.Item>
                    </Col>
                  )}
                  {!isSaleInvoice && (
                    <Col xs={24}>
                      <span style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>
                        {t('editor.more.none')}
                      </span>
                    </Col>
                  )}
                </Row>
              ),
            },
          ]}
        />
      </Form>

      <Modal
        title={t('editor.createParty.title')}
        open={createPartyOpen}
        onCancel={() => setCreatePartyOpen(false)}
        onOk={submitPartyCreate}
        okText={t('editor.createParty.okText')}
        confirmLoading={creatingParty}
        destroyOnHidden
      >
        <Form form={partyForm} layout="vertical" requiredMark="optional">
          <Form.Item
            label={t('editor.field.partyType')}
            name="partyType"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'customer', label: t('editor.value.customer') },
                { value: 'vendor', label: t('editor.value.vendor') },
              ]}
            />
          </Form.Item>
          <Form.Item
            label={t('editor.field.gstin')}
            name="gstin"
            normalize={(v?: string) => (v ? v.toUpperCase() : v)}
            rules={[
              {
                pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/,
                message: t('editor.createParty.gstinPattern'),
              },
            ]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder={t('editor.placeholder.gstinOptional')} />
              <Button loading={gstinFetching} onClick={fetchPartyGstin} icon={<SearchOutlined />}>
                {t('editor.createParty.fetch')}
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item
            label={t('editor.field.name')}
            name="name"
            rules={[{ required: true, message: t('editor.createParty.nameRequired') }]}
          >
            <Input placeholder={t('editor.placeholder.businessOrPersonName')} />
          </Form.Item>
          <Form.Item label={t('editor.field.statePlaceOfSupply')} name="state">
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={t('editor.placeholder.selectState')}
              options={GST_STATE_CODES.map((s) => ({
                value: s.code,
                label: t('editor.value.stateCodeName', { code: s.code, name: s.name }),
              }))}
            />
          </Form.Item>
          <Form.Item label={t('editor.field.phone')} name="phone">
            <Input placeholder={t('editor.placeholder.optional')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

interface AdditionalChargesInlineProps {
  control: import('react-hook-form').Control<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// Inline editor for freight/packing/insurance-style charges. Wires the
// `additionalCharges` field array straight into the live tax preview: taxable
// charges roll into the taxable value, non-taxable charges add to the grand total.
// Replaces the old stub tab. Feeds computeTaxClient via watched.additionalCharges.
function AdditionalChargesInline({ control }: AdditionalChargesInlineProps) {
  const t = useTranslations('finance.sales');
  const { fields, append, remove } = useFieldArray({ control, name: 'additionalCharges' });

  return (
    <div>
      {fields.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {fields.map((f, i) => (
            <div
              key={f.id}
              style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Controller
                name={`additionalCharges.${i}.label`}
                control={control}
                render={({ field }) => (
                  <Input
                    placeholder={t('editor.placeholder.chargeLabel')}
                    style={{ flex: '1 1 200px', minWidth: 160 }}
                    {...field}
                  />
                )}
              />
              <Controller
                name={`additionalCharges.${i}.amountPaise`}
                control={control}
                render={({ field }) => (
                  // Stored in paise; shown in rupees. style width per the prefixed
                  // InputNumber width gotcha (className w-full is ignored).
                  <InputNumber
                    placeholder={t('editor.placeholder.amountZero')}
                    min={0}
                    prefix="₹"
                    style={{ width: 150 }}
                    value={typeof field.value === 'number' ? field.value / 100 : undefined}
                    onChange={(v) =>
                      field.onChange(typeof v === 'number' ? Math.round(v * 100) : 0)
                    }
                  />
                )}
              />
              <Controller
                name={`additionalCharges.${i}.isTaxable`}
                control={control}
                render={({ field }) => (
                  <Tooltip title={t('editor.charges.taxableTooltip')}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: 'var(--cr-text-2)',
                      }}
                    >
                      <Switch
                        size="small"
                        checked={field.value !== false}
                        onChange={field.onChange}
                      />
                      {t('editor.charges.taxable')}
                    </span>
                  </Tooltip>
                )}
              />
              <Controller
                name={`additionalCharges.${i}.taxRate`}
                control={control}
                render={({ field }) => (
                  <Select
                    aria-label={t('editor.charges.chargeGstRate')}
                    style={{ width: 96 }}
                    placeholder={t('editor.placeholder.gstPercent')}
                    value={field.value ?? undefined}
                    onChange={field.onChange}
                    options={[0, 5, 12, 18, 28].map((v) => ({
                      value: v,
                      label: t('editor.value.percent', { rate: v }),
                    }))}
                  />
                )}
              />
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => remove(i)}
                aria-label={t('editor.charges.removeCharge')}
              />
            </div>
          ))}
        </div>
      )}
      <Button
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={() => append({ label: '', amountPaise: 0, isTaxable: true, taxRate: 18 })}
      >
        {t('editor.charges.addCharge')}
      </Button>
    </div>
  );
}

interface EInvoiceTabProps {
  invoice: SaleInvoice | null | undefined;
}

function EInvoiceTab({ invoice }: EInvoiceTabProps) {
  const t = useTranslations('finance.sales');
  const status = invoice?.eInvoice?.status ?? 'not_applicable';
  return (
    <div style={{ padding: 16 }}>
      <p style={{ color: 'var(--cr-text-2)', fontSize: 14 }}>
        <strong>{t('editor.edoc.eInvoiceStatus')}</strong>{' '}
        <span
          style={{
            color:
              status === 'generated'
                ? 'var(--cr-success)'
                : status === 'pending'
                  ? 'var(--cr-warning-700)'
                  : 'var(--cr-text-3)',
          }}
        >
          {status}
        </span>
      </p>
      {invoice?.eInvoice?.irn && (
        <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--cr-text-3)' }}>
          {t('editor.edoc.irn', { irn: invoice.eInvoice.irn })}
        </p>
      )}
      {invoice?.eInvoice?.ackNo && (
        <p style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>
          {t('editor.edoc.ackNo', {
            ackNo: invoice.eInvoice.ackNo,
            ackDate: invoice.eInvoice.ackDate ?? '',
          })}
        </p>
      )}
    </div>
  );
}

interface EwayBillTabProps {
  invoice: SaleInvoice | null | undefined;
}

function EwayBillTab({ invoice }: EwayBillTabProps) {
  const t = useTranslations('finance.sales');
  return (
    <div style={{ padding: 16 }}>
      {invoice?.ewayBill?.ewbNo ? (
        <p style={{ fontSize: 13 }}>
          {t('editor.edoc.ewbNo')} <strong>{invoice.ewayBill.ewbNo}</strong>
          {invoice.ewayBill.validUpto && (
            <span style={{ color: 'var(--cr-text-3)', marginLeft: 8 }}>
              {t('editor.edoc.validUpto', { date: invoice.ewayBill.validUpto })}
            </span>
          )}
        </p>
      ) : (
        <p style={{ color: 'var(--cr-text-3)', fontSize: 14 }}>{t('editor.edoc.noEwayBill')}</p>
      )}
    </div>
  );
}

interface ActivityTabProps {
  auditLog: AuditEntry[];
}

function ActivityTab({ auditLog }: ActivityTabProps) {
  const t = useTranslations('finance.sales');
  if (!auditLog.length) {
    return (
      <div style={{ padding: 16, color: 'var(--cr-text-3)', fontSize: 14 }}>
        {t('editor.activity.none')}
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <Timeline
        items={auditLog.map((entry) => ({
          children: (
            <div>
              <Text strong style={{ fontSize: 13 }}>
                {entry.action}
              </Text>{' '}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('editor.activity.by', {
                  by: entry.by,
                  at: new Date(entry.at).toLocaleString('en-IN'),
                })}
              </Text>
              {entry.reason && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cr-text-3)' }}>
                  {entry.reason}
                </p>
              )}
            </div>
          ),
        }))}
      />
    </div>
  );
}

// ── Single-screen layout chrome ─────────────────────────────────────────────
// The voucher editor moved from a 9-tab shell to one scrolling, document-style page
// (party -> items -> totals), so the line items the user actually fills in are the
// hero instead of being hidden behind a "Lines" tab. EditorSection is the shared
// titled card used for each zone.

// Matches the canonical DsCard look (radius-xl + shadow-card + --cr-border) so the
// editor's section cards are visually identical to cards on every other page.
const EDITOR_CARD_STYLE: CSSProperties = {
  background: 'var(--cr-surface)',
  border: '1px solid var(--cr-border)',
  borderRadius: 'var(--cr-radius-xl)',
  boxShadow: 'var(--cr-shadow-card)',
  overflow: 'hidden',
};

function EditorSection({
  title,
  subtitle,
  extra,
  bodyPadding = 22,
  children,
}: {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  bodyPadding?: number;
  children: ReactNode;
}) {
  // Clean card: a quiet letter-spaced micro-label up top (no heavy grey bar), with an
  // optional helper subtitle inline, then the body. The lift comes from the soft
  // shadow + warm hairline border, not chrome.
  return (
    <section style={EDITOR_CARD_STYLE}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 22px 0',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.2,
              color: 'var(--cr-text-3)',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </span>
          {subtitle && <span style={{ fontSize: 12, color: 'var(--cr-text-4)' }}>{subtitle}</span>}
        </div>
        {extra}
      </div>
      <div style={{ padding: bodyPadding ? `14px ${bodyPadding}px ${bodyPadding}px` : '10px 0 0' }}>
        {children}
      </div>
    </section>
  );
}

// ── Master VoucherEditor ───────────────────────────────────────────────────────

interface VoucherEditorProps {
  voucherType: VoucherType;
  firmId: string;
  mode: 'new' | 'edit';
  existingDraft?: SaleInvoice | null;
}

export function VoucherEditor({ voucherType, firmId, mode, existingDraft }: VoucherEditorProps) {
  const t = useTranslations('finance.sales');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const router = useRouter();
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [localDraft, setLocalDraft] = useState<DraftRecord | null>(null);
  const [concurrentEdit, setConcurrentEdit] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  // Keyboard-shortcuts cheat-sheet (opened with "?"). Discoverability for the
  // keyboard-first entry model (Alt+N / Ctrl+S / Ctrl+Enter / Esc).
  const [showShortcuts, setShowShortcuts] = useState(false);
  // R4: dated-amendment prompt. When a save into a books-locked period is rejected
  // (backend code FINANCE_PERIOD_LOCKED), we ask for a reason instead of hard-blocking,
  // then merge it into every subsequent save (server records it as an audited amendment).
  // amendmentReasonRef holds the reason for the in-flight edit session; lockPrompt drives
  // the modal. Cross-link: backend fy-lock.service.assertOpen (amendment branch) +
  // UpdateSaleInvoiceDto.amendmentReason.
  const amendmentReasonRef = useRef<string>('');
  const [lockPrompt, setLockPrompt] = useState<{ lockedUpto?: string } | null>(null);
  const [amendmentReasonInput, setAmendmentReasonInput] = useState('');
  // R8: Tally-style Enter-to-next-field navigation is scoped to this container so it can't
  // disturb anything outside the editor body. Alt+C inline-create lives in the child fields
  // (party in InfoTab, item in LineItemsTable) since they own the create modals.
  const editorRootRef = useRef<HTMLDivElement>(null);
  // Phase 1b: the selected party's remembered per-item rates (itemId -> ratePaise),
  // lifted from InfoTab's smart-defaults fetch so LineItemsTable can pre-fill the last
  // price when a repeat item is chosen.
  const [partyItemRates, setPartyItemRates] = useState<Record<string, number>>({});
  // Per-invoice round-off toggle (rail), seeded from the firm's rounding policy
  // once the firm loads. Feeds taxContext so the preview reflects the choice.
  const [roundOff, setRoundOff] = useState(false);
  // Firm context for the tax preview (seller state codes + rounding policy) so
  // the preview mirrors the server snapshot at Post instead of assuming Gujarat.
  const [firm, setFirm] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  useEffect(() => {
    const wsId = ws?._id;
    if (!wsId || !firmId) return;
    let active = true;
    getFirm(wsId, firmId)
      .then((f) => {
        if (!active) return;
        setFirm(f);
        // Seed the round-off toggle from the loaded firm policy (one-shot).
        setRoundOff(f?.roundingPolicy === 'round_off_to_rupee');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [ws?._id, firmId]);

  const draftId =
    existingDraft?._id ??
    `temp_${
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    }`;

  const draftKey = `finance_draft_${ws?._id ?? '_'}_${voucherType}_${draftId}`;

  const idempotencyKey = useIdempotencyKey({
    wsId: ws?._id ?? '_',
    voucherType,
    draftId,
  });

  // Smart defaults for a NEW voucher: pre-fill the firm's last-used payment terms + place
  // of supply (sticky, localStorage via voucherPrefs) and seed ONE focused empty line so
  // the user can start typing immediately (Tally-style rapid entry). One-shot read.
  const [initialPrefs] = useState(() => (mode === 'new' ? loadVoucherPrefs(firmId) : {}));
  // D1: one-time dismissible explainer (Sales Invoice vs Purchase Bill) shown only when creating
  // a new sale invoice. Lazy init reads localStorage once (no effect -> no set-state-in-effect).
  const [showInvoiceExplainer, setShowInvoiceExplainer] = useState(
    () =>
      voucherType === 'sale_invoice' &&
      mode === 'new' &&
      typeof window !== 'undefined' &&
      window.localStorage.getItem('finance.invoiceExplainerDismissed') !== '1',
  );

  const form = useForm<any>({
    defaultValues: existingDraft ?? {
      partyId: '',
      voucherDate: new Date().toISOString(),
      lineItems: [
        {
          itemId: '',
          itemName: '',
          qty: 1,
          unit: 'NOS',
          ratePaise: 0,
          rateCentiPaise: 0,
          discountPct: 0,
          discountFlatPaise: 0,
          taxRate: 18,
          cessRate: 0,
          isTaxInclusive: false,
          hsnSacCode: '',
        },
      ] as LineItem[],
      additionalCharges: [] as AdditionalCharge[],
      notes: '',
      internalNotes: '',
      placeOfSupplyStateCode: initialPrefs.placeOfSupplyStateCode ?? '',
      paymentTerms: { dueDays: initialPrefs.dueDays ?? 0 },
      // Shipping/transport details (persist via the create/update DTO `shipping` object).
      // Also pre-fills the e-Way bill form on delivery challans (ChallanEwaySection).
      shipping: {
        mode: '',
        vehicleNo: '',
        transporter: '',
        distance: undefined as number | undefined,
        address: '',
      },
    },
  });

  const { control, watch } = form;
  const watched = watch();
  // In-editor live print preview (sale_invoice only). Toggled from the header
  // Preview button; renders the real print themes against live form data.
  const [livePreviewOpen, setLivePreviewOpen] = useState(false);
  // Party credit limit + outstanding (rupees), lifted from InfoTab for the post-time
  // credit-limit soft-block.
  const [partyCreditInfo, setPartyCreditInfo] = useState<{
    creditLimit?: number;
    currentBalance?: number;
  }>({});
  // Save & Share: stash the posted invoice so the Send dialog can open from the editor
  // (posting otherwise navigates away). Closing the dialog then routes to the posted view.
  const [sendInvoiceOpen, setSendInvoiceOpen] = useState(false);
  const [postedInvoice, setPostedInvoice] = useState<SaleInvoice | null>(null);

  // Tax PREVIEW must mirror the server snapshot at Post, so derive every input
  // from real data (no hardcoded Gujarat '24'). Seller state = the invoice's
  // seller GSTIN (multi-GSTIN branch) -> primary GSTIN -> firm address; place of
  // supply = the chosen POS -> party GSTIN state -> seller state; rounding = the
  // firm's policy. Shared with LineItemsTable so the per-line CGST/SGST-vs-IGST
  // columns match the totals footer and the posted invoice (preview == posted).
  const taxContext = useMemo(() => {
    const sellerStateCode =
      (watched.sellerGstin as string | undefined)?.slice(0, 2) ||
      (firm?.gstin as string | undefined)?.slice(0, 2) ||
      (firm?.address?.stateCode as string | undefined) ||
      '';
    const partyGstinState =
      typeof watched.partySnapshot?.gstin === 'string'
        ? (watched.partySnapshot.gstin as string).slice(0, 2)
        : '';
    const posStateCode =
      (watched.placeOfSupplyStateCode as string | undefined) || partyGstinState || sellerStateCode;
    return {
      firmStateCode: sellerStateCode,
      partyStateCode: partyGstinState || posStateCode,
      placeOfSupplyStateCode: posStateCode,
      // Driven by the rail's round-off toggle (seeded from firm policy).
      roundingPolicy: roundOff ? ('round_off_to_rupee' as const) : ('half_up' as const),
    };
  }, [watched, firm, roundOff]);

  const taxResult = useMemo(
    () =>
      computeTaxClient({
        lines: (watched.lineItems ?? []) as LineItem[],
        additionalCharges: (watched.additionalCharges ?? []) as AdditionalCharge[],
        ...taxContext,
      }),
    [watched.lineItems, watched.additionalCharges, taxContext],
  );

  const onServerSave = async (data: unknown) => {
    if (!ws?._id) return;
    const apiKey = VOUCHER_API_KEYS[voucherType];
    if (mode === 'edit' && existingDraft?._id) {
      // R4: carry the amendment reason (if the user supplied one for this locked-period
      // edit) on every save so the backend records the audited amendment and lets it
      // through. Only added on the edit path - the create DTO doesn't accept it.
      const payload = amendmentReasonRef.current
        ? { ...(data as Record<string, unknown>), amendmentReason: amendmentReasonRef.current }
        : data;
      try {
        await (financeSalesApi as any)[apiKey].update(ws._id, firmId, existingDraft._id, payload); // eslint-disable-line @typescript-eslint/no-explicit-any
      } catch (e: unknown) {
        // Soft books-lock: pop the amendment-reason prompt instead of a generic error.
        // Once a reason is set we don't re-prompt (the retry carries it).
        const code = (e as { response?: { data?: { code?: string; lockedUptoDate?: string } } })
          ?.response?.data;
        if (code?.code === 'FINANCE_PERIOD_LOCKED' && !amendmentReasonRef.current) {
          setAmendmentReasonInput('');
          setLockPrompt({ lockedUpto: code.lockedUptoDate });
        }
        throw e;
      }
    } else {
      const created = await (financeSalesApi as any)[apiKey].create(ws._id, firmId, data); // eslint-disable-line @typescript-eslint/no-explicit-any
      router.replace(
        `/dashboard/finance/firms/${firmId}/sales/${VOUCHER_SEGMENTS[voucherType]}/${created._id}`,
      );
    }
  };

  // Only let autosave hit the server once the draft has real content. A brand-new,
  // untouched invoice (no party, no lines) must not POST an empty body to the server,
  // which the server rejects -> the header used to show a false "Saved locally".
  // Keep this gate in sync with useDraftAutosave's canServerSave contract.
  // "Real content" = a party is chosen OR a line has an actual item/rate. The auto-seeded
  // blank starter line must NOT count, or the empty-draft autosave (and the old false
  // "Saved locally") would fire on a pristine new invoice again.
  const hasContent =
    !!watched.partyId ||
    ((watched.lineItems as LineItem[] | undefined) ?? []).some(
      (l) => !!l?.itemId || (l?.ratePaise ?? 0) > 0,
    );

  // A voucher that has left draft (pending_approval/posted/cancelled/void) is no longer
  // editable here: no autosave, no Save Draft / Post (those would error server-side). The
  // header shows a status tag instead; pending_approval is acted on via InvoiceApprovalBar.
  const isReadOnlyVoucher =
    mode === 'edit' && !!existingDraft?.state && existingDraft.state !== 'draft';

  const autosave = useDraftAutosave({
    key: draftKey,
    data: watched,
    workspaceId: ws?._id ?? '_',
    firmId,
    voucherType,
    draftId,
    onServerSave,
    enabled: !!ws?._id,
    canServerSave: !!ws?._id && hasContent && !isReadOnlyVoucher,
  });

  // Crash recovery on mount
  useEffect(() => {
    loadDraft(draftKey).then((local) => {
      if (local && existingDraft && local.updatedAt > new Date(existingDraft.updatedAt).getTime()) {
        setLocalDraft(local);
        setShowRecoveryDialog(true);
      }
    });
  }, [draftKey, existingDraft]);

  // Concurrent edit detection via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('finance_draft_open');
    const myInstance = crypto.randomUUID();
    channel.postMessage({ key: draftKey, instance: myInstance, openedAt: Date.now() });
    channel.onmessage = (e: MessageEvent) => {
      if (e.data.key === draftKey && e.data.instance !== myInstance) {
        setConcurrentEdit(true);
      }
    };
    return () => channel.close();
  }, [draftKey]);

  // Explicit Save Draft (button + Ctrl+S): only persist when there is real content, so an
  // untouched new invoice never fires a failing empty-draft POST. Mirrors canServerSave.
  const handleSaveDraft = () => {
    if (isReadOnlyVoucher) return; // finalised voucher - nothing to save
    if (!hasContent) {
      notification.info({ message: t('editor.toast.addContentBeforeSave') });
      return;
    }
    autosave.saveNow();
  };

  // Keyboard shortcuts: Ctrl+S, Ctrl+Enter, Escape, ? (cheat-sheet)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveDraft();
      }
      // "?" opens the shortcuts cheat-sheet - but only when not typing in a field.
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const t = e.target as HTMLElement | null;
        const editable =
          !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if (!editable) {
          e.preventDefault();
          setShowShortcuts(true);
        }
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handlePost();
      }
      if (e.key === 'Escape') {
        if (form.formState.isDirty) {
          // Invert handlers: the destructive choice (leave, discarding edits) is the explicit OK
          // (danger); dismissing the dialog (X / mask / Cancel) is the SAFE default = stay.
          // Previously onCancel=router.back() meant clicking X or the mask silently lost work.
          Modal.confirm({
            title: t('editor.unsaved.title'),
            okText: t('editor.unsaved.leave'),
            okButtonProps: { danger: true },
            cancelText: t('editor.unsaved.stay'),
            onOk: () => router.back(),
          });
        } else {
          router.back();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosave, form.formState.isDirty, router]);

  // Warn before a browser-level navigation (tab close / refresh / external link) discards unsaved
  // edits. In-app navigation is covered by the explicit Escape dialog above (Next App Router has
  // no built-in route-change-abort hook to intercept Link clicks).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [form.formState.isDirty]);

  // Posts the current (existing) draft. `after` runs on success in place of the default
  // navigate-to-posted-view, so Save & New / Print / Share can route differently (or open
  // the Send dialog) from the same flow.
  const proceedPost = async (after?: (posted: SaleInvoice) => void) => {
    setPostLoading(true);
    try {
      const apiKey = VOUCHER_API_KEYS[voucherType];
      const posted = await (financeSalesApi as any)[apiKey].post(
        ws!._id,
        firmId,
        existingDraft!._id,
        idempotencyKey,
      );
      await deleteDraft(draftKey);
      // Remember this voucher's terms + place of supply as the firm's sticky defaults so
      // the next NEW voucher pre-fills them (frontend prefs; see lib/finance/voucherPrefs).
      saveVoucherPrefs(firmId, {
        dueDays: (watched.paymentTerms as { dueDays?: number } | undefined)?.dueDays,
        placeOfSupplyStateCode: watched.placeOfSupplyStateCode as string | undefined,
      });
      // 30-second undo toast
      notification.success({
        message: t('editor.toast.voucherPosted', {
          label: t(`editor.${VOUCHER_LABEL_KEYS[voucherType]}`),
          number: (posted as any).voucherNumber ?? '', // eslint-disable-line @typescript-eslint/no-explicit-any
        }),
        btn: (
          <a
            onClick={(e) => {
              e.preventDefault();
              handleUndo((posted as any)._id); // eslint-disable-line @typescript-eslint/no-explicit-any
            }}
          >
            {t('editor.toast.undo')}
          </a>
        ),
        duration: 30,
      });
      if (after) {
        after(posted as SaleInvoice);
      } else {
        router.push(
          `/dashboard/finance/firms/${firmId}/sales/${VOUCHER_SEGMENTS[voucherType]}/${(posted as any)._id}`, // eslint-disable-line @typescript-eslint/no-explicit-any
        );
      }
    } catch (e: unknown) {
      const err = e as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      notification.error({
        message: t('editor.toast.postFailed'),
        description: err?.response?.data?.message ?? err?.message ?? t('editor.toast.unknownError'),
      });
    } finally {
      setPostLoading(false);
    }
  };

  // Runs `proceed` immediately, unless the invoice would push the customer past their
  // credit limit, in which case it asks to confirm (override) first. sale_invoice only;
  // balance/limit in rupees, grand total in paise.
  const runWithCreditGuard = (proceed: () => void) => {
    const limit = partyCreditInfo.creditLimit;
    const balance = partyCreditInfo.currentBalance;
    const grandRupees = (taxResult.grandTotalPaise ?? 0) / 100;
    if (
      voucherType === 'sale_invoice' &&
      typeof limit === 'number' &&
      limit > 0 &&
      typeof balance === 'number' &&
      balance + grandRupees > limit
    ) {
      Modal.confirm({
        title: t('editor.creditLimit.title'),
        content: t('editor.creditLimit.message', {
          outstanding: fmtRupees(Math.round(balance + grandRupees)),
          limit: fmtRupees(Math.round(limit)),
        }),
        okText: t('editor.creditLimit.proceed'),
        okButtonProps: { danger: true },
        onOk: proceed,
      });
      return;
    }
    proceed();
  };

  const handlePost = async () => {
    if (isReadOnlyVoucher) return; // already posted / pending approval / cancelled
    if (!existingDraft?._id) {
      // Save draft first, then navigate to edit page to post
      await autosave.saveNow();
      return;
    }
    runWithCreditGuard(() => void proceedPost());
  };

  // Save & New: post, then open a fresh blank invoice (the /new route remounts the editor).
  const handleSaveAndNew = async () => {
    if (isReadOnlyVoucher) return;
    if (!existingDraft?._id) {
      await autosave.saveNow();
      return;
    }
    runWithCreditGuard(
      () =>
        void proceedPost(() =>
          router.push(
            `/dashboard/finance/firms/${firmId}/sales/${VOUCHER_SEGMENTS[voucherType]}/new`,
          ),
        ),
    );
  };

  // Save & Print: post, then jump straight to the printable document.
  const handleSaveAndPrint = async () => {
    if (isReadOnlyVoucher) return;
    if (!existingDraft?._id) {
      await autosave.saveNow();
      return;
    }
    runWithCreditGuard(
      () =>
        void proceedPost((posted) =>
          router.push(
            `/dashboard/finance/firms/${firmId}/sales/${VOUCHER_SEGMENTS[voucherType]}/${posted._id}/print`,
          ),
        ),
    );
  };

  // Save & Share: post, then open the Send dialog WITHOUT navigating (router.push would
  // unmount this editor); closing the dialog then routes to the posted invoice.
  const handleSaveAndShare = async () => {
    if (isReadOnlyVoucher) return;
    if (!existingDraft?._id) {
      await autosave.saveNow();
      return;
    }
    runWithCreditGuard(
      () =>
        void proceedPost((posted) => {
          setPostedInvoice(posted);
          setSendInvoiceOpen(true);
        }),
    );
  };

  // Closing the Send dialog (sent or dismissed) routes to the posted invoice view.
  const closeSendDialog = () => {
    const id = postedInvoice?._id;
    setSendInvoiceOpen(false);
    setPostedInvoice(null);
    if (id) {
      router.push(
        `/dashboard/finance/firms/${firmId}/sales/${VOUCHER_SEGMENTS[voucherType]}/${id}`,
      );
    }
  };

  const handleUndo = async (postedId: string) => {
    try {
      const apiKey = VOUCHER_API_KEYS[voucherType];
      await (financeSalesApi as any)[apiKey].cancel(
        ws!._id,
        firmId,
        postedId,
        'Undo within 30s undo window',
      );
      notification.info({ message: t('editor.toast.postingReversed') });
      router.push(
        `/dashboard/finance/firms/${firmId}/sales/${VOUCHER_SEGMENTS[voucherType]}/${postedId}`,
      );
    } catch (e: unknown) {
      notification.error({
        message: t('editor.toast.undoFailed'),
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  // Preview opens the saved document view (which carries the print action). A
  // brand-new draft has nothing to preview yet, so nudge the user to save first.
  const handlePreview = () => {
    if (existingDraft?._id) {
      router.push(
        `/dashboard/finance/firms/${firmId}/sales/${VOUCHER_SEGMENTS[voucherType]}/${existingDraft._id}`,
      );
    } else {
      notification.info({ message: t('editor.toast.saveDraftFirst') });
    }
  };

  const wsId = ws?._id ?? '';
  const tcsApplied = (existingDraft as any)?.tcsApplied as SaleInvoice['tcsApplied']; // eslint-disable-line @typescript-eslint/no-explicit-any

  // R8: Enter moves focus to the next field (Tally muscle memory). We deliberately do NOT
  // intercept Enter when AntD needs it - inside a Select/AutoComplete (option pick), a DatePicker,
  // or a textarea (newline) - or when a modifier is held. Scoped to editorRootRef so the rest of
  // the app's Enter handling is untouched.
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const target = e.target as HTMLElement;
    if (!target || target.tagName === 'TEXTAREA') return;
    if (target.closest('.ant-select') || target.closest('.ant-picker')) return;
    if (target.tagName !== 'INPUT') return;
    const root = editorRootRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null && el.getAttribute('readonly') === null);
    const idx = focusables.indexOf(target);
    if (idx >= 0 && idx < focusables.length - 1) {
      e.preventDefault();
      const next = focusables[idx + 1];
      next.focus();
      if (next instanceof HTMLInputElement && next.type !== 'checkbox' && next.type !== 'radio') {
        next.select();
      }
    }
  };

  // R4: confirm the dated amendment - store the reason, then retry the save which now
  // carries it (backend logs the audited amendment and writes into the locked period).
  const confirmAmendment = () => {
    const reason = amendmentReasonInput.trim();
    if (!reason) {
      notification.warning({ message: t('editor.amendment.required') });
      return;
    }
    amendmentReasonRef.current = reason;
    setLockPrompt(null);
    void autosave.saveNow();
  };

  return (
    <App>
      {/* R4: dated-amendment reason prompt for saving into a soft-locked period. */}
      <Modal
        open={!!lockPrompt}
        title={t('editor.amendment.title')}
        okText={t('editor.amendment.submit')}
        cancelText={t('editor.amendment.cancel')}
        onOk={confirmAmendment}
        onCancel={() => setLockPrompt(null)}
        destroyOnHidden
      >
        <p style={{ marginBottom: 12, color: 'var(--cr-text-2)' }}>
          {lockPrompt?.lockedUpto
            ? t('editor.amendment.body', { date: lockPrompt.lockedUpto })
            : t('editor.amendment.bodyNoDate')}
        </p>
        <Form.Item label={t('editor.amendment.label')} style={{ marginBottom: 0 }}>
          <TextArea
            value={amendmentReasonInput}
            onChange={(e) => setAmendmentReasonInput(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t('editor.amendment.placeholder')}
            autoFocus
          />
        </Form.Item>
      </Modal>
      {showRecoveryDialog && localDraft && (
        <DraftRecoveryDialog
          open={showRecoveryDialog}
          localDraft={localDraft}
          serverUpdatedAt={
            existingDraft?.updatedAt ? new Date(existingDraft.updatedAt).getTime() : null
          }
          onResume={() => {
            form.reset(localDraft.data as any); // eslint-disable-line @typescript-eslint/no-explicit-any
            setShowRecoveryDialog(false);
          }}
          onDiscard={() => {
            deleteDraft(draftKey);
            setShowRecoveryDialog(false);
          }}
        />
      )}

      {/* Keyboard-shortcuts cheat-sheet (opened with "?") - discoverability for the
          keyboard-first entry model. */}
      <Modal
        open={showShortcuts}
        onCancel={() => setShowShortcuts(false)}
        footer={null}
        title={t('editor.shortcuts.title')}
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Enter', t('editor.shortcuts.nextField')],
            ['Alt + C', t('editor.shortcuts.inlineCreate')],
            ['Alt + N', t('editor.shortcuts.addLine')],
            ['Ctrl + S', t('editor.shortcuts.saveDraft')],
            ['Ctrl + Enter', t('editor.shortcuts.savePost')],
            ['Esc', t('editor.shortcuts.goBack')],
            ['?', t('editor.shortcuts.showHelp')],
          ].map(([k, d]) => (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--cr-text-2)' }}>{d}</span>
              <kbd
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 12,
                  padding: '2px 8px',
                  border: '1px solid var(--cr-border)',
                  borderRadius: 6,
                  background: 'var(--cr-surface-2)',
                  whiteSpace: 'nowrap',
                }}
              >
                {k}
              </kbd>
            </div>
          ))}
        </div>
      </Modal>

      <ConcurrentEditBanner visible={concurrentEdit} onDismiss={() => setConcurrentEdit(false)} />

      {voucherType === 'sale_invoice' &&
        (existingDraft as SaleInvoice | undefined | null)?.eInvoice?.status === 'pending' && (
          <EInvoiceBanner
            invoiceId={existingDraft!._id}
            firmId={firmId}
            wsId={wsId}
            onRetry={() => router.refresh()}
          />
        )}

      <ConfigProvider
        theme={{
          token: { controlHeight: 38, controlHeightLG: 44, borderRadius: 10, fontSize: 14 },
        }}
      >
        {/* Title header as a plain block. The dashboard layout already supplies the
            cream background, horizontal padding and centered max-width (the same
            container the Tax Invoices list page renders in), so the title aligns
            exactly with that page - no extra wrapper of our own. */}
        <VoucherEditorHeader
          voucherType={voucherType}
          autosaveStatus={autosave.status}
          lastSavedAt={autosave.lastSavedAt}
          onSaveDraft={handleSaveDraft}
          onPost={handlePost}
          onSaveAndNew={handleSaveAndNew}
          onSaveAndPrint={handleSaveAndPrint}
          onSaveAndShare={handleSaveAndShare}
          onPreview={
            voucherType === 'sale_invoice' ? () => setLivePreviewOpen(true) : handlePreview
          }
          isPostable={!!existingDraft?._id && existingDraft.state === 'draft'}
          isPostLoading={postLoading}
          isNewDraft={mode === 'new' && !existingDraft?._id}
          // Once a voucher leaves draft it is no longer editable here: hide Save/Post and show a
          // status tag. pending_approval is acted on via InvoiceApprovalBar; posted/cancelled final.
          isReadOnly={isReadOnlyVoucher}
          voucherState={existingDraft?.state}
        />

        {showInvoiceExplainer && (
          <Alert
            type="info"
            showIcon
            closable
            style={{ marginBottom: 12 }}
            title={t('editor.invoiceExplainer.title')}
            description={t('editor.invoiceExplainer.body')}
            onClose={() => {
              setShowInvoiceExplainer(false);
              try {
                window.localStorage.setItem('finance.invoiceExplainerDismissed', '1');
              } catch {
                /* ignore storage errors */
              }
            }}
          />
        )}

        {voucherType === 'sale_invoice' && (
          <LivePreviewPanel
            open={livePreviewOpen}
            onClose={() => setLivePreviewOpen(false)}
            title={t('editor.header.preview')}
            watched={watched}
            taxResult={taxResult}
            firm={firm}
            firmId={firmId}
            wsId={ws?._id ?? ''}
          />
        )}

        {voucherType === 'sale_invoice' && sendInvoiceOpen && postedInvoice && (
          <SendInvoiceDialog
            open={sendInvoiceOpen}
            invoice={postedInvoice}
            firmId={firmId}
            onClose={closeSendDialog}
            onSent={closeSendDialog}
          />
        )}

        {/* Two-column document layout: main column (bill-to -> items -> notes) + a
            sticky Invoice Summary rail. Stacks on narrow screens via flex-wrap.
            R8: ref + onKeyDown power the scoped Enter-to-next-field navigation. */}
        <div
          ref={editorRootRef}
          onKeyDown={handleEditorKeyDown}
          style={{
            display: 'flex',
            gap: 20,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            marginTop: 16,
          }}
        >
          {/* Main column */}
          <div
            style={{
              flex: '1 1 640px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <EditorSection
              title={t('editor.section.billTo')}
              subtitle={t('editor.section.billToSubtitle')}
            >
              <InfoTab
                form={form}
                wsId={ws?._id ?? ''}
                firmId={firmId}
                voucherType={voucherType}
                onPartyItemRates={setPartyItemRates}
                onPartyCreditInfo={setPartyCreditInfo}
              />
            </EditorSection>

            <EditorSection
              title={t('editor.section.items')}
              extra={
                <span style={{ fontSize: 11, color: 'var(--cr-text-3)' }}>
                  {t('editor.section.itemsHint')}
                </span>
              }
              bodyPadding={0}
            >
              <div style={{ padding: '8px 16px 0' }}>
                <LineItemsTable
                  control={control}
                  firmId={firmId}
                  wsId={wsId}
                  voucherDate={watched.voucherDate}
                  taxContext={taxContext}
                  partyItemRates={partyItemRates}
                />
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                <AdditionalChargesInline control={control} />
              </div>
            </EditorSection>

            <EditorSection title={t('editor.section.notesTerms')}>
              <Form layout="vertical" colon={false} component={false}>
                <Row gutter={[16, 8]}>
                  <Col xs={24} md={12}>
                    <Form.Item label={t('editor.field.customerNotes')} style={{ marginBottom: 8 }}>
                      <Controller
                        name="notes"
                        control={control}
                        render={({ field }) => (
                          <TextArea
                            rows={3}
                            placeholder={t('editor.placeholder.customerNotes')}
                            {...field}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={t('editor.field.internalNotes')} style={{ marginBottom: 8 }}>
                      <Controller
                        name="internalNotes"
                        control={control}
                        render={({ field }) => (
                          <TextArea
                            rows={3}
                            placeholder={t('editor.placeholder.internalNotes')}
                            {...field}
                          />
                        )}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
              {(firm?.bankName || firm?.accountNumber) && (
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 10,
                    borderTop: '1px solid var(--cr-border-light, var(--cr-border))',
                    fontSize: 12,
                    color: 'var(--cr-text-3)',
                  }}
                >
                  {t('editor.bankDetails', {
                    details: [
                      firm?.bankName,
                      firm?.accountNumber ? `A/C ${firm.accountNumber}` : null,
                      firm?.ifscCode ? `IFSC ${firm.ifscCode}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · '),
                  })}
                </div>
              )}
            </EditorSection>

            {(voucherType === 'sale_invoice' || voucherType === 'delivery_challan') && (
              <EditorSection
                title={t('editor.section.shipping')}
                subtitle={t('editor.section.shippingSubtitle')}
              >
                <Form layout="vertical" colon={false} component={false}>
                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item label={t('editor.field.shippingMode')} style={{ marginBottom: 8 }}>
                        <Controller
                          name="shipping.mode"
                          control={control}
                          render={({ field }) => (
                            <Select
                              allowClear
                              placeholder={t('editor.placeholder.shippingMode')}
                              style={{ width: '100%' }}
                              value={(field.value as string) || undefined}
                              onChange={(v) => field.onChange(v ?? '')}
                              options={[
                                { value: 'road', label: t('editor.value.road') },
                                { value: 'rail', label: t('editor.value.rail') },
                                { value: 'air', label: t('editor.value.air') },
                                { value: 'ship', label: t('editor.value.ship') },
                              ]}
                            />
                          )}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item label={t('editor.field.vehicleLrNo')} style={{ marginBottom: 8 }}>
                        <Controller
                          name="shipping.vehicleNo"
                          control={control}
                          render={({ field }) => (
                            <Input
                              placeholder={t('editor.placeholder.vehicleOrLr')}
                              value={(field.value as string) ?? ''}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item label={t('editor.field.transporter')} style={{ marginBottom: 8 }}>
                        <Controller
                          name="shipping.transporter"
                          control={control}
                          render={({ field }) => (
                            <Input
                              placeholder={t('editor.placeholder.transporterName')}
                              value={(field.value as string) ?? ''}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item label={t('editor.field.distanceKm')} style={{ marginBottom: 8 }}>
                        <Controller
                          name="shipping.distance"
                          control={control}
                          render={({ field }) => (
                            <InputNumber
                              min={0}
                              style={{ width: '100%' }}
                              placeholder={t('editor.placeholder.distanceZero')}
                              value={(field.value as number | undefined) ?? undefined}
                              onChange={(v) => field.onChange(v ?? undefined)}
                            />
                          )}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={16}>
                      <Form.Item
                        label={t('editor.field.shipToAddress')}
                        style={{ marginBottom: 8 }}
                      >
                        <Controller
                          name="shipping.address"
                          control={control}
                          render={({ field }) => (
                            <TextArea
                              rows={2}
                              placeholder={t('editor.placeholder.shipToAddress')}
                              value={(field.value as string) ?? ''}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </EditorSection>
            )}

            {mode === 'edit' && (
              <EditorSection title={t('editor.section.documentHistory')} bodyPadding={0}>
                <Tabs
                  size="small"
                  defaultActiveKey="activity"
                  tabBarStyle={{ paddingLeft: 16, marginBottom: 0 }}
                  items={[
                    {
                      key: 'activity',
                      label: t('editor.tab.activity'),
                      children: <ActivityTab auditLog={existingDraft?.auditLog ?? []} />,
                    },
                    ...(voucherType === 'sale_invoice'
                      ? [
                          {
                            key: 'e-invoice',
                            label: t('editor.tab.eInvoice'),
                            children: <EInvoiceTab invoice={existingDraft} />,
                          },
                          {
                            key: 'e-way-bill',
                            label: t('editor.tab.eWayBill'),
                            children: <EwayBillTab invoice={existingDraft} />,
                          },
                        ]
                      : []),
                  ]}
                />
              </EditorSection>
            )}
          </div>

          {/* Sticky summary rail */}
          <div style={{ flex: '0 0 340px', maxWidth: '100%', width: 340 }}>
            <InvoiceSummaryRail
              result={taxResult}
              charges={(watched.additionalCharges ?? []) as AdditionalCharge[]}
              isIntraState={taxContext.firmStateCode === taxContext.placeOfSupplyStateCode}
              roundOff={roundOff}
              onRoundOffChange={setRoundOff}
            />
            {tcsApplied && (
              <div style={{ marginTop: 12 }}>
                <TcsInfoBox
                  amountPaise={tcsApplied.amountPaise}
                  partyName={
                    typeof (existingDraft as any)?.partySnapshot?.name === 'string' // eslint-disable-line @typescript-eslint/no-explicit-any
                      ? ((existingDraft as any).partySnapshot.name as string) // eslint-disable-line @typescript-eslint/no-explicit-any
                      : ''
                  }
                  cumulativePaise={tcsApplied.basePaise}
                />
              </div>
            )}
          </div>
        </div>
      </ConfigProvider>
    </App>
  );
}
