'use client';

import { useState } from 'react';
import {
  Table,
  Tag,
  Tooltip,
  Alert,
  Button,
  Input,
  InputNumber,
  Select,
  Modal,
  Popconfirm,
  message,
} from 'antd';
import { UserOutlined, PrinterOutlined } from '@ant-design/icons';
import Link from 'next/link';
import type { ColumnsType } from 'antd/es/table';
import {
  updateJwInvoice,
  postJwInvoice,
  cancelJwInvoice,
} from '@/lib/actions/finance/job-work.actions';
import {
  resolveJobWorkRate,
  JOB_WORK_TYPES,
  JOB_WORK_TYPE_LABELS,
} from '@/lib/finance/job-work-rate';
import { parseApiError } from '@/lib/utils';
import type { JobWorkInvoice, JwInvoiceLine, JobWorkType } from '@/types';

// ── Simple number-to-words helper (INR; handles up to crore range) ──
// TODO(F-11): wire a full numberToWords library for production-quality output
function numberToWordsINR(paise: number): string {
  const rupees = Math.floor(paise / 100);
  if (rupees === 0) return 'Zero Rupees Only';
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  function toWords(n: number): string {
    if (n < 20) return ones[n] ?? '';
    if (n < 100) return (tens[Math.floor(n / 10)] ?? '') + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    if (n < 1000)
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + toWords(n % 100) : '');
    if (n < 1_00_000)
      return (
        toWords(Math.floor(n / 1000)) +
        ' Thousand' +
        (n % 1000 !== 0 ? ' ' + toWords(n % 1000) : '')
      );
    if (n < 1_00_00_000)
      return (
        toWords(Math.floor(n / 1_00_000)) +
        ' Lakh' +
        (n % 1_00_000 !== 0 ? ' ' + toWords(n % 1_00_000) : '')
      );
    return (
      toWords(Math.floor(n / 1_00_00_000)) +
      ' Crore' +
      (n % 1_00_00_000 !== 0 ? ' ' + toWords(n % 1_00_00_000) : '')
    );
  }

  return 'Rupees ' + toWords(rupees) + ' Only';
}

const UNIT_OPTIONS = [
  { value: 'MTR', label: 'Meter' },
  { value: 'KGS', label: 'KG' },
  { value: 'NOS', label: 'Nos' },
  { value: 'SET', label: 'Set' },
  { value: 'PCS', label: 'Piece' },
  { value: 'OTH', label: 'Other' },
];

interface EditLine {
  lineNo: number;
  description: string;
  hsnCode: string;
  qty: number;
  unit: string;
  ratePaise: number;
  taxRate: number;
  jobWorkType?: JobWorkType;
  amountPaise: number;
  jobWorkLotId?: string;
}

interface Props {
  wsId: string;
  firmId: string;
  invoice: JobWorkInvoice;
  onUpdated: (inv: JobWorkInvoice) => void;
}

