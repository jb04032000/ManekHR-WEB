'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Button,
  Modal,
  Table,
  Input,
  InputNumber,
  Select,
  Collapse,
  Form,
  Skeleton,
  message,
  Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  createJwInwardChallan,
  updateJwInwardChallan,
  postJwInwardChallan,
} from '@/lib/actions/finance/job-work.actions';
import { listParties } from '@/lib/actions/finance.actions';
import { listTeam } from '@/lib/actions/team.actions';
import { parseApiError } from '@/lib/utils';
import type { JobWorkInwardChallan, CreateJwInwardPayload, Party, TeamMember } from '@/types';

// Helper: extract string partyId from populated-or-string field
function extractPartyId(partyId?: string | { _id: string; name: string; gstin?: string }): string {
  if (!partyId) return '';
  if (typeof partyId === 'string') return partyId;
  return partyId._id;
}

interface JwiLine {
  key: string;
  itemDescription: string;
  hsnCode?: string;
  qty: number | null;
  unit: string;
  karigarIds?: string[];
  machineIds?: string[];
}

interface Props {
  wsId: string;
  firmId: string;
  initial?: JobWorkInwardChallan;
  onSaved: (challan: JobWorkInwardChallan) => void;
}

const UNIT_OPTIONS = [
  { value: 'MTR', label: 'Meter' },
  { value: 'KGS', label: 'KG' },
  { value: 'NOS', label: 'Nos' },
  { value: 'SET', label: 'Set' },
  { value: 'PCS', label: 'Piece' },
  { value: 'OTH', label: 'Other' },
];

function newLine(): JwiLine {
  return {
    key: `line-${Date.now()}-${Math.random()}`,
    itemDescription: '',
    qty: null,
    unit: 'MTR',
  };
}

function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

