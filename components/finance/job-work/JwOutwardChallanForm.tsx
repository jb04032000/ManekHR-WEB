'use client';

import { useState, useCallback, useRef } from 'react';
import { Button, Select, Table, InputNumber, Collapse, Form, Input, Alert, message } from 'antd';
import { DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  createJwOutwardChallan,
  postJwOutwardChallan,
  updateJwOutwardChallan,
  listJwLots,
} from '@/lib/actions/finance/job-work.actions';
import { listParties } from '@/lib/actions/finance.actions';
import { listTeam } from '@/lib/actions/team.actions';
import { parseApiError } from '@/lib/utils';
import type {
  JobWorkOutwardChallan,
  JobWorkLot,
  CreateJwOutwardPayload,
  Party,
  TeamMember,
} from '@/types';

const WASTAGE_REASON_OPTIONS = [
  { value: 'cutting', label: 'Cutting' },
  { value: 'breakage', label: 'Breakage' },
  { value: 'color_damage', label: 'Color Damage' },
  { value: 'machine_fault', label: 'Machine Fault' },
  { value: 'design_rework', label: 'Design Rework' },
  { value: 'shrinkage', label: 'Shrinkage' },
  { value: 'other', label: 'Other' },
];

// Helper: extract string partyId from populated-or-string field
function extractPartyId(
  partyId?: string | { _id: string; name: string; gstin?: string; stateCode?: string },
): string {
  if (!partyId) return '';
  if (typeof partyId === 'string') return partyId;
  return partyId._id;
}

function extractPartyStateCode(
  partyId?: string | { _id: string; name: string; gstin?: string; stateCode?: string },
): string {
  if (!partyId || typeof partyId === 'string') return '';
  return partyId.stateCode ?? '';
}

function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

interface ReturnLine {
  key: string;
  lot: JobWorkLot;
  qtyReturning: number | null;
  qtyWasted: number | null;
  wastageReason: string | null;
  karigarIds: string[];
  qtyError: string;
  wastageError: string;
}

interface Props {
  wsId: string;
  firmId: string;
  initial?: JobWorkOutwardChallan;
  onSaved: (result: {
    jwo: JobWorkOutwardChallan;
    invoiceId: string;
    invoiceNumberHint: string;
  }) => void;
}