export default function JwInvoiceDetail({ wsId, firmId, invoice, onUpdated }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [editLines, setEditLines] = useState<EditLine[]>(() =>
    invoice.lines.map((l) => ({ ...l })),
  );

  const [posting, setPosting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelInput, setCancelInput] = useState('');
  const [zeroRateWarning, setZeroRateWarning] = useState(false);

  // ── Party info ─────────────────────────────────────────────────
  const party = typeof invoice.partyId === 'object' ? invoice.partyId : null;
  const partyName = party?.name ?? (invoice.partySnapshot?.name as string) ?? 'Unknown Party';
  const partyGstin = party?.gstin ?? (invoice.partySnapshot?.gstin as string);
  const isIntrastate = !!(invoice.cgstPaise || invoice.sgstPaise);

  // ── Compute totals from editLines (when in edit mode) ─────────
  const subTotal = editLines.reduce((s, l) => s + l.qty * l.ratePaise, 0);
  // Tax is computed PER LINE - a single invoice can mix 5% (embroidery) and
  // 18% (dyeing/printing) lines, so we cannot apply one blanket rate.
  const lineTaxPaise = (l: EditLine) => Math.round(l.qty * l.ratePaise * (l.taxRate / 100));
  const totalTax = editLines.reduce((s, l) => s + lineTaxPaise(l), 0);
  const cgst = isIntrastate ? Math.round(totalTax / 2) : 0;
  const sgst = isIntrastate ? totalTax - cgst : 0;
  const igst = isIntrastate ? 0 : totalTax;
  const total = subTotal + (isIntrastate ? cgst + sgst : igst);

  // ── Update edit line ───────────────────────────────────────────
  function updateEditLine(idx: number, patch: Partial<EditLine>) {
    setEditLines((prev) => {
      const updated = [...prev];
      const line = { ...updated[idx], ...patch };
      line.amountPaise = line.qty * line.ratePaise;
      updated[idx] = line;
      return updated;
    });
  }

  // ── Save edits ─────────────────────────────────────────────────
  async function handleSave() {
    try {
      const updated = await updateJwInvoice(wsId, firmId, invoice._id, {
        lines: editLines.map((l) => ({
          description: l.description,
          qty: l.qty,
          unit: l.unit,
          ratePaise: l.ratePaise,
          jobWorkType: l.jobWorkType,
          jobWorkLotId: l.jobWorkLotId,
        })),
      });
      setEditMode(false);
      onUpdated(updated);
      message.success('Invoice updated', 3);
    } catch (err) {
      message.error(parseApiError(err), 6);
    }
  }

  // ── Post invoice ───────────────────────────────────────────────
  async function handlePost() {
    const zeroRate = (editMode ? editLines : invoice.lines).some((l) => l.ratePaise === 0);
    if (zeroRate) {
      setZeroRateWarning(true);
      message.error(
        'Enter a rate for all line items before posting. Invoice total is currently ₹0.',
        6,
      );
      return;
    }
    setZeroRateWarning(false);
    setPosting(true);
    try {
      // If in edit mode, save first
      if (editMode) {
        await updateJwInvoice(wsId, firmId, invoice._id, {
          lines: editLines.map((l) => ({
            description: l.description,
            qty: l.qty,
            unit: l.unit,
            ratePaise: l.ratePaise,
            jobWorkType: l.jobWorkType,
            jobWorkLotId: l.jobWorkLotId,
          })),
        });
      }
      const posted = await postJwInvoice(wsId, firmId, invoice._id);
      setEditMode(false);
      onUpdated(posted);
      message.success('Invoice posted. Ledger entries created.', 4.5);
    } catch (err) {
      message.error(parseApiError(err), 6);
    } finally {
      setPosting(false);
    }
  }

  // ── Cancel invoice ─────────────────────────────────────────────
  async function handleCancelConfirm() {
    if (cancelInput !== 'CANCEL') return;
    setCancelling(true);
    try {
      const cancelled = await cancelJwInvoice(wsId, firmId, invoice._id);
      setCancelModalOpen(false);
      onUpdated(cancelled);
      message.success('Invoice cancelled. Ledger entries reversed.', 4.5);
    } catch (err) {
      message.error(parseApiError(err), 6);
    } finally {
      setCancelling(false);
    }
  }

  // ── Line items table columns ───────────────────────────────────
  const viewColumns: ColumnsType<JwInvoiceLine> = [
    { title: '#', width: 40, render: (_v, _r, i) => i + 1 },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (v: string, _r, i: number) =>
        editMode ? (
          <Input
            value={editLines[i]?.description ?? v}
            onChange={(e) => updateEditLine(i, { description: e.target.value })}
          />
        ) : (
          <span style={{ fontSize: 14 }}>{v}</span>
        ),
    },
    {
      title: 'HSN',
      dataIndex: 'hsnCode',
      width: 100,
      render: () => (
        <Tooltip
          title="HSN 9988 - Textile Job-Work. 5% for general textile job-work (embroidery/stitching); 18% for dyeing/printing and residuary job-work. Set the rate per line via the Type column."
          mouseEnterDelay={0.3}
        >
          <Tag
            style={{
              background: 'var(--cr-orange-bg)',
              color: 'var(--cr-orange)',
              border: 'none',
              cursor: 'help',
            }}
          >
            9988
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      width: 90,
      render: (v: number, _r, i: number) =>
        editMode ? (
          <InputNumber
            value={editLines[i]?.qty ?? v}
            min={0.001}
            style={{ width: 80 }}
            onChange={(val) => updateEditLine(i, { qty: val ?? 0 })}
          />
        ) : (
          <span style={{ fontSize: 14 }}>{v}</span>
        ),
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      width: 90,
      render: (v: string, _r, i: number) =>
        editMode ? (
          <Select
            value={editLines[i]?.unit ?? v}
            options={UNIT_OPTIONS}
            style={{ width: 80 }}
            onChange={(val) => updateEditLine(i, { unit: val })}
          />
        ) : (
          <span style={{ fontSize: 14 }}>{v}</span>
        ),
    },
    {
      title: 'Rate (₹) *',
      dataIndex: 'ratePaise',
      width: 120,
      render: (v: number, _r, i: number) => {
        const isZero = (editMode ? editLines[i]?.ratePaise : v) === 0;
        return editMode ? (
          <InputNumber
            value={(editLines[i]?.ratePaise ?? v) / 100}
            min={0}
            precision={2}
            prefix="₹"
            style={{ width: 100, borderColor: isZero ? 'var(--cr-error)' : undefined }}
            onChange={(val) => updateEditLine(i, { ratePaise: Math.round((val ?? 0) * 100) })}
          />
        ) : (
          <span style={{ fontSize: 14, color: isZero ? 'var(--cr-error)' : undefined }}>
            ₹{(v / 100).toFixed(2)}
          </span>
        );
      },
    },
    {
      title: 'Type',
      width: 180,
      render: (_v, r: JwInvoiceLine, i: number) =>
        editMode ? (
          <Select<JobWorkType>
            value={editLines[i]?.jobWorkType ?? 'general_textile'}
            options={JOB_WORK_TYPES.map((t) => ({ value: t, label: JOB_WORK_TYPE_LABELS[t] }))}
            style={{ width: 168 }}
            onChange={(val) =>
              updateEditLine(i, { jobWorkType: val, taxRate: resolveJobWorkRate(val) })
            }
          />
        ) : (
          <span style={{ fontSize: 14 }}>
            {JOB_WORK_TYPE_LABELS[r.jobWorkType ?? 'general_textile']}
          </span>
        ),
    },
    {
      title: 'Tax %',
      width: 70,
      render: (_v, r: JwInvoiceLine, i: number) => {
        const rate = editMode ? (editLines[i]?.taxRate ?? 5) : (r.taxRate ?? 5);
        return (
          <Tag style={{ background: 'var(--cr-info-bg)', color: 'var(--cr-info)', border: 'none' }}>
            {rate}%
          </Tag>
        );
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amountPaise',
      width: 110,
      align: 'right',
      render: (v: number, _r, i: number) => {
        const amt = editMode ? editLines[i]?.qty * editLines[i]?.ratePaise : v;
        return <span style={{ fontSize: 14 }}>₹{((amt ?? 0) / 100).toFixed(2)}</span>;
      },
    },
  ];

  // ── Tax summary display values ─────────────────────────────────
  const displaySubTotal = editMode ? subTotal : invoice.subTotalPaise;
  const displayCgst = editMode ? cgst : (invoice.cgstPaise ?? 0);
  const displaySgst = editMode ? sgst : (invoice.sgstPaise ?? 0);
  const displayIgst = editMode ? igst : (invoice.igstPaise ?? 0);
  const displayTotal = editMode ? total : invoice.totalPaise;
  const displayLines = editMode ? (editLines as unknown as JwInvoiceLine[]) : invoice.lines;

  return (
    <div>
      {/* ── Invoice header ─────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--cr-surface)',
          borderRadius: 8,
          padding: 20,
          border: '1px solid var(--cr-border)',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              {partyName}
            </div>
            {partyGstin && (
              <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>{partyGstin}</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
              Against Challan:{' '}
              <Link
                href={`/dashboard/finance/firms/${firmId}/job-work/outward-challans/${invoice.jwOutwardChallanId}`}
                style={{ color: 'var(--cr-primary)' }}
              >
                {invoice.jwOutwardChallanNo ?? String(invoice.jwOutwardChallanId)}
              </Link>
            </div>
            <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
              Date:{' '}
              {new Date(invoice.voucherDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </div>
            {invoice.dueDate && (
              <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
                Due:{' '}
                {new Date(invoice.dueDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
              Place of Supply: {invoice.placeOfSupplyStateCode}
            </div>
          </div>
        </div>
      </div>

      {/* ── Zero rate warning ──────────────────────────────────────── */}
      {(zeroRateWarning || displayLines.some((l) => l.ratePaise === 0)) &&
        invoice.status === 'draft' && (
          <Alert
            type="warning"
            title="Enter a rate for all line items before posting. Invoice total is currently ₹0."
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

      {/* ── Line items ─────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--cr-surface)',
          borderRadius: 8,
          padding: 16,
          border: '1px solid var(--cr-border)',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3
            style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}
          >
            Line Items
          </h3>
          {invoice.status === 'draft' && !editMode && (
            <Button size="small" onClick={() => setEditMode(true)}>
              Edit
            </Button>
          )}
          {editMode && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="small" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
              <Button size="small" type="primary" onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          )}
        </div>
        <Table<JwInvoiceLine>
          dataSource={displayLines}
          columns={viewColumns}
          pagination={false}
          rowKey="lineNo"
          size="small"
          rowClassName={(r) => (r.ratePaise === 0 && editMode ? 'ant-table-row-amber' : '')}
        />

        {/* Tax summary */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 280 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              <span style={{ color: 'var(--cr-text-3)' }}>Sub-total</span>
              <span>₹{(displaySubTotal / 100).toFixed(2)}</span>
            </div>
            {isIntrastate ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 14,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: 'var(--cr-text-3)' }}>CGST</span>
                  <span>₹{(displayCgst / 100).toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 14,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: 'var(--cr-text-3)' }}>SGST</span>
                  <span>₹{(displaySgst / 100).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: 'var(--cr-text-3)' }}>IGST</span>
                <span>₹{(displayIgst / 100).toFixed(2)}</span>
              </div>
            )}
            {invoice.roundOffPaise ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: 'var(--cr-text-3)' }}>Round-off</span>
                <span>₹{(invoice.roundOffPaise / 100).toFixed(2)}</span>
              </div>
            ) : null}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 16,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                borderTop: '1px solid var(--cr-border)',
                paddingTop: 8,
                marginTop: 8,
              }}
            >
              <span>Total</span>
              <span>₹{(displayTotal / 100).toFixed(2)}</span>
            </div>
            <div
              style={{ fontSize: 13, color: 'var(--cr-text-3)', fontStyle: 'italic', marginTop: 4 }}
            >
              {numberToWordsINR(displayTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Karigar attribution ─────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--cr-surface)',
          borderRadius: 8,
          padding: 16,
          border: '1px solid var(--cr-border)',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'var(--cr-text-3)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          Work performed by:
        </div>
        {invoice.karigarIds?.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {invoice.karigarIds.map((k) => (
              <Tag key={String(k)} icon={<UserOutlined />} style={{ fontSize: 13 }}>
                {typeof k === 'object' && k !== null && 'name' in k
                  ? (k as { name: string }).name
                  : String(k)}
              </Tag>
            ))}
          </div>
        ) : (
          <span style={{ color: 'var(--cr-text-3)', fontSize: 13 }}>
            No karigar attribution recorded
          </span>
        )}
      </div>

      {/* ── Status action bar ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 8 }}>
        {invoice.status === 'draft' && (
          <>
            <Button type="primary" loading={posting} onClick={handlePost}>
              Post Invoice
            </Button>
            <Popconfirm
              title="Delete this draft invoice?"
              description="This action cannot be undone."
              okText="Delete Draft"
              okButtonProps={{ danger: true }}
              cancelText="Keep"
              onConfirm={async () => {
                try {
                  const cancelled = await cancelJwInvoice(wsId, firmId, invoice._id);
                  onUpdated(cancelled);
                  message.success('Draft deleted', 3);
                } catch (err) {
                  message.error(parseApiError(err), 6);
                }
              }}
            >
              <Button danger>Delete Draft</Button>
            </Popconfirm>
          </>
        )}

        {invoice.status === 'posted' && (
          <>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Print PDF
            </Button>
            <Button type="primary" disabled>
              Record Payment
            </Button>
            <Button
              danger
              onClick={() => {
                setCancelInput('');
                setCancelModalOpen(true);
              }}
            >
              Cancel Invoice
            </Button>
          </>
        )}

        {invoice.status === 'cancelled' && invoice.ledgerEntryIds?.length > 0 && (
          <Button type="link">View Ledger Entry</Button>
        )}
      </div>

      {/* ── Cancel invoice modal ───────────────────────────────────── */}
      <Modal
        open={cancelModalOpen}
        title={`Cancel Invoice - ${invoice.voucherNumber}`}
        onCancel={() => !cancelling && setCancelModalOpen(false)}
        footer={[
          <Button key="back" onClick={() => setCancelModalOpen(false)} disabled={cancelling}>
            Go Back
          </Button>,
          <Button
            key="confirm"
            danger
            loading={cancelling}
            disabled={cancelInput !== 'CANCEL'}
            onClick={handleCancelConfirm}
          >
            Confirm Cancel
          </Button>,
        ]}
      >
        <p style={{ fontSize: 14, marginBottom: 16 }}>
          Cancelling this posted invoice will reverse all ledger entries (Dr 4020, Cr 1003, Cr GST
          accounts). This cannot be undone.
        </p>
        <p style={{ fontSize: 13, color: 'var(--cr-text-3)', marginBottom: 8 }}>
          This will reverse all accounting entries for invoice {invoice.voucherNumber}. Type CANCEL
          to confirm.
        </p>
        <Input
          value={cancelInput}
          onChange={(e) => setCancelInput(e.target.value)}
          placeholder="Type CANCEL to confirm"
          style={{
            borderColor: cancelInput && cancelInput !== 'CANCEL' ? 'var(--cr-error)' : undefined,
          }}
        />
      </Modal>
    </div>
  );
}