export default function JwInwardChallanForm({ wsId, firmId, initial, onSaved }: Props) {
  // ── Party search ──────────────────────────────────────────────
  const [parties, setParties] = useState<Party[]>([]);
  const [partyLoading, setPartyLoading] = useState(false);
  const [partyId, setPartyId] = useState<string>(extractPartyId(initial?.partyId));
  const partyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Team karigars ─────────────────────────────────────────────
  const [karigars, setKarigars] = useState<TeamMember[]>([]);
  const [karigarLoading, setKarigarLoading] = useState(false);
  const karigarLoaded = useRef(false);

  // ── Form state ────────────────────────────────────────────────
  const [lines, setLines] = useState<JwiLine[]>(() => {
    if (initial?.lines?.length) {
      return initial.lines.map((l, i) => ({
        key: `line-${i}`,
        itemDescription: l.itemDescription,
        hsnCode: l.hsnCode,
        qty: l.qty,
        unit: l.unit,
        karigarIds: l.karigarIds?.map(String),
        machineIds: l.machineIds?.map(String),
      }));
    }
    return [newLine()];
  });
  const [headerKarigarIds, setHeaderKarigarIds] = useState<string[]>(
    initial?.karigarIds?.map(String) ?? [],
  );
  const [narration, setNarration] = useState(initial?.narration ?? '');
  // Transport
  const [vehicleNo, setVehicleNo] = useState(initial?.vehicleNo ?? '');
  const [transporterName, setTransporterName] = useState(initial?.transporterName ?? '');
  const [transporterGSTIN, setTransporterGSTIN] = useState(initial?.transporterGSTIN ?? '');
  const [lrNo, setLrNo] = useState(initial?.lrNo ?? '');

  // ── UI state ──────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [validationError, setValidationError] = useState('');

  // ── Load parties on search ─────────────────────────────────────
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

  // ── Load karigars (once) ───────────────────────────────────────
  const loadKarigars = useCallback(async () => {
    if (karigarLoaded.current) return;
    karigarLoaded.current = true;
    setKarigarLoading(true);
    try {
      const res = await listTeam(wsId, { isKarigar: true } as never);
      // TeamMember uses .id (not ._id) in the web interface
      setKarigars((res.members ?? []) as TeamMember[]);
    } catch {
      // silently fail
    } finally {
      setKarigarLoading(false);
    }
  }, [wsId]);

  // ── Line ops ───────────────────────────────────────────────────
  const updateLine = (key: string, patch: Partial<JwiLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));
  const addLine = () => setLines((prev) => [...prev, newLine()]);

  // ── Validation ─────────────────────────────────────────────────
  function validate(): boolean {
    if (!partyId) {
      setValidationError('Select a principal party to continue');
      return false;
    }
    if (lines.length === 0) {
      setValidationError('Add at least one material line before saving');
      return false;
    }
    const incomplete = lines.some((l) => !l.itemDescription.trim() || !l.qty || l.qty <= 0);
    if (incomplete) {
      setValidationError('Add at least one material line before saving');
      return false;
    }
    setValidationError('');
    return true;
  }

  // ── Build payload ──────────────────────────────────────────────
  function buildPayload(): CreateJwInwardPayload {
    return {
      voucherDate: initial?.voucherDate ?? todayISODate(),
      partyId,
      vehicleNo: vehicleNo || undefined,
      transporterName: transporterName || undefined,
      transporterGSTIN: transporterGSTIN || undefined,
      lrNo: lrNo || undefined,
      lines: lines.map((l, idx) => ({
        lineNo: idx + 1,
        itemDescription: l.itemDescription,
        hsnCode: l.hsnCode,
        qty: l.qty!,
        unit: l.unit,
        karigarIds: l.karigarIds,
        machineIds: l.machineIds,
      })),
      karigarIds: headerKarigarIds.length ? headerKarigarIds : undefined,
      narration: narration || undefined,
    };
  }

  // ── Save Draft ─────────────────────────────────────────────────
  async function handleSaveDraft() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      const result = initial
        ? await updateJwInwardChallan(wsId, firmId, initial._id, payload)
        : await createJwInwardChallan(wsId, firmId, payload);
      message.success('Draft saved', 3);
      onSaved(result);
    } catch (err) {
      message.error(parseApiError(err), 6);
    } finally {
      setSaving(false);
    }
  }

  // ── Post Challan ───────────────────────────────────────────────
  function handlePostClick() {
    if (!validate()) return;
    setPostModalOpen(true);
  }

  async function handleConfirmPost() {
    setPosting(true);
    try {
      const payload = buildPayload();
      let challan: JobWorkInwardChallan;
      if (initial && initial.status === 'draft') {
        challan = await updateJwInwardChallan(wsId, firmId, initial._id, payload);
      } else if (!initial) {
        challan = await createJwInwardChallan(wsId, firmId, payload);
      } else {
        challan = initial;
      }
      const posted = await postJwInwardChallan(wsId, firmId, challan._id);
      setPostModalOpen(false);
      message.success('Challan posted and lots created', 4.5);
      onSaved(posted);
    } catch (err) {
      message.error(
        'Failed to post challan. Check all line items have a description and quantity.',
        6,
      );
    } finally {
      setPosting(false);
    }
  }

  // ── Preview lot numbers for modal ─────────────────────────────
  const today = new Date();
  const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const lotPreviewData = lines
    .filter((l) => l.itemDescription.trim() && l.qty && l.qty > 0)
    .map((l, i) => ({
      key: l.key,
      lotNo: `JWL-${yyyymmdd}-${String(i + 1).padStart(3, '0')}`,
      itemDescription: l.itemDescription,
      qty: l.qty,
      unit: l.unit,
    }));

  const lotPreviewColumns = [
    { title: 'Lot No (preview)', dataIndex: 'lotNo', key: 'lotNo' },
    { title: 'Item Description', dataIndex: 'itemDescription', key: 'itemDescription' },
    { title: 'Qty', dataIndex: 'qty', key: 'qty' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
  ];

  // ── Line items table columns ───────────────────────────────────
  const lineColumns: ColumnsType<JwiLine> = [
    {
      title: '#',
      width: 40,
      render: (_v, _r, i) => (
        <span style={{ color: 'var(--cr-text-3)', fontSize: 13 }}>{i + 1}</span>
      ),
    },
    {
      title: 'Item Description',
      dataIndex: 'itemDescription',
      render: (v: string, row: JwiLine) => (
        <Input
          value={v}
          placeholder="Enter item description"
          style={{ fontSize: 14 }}
          onChange={(e) => updateLine(row.key, { itemDescription: e.target.value })}
        />
      ),
    },
    {
      title: 'HSN Code',
      dataIndex: 'hsnCode',
      width: 120,
      render: (v: string, row: JwiLine) => (
        <Input
          value={v}
          placeholder="HSN"
          style={{ fontSize: 14 }}
          onChange={(e) => updateLine(row.key, { hsnCode: e.target.value })}
        />
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      width: 100,
      render: (v: number | null, row: JwiLine) => (
        <InputNumber
          value={v}
          min={0.001}
          step={1}
          style={{ width: '100%', fontSize: 14 }}
          onChange={(val) => updateLine(row.key, { qty: val })}
        />
      ),
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      width: 110,
      render: (v: string, row: JwiLine) => (
        <Select
          value={v}
          options={UNIT_OPTIONS}
          style={{ width: '100%', fontSize: 14 }}
          onChange={(val) => updateLine(row.key, { unit: val })}
        />
      ),
    },
    {
      title: (
        <Tooltip title="Line-level karigar override (optional)">
          <span>Karigar (opt.)</span>
        </Tooltip>
      ),
      dataIndex: 'karigarIds',
      render: (v: string[] | undefined, row: JwiLine) => (
        <Select
          mode="multiple"
          value={v ?? []}
          placeholder="Karigar"
          style={{ minWidth: 120, width: '100%' }}
          options={karigars.map((k) => ({ value: k.id, label: k.name }))}
          onFocus={loadKarigars}
          loading={karigarLoading}
          onChange={(val) => updateLine(row.key, { karigarIds: val })}
        />
      ),
    },
    {
      title: <span className="sr-only">Delete</span>,
      width: 44,
      render: (_v: unknown, row: JwiLine) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          aria-label="Remove line"
          onClick={() => removeLine(row.key)}
        />
      ),
    },
  ];

  const isPosted = initial?.status === 'posted' || initial?.status === 'closed';

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
          <Form.Item
            label={
              <span style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>Select Principal</span>
            }
            validateStatus={validationError.includes('party') ? 'error' : ''}
            help={validationError.includes('party') ? validationError : undefined}
          >
            {partyLoading && !parties.length ? (
              <Skeleton.Input active style={{ height: 38, width: '100%' }} />
            ) : (
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder="Search principal party..."
                value={partyId || undefined}
                filterOption={false}
                onSearch={handlePartySearch}
                onChange={setPartyId}
                onFocus={() => handlePartySearch('')}
                loading={partyLoading}
                options={parties.map((p) => ({
                  value: p._id,
                  label: (
                    <div>
                      <div style={{ fontSize: 14, color: 'var(--cr-text)' }}>{p.name}</div>
                      {p.gstin && (
                        <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>{p.gstin}</div>
                      )}
                    </div>
                  ),
                }))}
              />
            )}
          </Form.Item>
        </div>

        {/* Transport section */}
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
                      placeholder="Transporter name"
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

        {/* Line items */}
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
            Material Lines
          </h3>
          {validationError.includes('line') && (
            <p style={{ color: 'var(--cr-error)', fontSize: 13, marginBottom: 8 }}>
              {validationError}
            </p>
          )}
          <Table<JwiLine>
            dataSource={lines}
            columns={lineColumns}
            pagination={false}
            rowKey="key"
            size="small"
            scroll={{ x: 700 }}
          />
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            size="small"
            style={{ marginTop: 8 }}
            onClick={addLine}
          >
            Add another item
          </Button>
        </div>

        {/* Karigar attribution */}
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
            Karigar Attribution (optional)
          </h3>
          <Form.Item label={<span style={{ fontSize: 13 }}>Assign karigars (optional)</span>}>
            <Select
              mode="multiple"
              placeholder="Assign karigars (optional)"
              value={headerKarigarIds}
              options={karigars.map((k) => ({
                value: k.id,
                label: (
                  <span>
                    {k.name}
                    {k.karigarSkillType && (
                      <span style={{ fontSize: 11, color: 'var(--cr-text-3)', marginLeft: 6 }}>
                        {k.karigarSkillType}
                      </span>
                    )}
                  </span>
                ),
              }))}
              onFocus={loadKarigars}
              loading={karigarLoading}
              onChange={setHeaderKarigarIds}
            />
          </Form.Item>
          <Form.Item label={<span style={{ fontSize: 13 }}>Assign machines (optional)</span>}>
            <Select mode="multiple" placeholder="Assign machines (optional)" disabled value={[]} />
          </Form.Item>
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

      {/* ── Right column: actions ───────────────────────────────────── */}
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
          {validationError &&
            !validationError.includes('party') &&
            !validationError.includes('line') && (
              <p style={{ color: 'var(--cr-error)', fontSize: 13, marginBottom: 8 }}>
                {validationError}
              </p>
            )}
          {!isPosted && (
            <>
              <Button
                block
                style={{ marginBottom: 8 }}
                loading={saving}
                onClick={handleSaveDraft}
                icon={saving ? <LoadingOutlined /> : null}
              >
                Save Draft
              </Button>
              <Button block type="primary" onClick={handlePostClick} disabled={saving}>
                Post Challan
              </Button>
            </>
          )}
          {isPosted && (
            <p style={{ color: 'var(--cr-text-3)', fontSize: 13 }}>
              This challan is {initial?.status} and cannot be edited.
            </p>
          )}
        </div>
      </div>

      {/* ── Post confirmation modal ─────────────────────────────────── */}
      <Modal
        open={postModalOpen}
        title={`Post Challan - ${initial?.voucherNumber ?? 'New'}`}
        onCancel={() => !posting && setPostModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setPostModalOpen(false)} disabled={posting}>
            Cancel
          </Button>,
          <Button key="post" type="primary" loading={posting} onClick={handleConfirmPost}>
            Post &amp; Create Lots
          </Button>,
        ]}
      >
        <p style={{ fontSize: 14, marginBottom: 12 }}>
          Once posted, this challan cannot be edited. The following lots will be created:
        </p>
        <Table
          dataSource={lotPreviewData}
          columns={lotPreviewColumns}
          pagination={false}
          size="small"
          rowKey="key"
        />
        <p style={{ fontSize: 13, color: 'var(--cr-text-3)', marginTop: 12 }}>
          Lot numbers shown are previews. The server assigns final sequential numbers.
        </p>
      </Modal>
    </div>
  );
}