export default function JwOutwardChallanForm({ wsId, firmId, initial, onSaved }: Props) {
  // ── Party ──────────────────────────────────────────────────────
  const [parties, setParties] = useState<Party[]>([]);
  const [partyLoading, setPartyLoading] = useState(false);
  const [partyId, setPartyId] = useState<string>(extractPartyId(initial?.partyId));
  const [partyStateCode, setPartyStateCode] = useState<string>(
    extractPartyStateCode(initial?.partyId),
  );
  const partyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Lots ───────────────────────────────────────────────────────
  const [lots, setLots] = useState<JobWorkLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);

  // ── Karigars (mandatory) ───────────────────────────────────────
  const [karigars, setKarigars] = useState<TeamMember[]>([]);
  const [karigarLoading, setKarigarLoading] = useState(false);
  const [karigarIds, setKarigarIds] = useState<string[]>(initial?.karigarIds?.map(String) ?? []);
  const karigarLoaded = useRef(false);

  // ── Transport ──────────────────────────────────────────────────
  const [vehicleNo, setVehicleNo] = useState(initial?.vehicleNo ?? '');
  const [transporterName, setTransporterName] = useState(initial?.transporterName ?? '');
  const [transporterGSTIN, setTransporterGSTIN] = useState(initial?.transporterGSTIN ?? '');
  const [lrNo, setLrNo] = useState(initial?.lrNo ?? '');
  const [narration, setNarration] = useState(initial?.narration ?? '');

  // ── UI state ───────────────────────────────────────────────────
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Load parties ───────────────────────────────────────────────
  const handlePartySearch = useCallback(
    (q: string) => {
      if (partyDebounce.current) clearTimeout(partyDebounce.current);
      partyDebounce.current = setTimeout(async () => {
        setPartyLoading(true);
        try {
          const res = await listParties(wsId, firmId, { q, pageSize: 20 });
          setParties(res.items ?? []);
        } catch {
          message.error('Failed to load parties - check your connection', 3);
        } finally {
          setPartyLoading(false);
        }
      }, 300);
    },
    [wsId, firmId],
  );

  // ── On party select: fetch pending lots ───────────────────────
  const handlePartyChange = useCallback(
    async (id: string) => {
      setPartyId(id);
      setSelectedLotIds([]);
      setReturnLines([]);
      // capture state code from parties list
      const found = parties.find((p) => p._id === id);
      setPartyStateCode(found?.state ?? '');
      if (!id) {
        setLots([]);
        return;
      }
      setLotsLoading(true);
      try {
        const allLots = await listJwLots(wsId, firmId, { partyId: id, status: 'pending,partial' });
        setLots(allLots);
      } catch {
        message.error('Failed to load pending lots - check your connection', 3);
      } finally {
        setLotsLoading(false);
      }
    },
    [wsId, firmId, parties],
  );

  // ── On lot selection: populate return lines ────────────────────
  const handleLotSelect = useCallback(
    (ids: string[]) => {
      setSelectedLotIds(ids);
      setReturnLines((prev) => {
        const existing = new Map(prev.map((l) => [l.lot._id, l]));
        const nextLines: ReturnLine[] = [];
        for (const id of ids) {
          if (existing.has(id)) {
            nextLines.push(existing.get(id)!);
          } else {
            const lot = lots.find((l) => l._id === id);
            if (lot) {
              nextLines.push({
                key: id,
                lot,
                qtyReturning: null,
                qtyWasted: null,
                wastageReason: null,
                karigarIds: [],
                qtyError: '',
                wastageError: '',
              });
            }
          }
        }
        return nextLines;
      });
    },
    [lots],
  );

  // ── Load karigars ──────────────────────────────────────────────
  const loadKarigars = useCallback(async () => {
    if (karigarLoaded.current) return;
    karigarLoaded.current = true;
    setKarigarLoading(true);
    try {
      const res = await listTeam(wsId, { isKarigar: true } as never);
      setKarigars((res.members ?? []) as TeamMember[]);
    } catch {
      /* silent */
    } finally {
      setKarigarLoading(false);
    }
  }, [wsId]);

  // ── Update return line ─────────────────────────────────────────
  function updateReturnLine(key: string, patch: Partial<ReturnLine>) {
    setReturnLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const updated = { ...l, ...patch };
        const remaining = l.lot.qtyRemaining;
        const ret = updated.qtyReturning ?? 0;
        const wasted = updated.qtyWasted ?? 0;
        updated.qtyError =
          ret > remaining ? `Cannot exceed remaining qty (${remaining} ${l.lot.unit})` : '';
        updated.wastageError =
          ret + wasted > remaining ? 'Total return + wastage exceeds remaining qty' : '';
        return updated;
      }),
    );
  }

  function removeReturnLine(key: string) {
    setReturnLines((prev) => prev.filter((l) => l.key !== key));
    setSelectedLotIds((prev) => prev.filter((id) => id !== key));
  }

  // ── Validation ─────────────────────────────────────────────────
  function validate(): boolean {
    if (!partyId) {
      setFormError('Select a principal party to continue');
      return false;
    }
    if (returnLines.length === 0) {
      setFormError('Select at least one pending lot to return');
      return false;
    }
    const hasQtyError = returnLines.some((l) => l.qtyError || l.wastageError);
    if (hasQtyError) {
      setFormError('Fix qty errors before posting');
      return false;
    }
    const missingQty = returnLines.some((l) => !l.qtyReturning || l.qtyReturning <= 0);
    if (missingQty) {
      setFormError('Enter quantity to return for all lines');
      return false;
    }
    if (!karigarIds.length) {
      setFormError('At least one karigar must be assigned before posting an Outward Challan');
      return false;
    }
    setFormError('');
    return true;
  }

  // ── Build payload ──────────────────────────────────────────────
  function buildPayload(): CreateJwOutwardPayload {
    return {
      voucherDate: initial?.voucherDate ?? todayISODate(),
      partyId,
      placeOfSupplyStateCode: partyStateCode || undefined, // let backend resolve from party/firm GSTIN
      vehicleNo: vehicleNo || undefined,
      transporterName: transporterName || undefined,
      transporterGSTIN: transporterGSTIN || undefined,
      lrNo: lrNo || undefined,
      returnLines: returnLines.map((l, i) => ({
        lineNo: i + 1,
        jobWorkLotId: l.lot._id,
        lotNo: l.lot.lotNo,
        itemDescription: l.lot.itemDescription,
        qtyReturning: l.qtyReturning!,
        unit: l.lot.unit,
        karigarIds: l.karigarIds.length ? l.karigarIds : undefined,
      })),
      wastageLines: returnLines
        .filter((l) => l.qtyWasted && l.qtyWasted > 0)
        .map((l, i) => ({
          lineNo: i + 1,
          jobWorkLotId: l.lot._id,
          itemDescription: l.lot.itemDescription,
          qtyWasted: l.qtyWasted!,
          unit: l.lot.unit,
          reasonCode: (l.wastageReason ?? 'other') as
            | 'cutting'
            | 'breakage'
            | 'color_damage'
            | 'machine_fault'
            | 'design_rework'
            | 'shrinkage'
            | 'other',
          narration: undefined,
        })),
      karigarIds,
      narration: narration || undefined,
    };
  }

  // ── Post ───────────────────────────────────────────────────────
  async function handlePost() {
    if (!validate()) return;
    setPosting(true);
    try {
      const payload = buildPayload();
      let jwo: JobWorkOutwardChallan;
      if (initial && initial.status === 'draft') {
        jwo = await updateJwOutwardChallan(wsId, firmId, initial._id, payload);
      } else if (!initial) {
        jwo = await createJwOutwardChallan(wsId, firmId, payload);
      } else {
        jwo = initial;
      }
      const result = await postJwOutwardChallan(wsId, firmId, jwo._id);
      message.success(
        <span>
          Challan posted. Draft invoice <strong>{result.invoiceNumberHint}</strong> created - enter
          rate and post to bill principal.{' '}
          <a
            href={`/dashboard/finance/firms/${firmId}/job-work/invoices/${result.invoiceId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--cr-primary)' }}
          >
            View Invoice
          </a>
        </span>,
        4.5,
      );
      onSaved(result);
    } catch (err) {
      const msg = parseApiError(err);
      message.error(msg, 6);
      setFormError(msg);
    } finally {
      setPosting(false);
    }
  }

  const isPosted = initial?.status === 'posted' || initial?.status === 'cancelled';

  // ── Return lines table columns ────────────────────────────────
  const returnLineColumns: ColumnsType<ReturnLine> = [
    {
      title: 'Lot No',
      dataIndex: ['lot', 'lotNo'],
      width: 160,
      render: (v: string) => (
        <span style={{ color: 'var(--cr-primary)', fontSize: 14, fontWeight: 600 }}>{v}</span>
      ),
    },
    {
      title: 'Item Description',
      dataIndex: ['lot', 'itemDescription'],
      render: (v: string) => <span style={{ fontSize: 14, color: 'var(--cr-text-3)' }}>{v}</span>,
    },
    {
      title: 'Remaining',
      dataIndex: ['lot', 'qtyRemaining'],
      width: 100,
      render: (v: number, row: ReturnLine) => (
        <span style={{ color: 'var(--cr-text-3)', fontSize: 13 }}>
          {v} {row.lot.unit}
        </span>
      ),
    },
    {
      title: 'Qty Returning *',
      dataIndex: 'qtyReturning',
      width: 140,
      render: (v: number | null, row: ReturnLine) => (
        <div>
          <InputNumber
            value={v}
            min={0}
            max={row.lot.qtyRemaining}
            style={{ width: '100%', borderColor: row.qtyError ? 'var(--cr-error)' : undefined }}
            onChange={(val) => updateReturnLine(row.key, { qtyReturning: val })}
          />
          {row.qtyError && (
            <div style={{ color: 'var(--cr-error)', fontSize: 12, marginTop: 2 }}>
              {row.qtyError}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Wastage',
      dataIndex: 'qtyWasted',
      width: 130,
      render: (v: number | null, row: ReturnLine) => (
        <div>
          <InputNumber
            value={v}
            min={0}
            max={row.lot.qtyRemaining}
            placeholder="0"
            style={{ width: '100%', borderColor: row.wastageError ? 'var(--cr-error)' : undefined }}
            onChange={(val) => updateReturnLine(row.key, { qtyWasted: val })}
          />
          {row.wastageError && (
            <div style={{ color: 'var(--cr-error)', fontSize: 12, marginTop: 2 }}>
              {row.wastageError}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Wastage Reason',
      dataIndex: 'wastageReason',
      width: 160,
      render: (v: string | null, row: ReturnLine) => (
        <Select
          allowClear
          value={v ?? undefined}
          placeholder="Select reason"
          style={{ width: '100%' }}
          options={WASTAGE_REASON_OPTIONS}
          onChange={(val) => updateReturnLine(row.key, { wastageReason: val ?? null })}
        />
      ),
    },
    {
      title: <span className="sr-only">Delete</span>,
      width: 44,
      render: (_v: unknown, row: ReturnLine) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          aria-label="Remove line"
          onClick={() => removeReturnLine(row.key)}
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* ── Left column ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Party picker */}
        <div
          style={{
            background: 'var(--cr-surface)',
            borderRadius: 8,
            padding: 16,
            border: '1px solid var(--cr-border)',
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Principal Party
          </h3>
          <Select
            showSearch
            style={{ width: '100%' }}
            placeholder="Search principal party..."
            value={partyId || undefined}
            filterOption={false}
            onSearch={handlePartySearch}
            onChange={handlePartyChange}
            onFocus={() => handlePartySearch('')}
            loading={partyLoading}
            options={parties.map((p) => ({
              value: p._id,
              label: (
                <div>
                  <div style={{ fontSize: 14 }}>{p.name}</div>
                  {p.gstin && (
                    <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>{p.gstin}</div>
                  )}
                </div>
              ),
            }))}
          />
        </div>

        {/* Lots picker (shown after party selected) */}
        {partyId && (
          <div
            style={{
              background: 'var(--cr-surface)',
              borderRadius: 8,
              padding: 16,
              border: '1px solid var(--cr-border)',
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              Select Pending Lots
            </h3>
            {lotsLoading ? (
              <div style={{ color: 'var(--cr-text-3)', fontSize: 14 }}>Loading pending lots...</div>
            ) : lots.length === 0 ? (
              <p style={{ color: 'var(--cr-text-3)', fontSize: 14 }}>
                No pending or partial lots found for this principal.
              </p>
            ) : (
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                placeholder="Select lots to return..."
                value={selectedLotIds}
                onChange={handleLotSelect}
                options={lots.map((l) => ({
                  value: l._id,
                  label: `${l.lotNo} - ${l.itemDescription} (${l.qtyRemaining} ${l.unit} remaining)`,
                }))}
              />
            )}
          </div>
        )}

        {/* Return lines table */}
        {returnLines.length > 0 && (
          <div
            style={{
              background: 'var(--cr-surface)',
              borderRadius: 8,
              padding: 16,
              border: '1px solid var(--cr-border)',
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              Return Lines
            </h3>
            <Table<ReturnLine>
              dataSource={returnLines}
              columns={returnLineColumns}
              pagination={false}
              rowKey="key"
              size="small"
              scroll={{ x: 800 }}
            />
          </div>
        )}

        {/* Karigar attribution (mandatory) */}
        <div
          style={{
            background: 'var(--cr-surface)',
            borderRadius: 8,
            padding: 16,
            border: '1px solid var(--cr-border)',
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Karigar Attribution <span style={{ color: 'var(--cr-error)' }}>*</span>
          </h3>
          <Form.Item
            validateStatus={formError.includes('karigar') ? 'error' : ''}
            help={formError.includes('karigar') ? formError : undefined}
          >
            <Select
              mode="multiple"
              placeholder="Select karigars who performed the work (required)"
              value={karigarIds}
              options={karigars.map((k) => ({
                value: k.id,
                label: `${k.name}${k.karigarSkillType ? ` (${k.karigarSkillType})` : ''}`,
              }))}
              onFocus={loadKarigars}
              loading={karigarLoading}
              onChange={setKarigarIds}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <p style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
            At least one karigar must be assigned before posting an Outward Challan.
          </p>
        </div>

        {/* Transport */}
        <Collapse
          ghost
          items={[
            {
              key: 'transport',
              label: <span style={{ fontSize: 14 }}>Transport Details (optional)</span>,
              style: {
                background: 'var(--cr-surface)',
                border: '1px solid var(--cr-border)',
                borderRadius: 8,
              },
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Form.Item label={<span style={{ fontSize: 13 }}>Vehicle No.</span>}>
                    <Input
                      value={vehicleNo}
                      onChange={(e) => setVehicleNo(e.target.value)}
                      placeholder="GJ-05 AB 1234"
                    />
                  </Form.Item>
                  <Form.Item label={<span style={{ fontSize: 13 }}>Transporter Name</span>}>
                    <Input
                      value={transporterName}
                      onChange={(e) => setTransporterName(e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label={<span style={{ fontSize: 13 }}>Transporter GSTIN</span>}>
                    <Input
                      value={transporterGSTIN}
                      onChange={(e) => setTransporterGSTIN(e.target.value)}
                      placeholder="22XXXXX..."
                    />
                  </Form.Item>
                  <Form.Item label={<span style={{ fontSize: 13 }}>LR No.</span>}>
                    <Input
                      value={lrNo}
                      onChange={(e) => setLrNo(e.target.value)}
                      placeholder="Lorry receipt no."
                    />
                  </Form.Item>
                </div>
              ),
            },
          ]}
        />

        {/* Narration */}
        <div
          style={{
            background: 'var(--cr-surface)',
            borderRadius: 8,
            padding: 16,
            border: '1px solid var(--cr-border)',
          }}
        >
          <Form.Item label={<span style={{ fontSize: 13 }}>Narration</span>}>
            <Input.TextArea
              rows={2}
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Narration / remarks"
            />
          </Form.Item>
        </div>
      </div>

      {/* ── Right column ─────────────────────────────────────────────── */}
      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            background: 'var(--cr-surface)',
            borderRadius: 8,
            padding: 16,
            border: '1px solid var(--cr-border)',
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Actions
          </h3>

          {formError && (
            <Alert
              type="error"
              title={formError}
              style={{ marginBottom: 12, fontSize: 13 }}
              showIcon
            />
          )}

          {!isPosted && (
            <Button
              block
              type="primary"
              loading={posting}
              icon={posting ? <LoadingOutlined /> : null}
              disabled={
                !partyId ||
                returnLines.length === 0 ||
                karigarIds.length === 0 ||
                returnLines.some((l) => l.qtyError || l.wastageError)
              }
              onClick={handlePost}
            >
              Post Challan &amp; Create Invoice
            </Button>
          )}
          {isPosted && (
            <p style={{ color: 'var(--cr-text-3)', fontSize: 13 }}>
              Challan is {initial?.status} and cannot be edited.
            </p>
          )}
        </div>

        {/* Summary */}
        {returnLines.length > 0 && (
          <div
            style={{
              background: 'var(--cr-surface)',
              borderRadius: 8,
              padding: 16,
              border: '1px solid var(--cr-border)',
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Summary
            </h3>
            <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
              <div>Lots: {returnLines.length}</div>
              <div>
                Total Returning:{' '}
                {returnLines.reduce((s, l) => s + (l.qtyReturning ?? 0), 0).toFixed(3)}
              </div>
              <div>
                Total Wastage: {returnLines.reduce((s, l) => s + (l.qtyWasted ?? 0), 0).toFixed(3)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
