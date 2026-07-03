'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, InputNumber, Popconfirm, Select, Space, Table, Tag, Tooltip } from 'antd';
import { CloseCircleOutlined, WarningFilled } from '@ant-design/icons';
import type { AdminConnectEntitlementsView, ConnectAllowances } from './entitlements.types';

/**
 * Side-by-side Plan defaults | Override | Effective per Connect entitlement,
 * with usage shown inline (and over-limit rows highlighted) plus set/clear edit
 * affordances. Pure/presentational - the page owns data fetching + the network
 * calls. Linked to: entitlements.actions.ts (onSave -> PUT, onClear -> DELETE),
 * admin-connect-entitlements.service.ts (the shape it renders).
 *
 * Admin is English-only + AntD (matches app/admin/*); no i18n here by design.
 */

type FieldKind = 'number' | 'boolean' | 'policy';
type UsageKind = 'listing' | 'storefront' | 'company_page' | 'job' | 'storage';

interface FieldDef {
  key: keyof ConnectAllowances;
  label: string;
  kind: FieldKind;
  /** Links the row to its usage row for the inline "used N" + over-limit flag. */
  usageKind?: UsageKind;
  min?: number;
  max?: number;
  hint?: string;
}

// Every editable Connect entitlement, in display order. maxCompanyPages /
// maxStorefronts / maxJobs have NO plan-schema field - they resolve from the
// system default and can ONLY be tuned per person via an override here.
const FIELDS: FieldDef[] = [
  { key: 'maxListings', label: 'Listings', kind: 'number', usageKind: 'listing', min: -1 },
  { key: 'maxStorefronts', label: 'Storefronts', kind: 'number', usageKind: 'storefront', min: -1 },
  {
    key: 'maxCompanyPages',
    label: 'Company pages',
    kind: 'number',
    usageKind: 'company_page',
    min: -1,
  },
  { key: 'maxJobs', label: 'Open jobs', kind: 'number', usageKind: 'job', min: -1 },
  { key: 'leadsPerMonth', label: 'Leads / month', kind: 'number', min: -1 },
  { key: 'storageMb', label: 'Storage (MB)', kind: 'number', usageKind: 'storage', min: -1 },
  { key: 'includedBoostCredits', label: 'Boost credits', kind: 'number', min: -1 },
  { key: 'searchPriority', label: 'Search priority', kind: 'number', min: -1 },
  { key: 'verifiedBadge', label: 'Verified badge', kind: 'boolean' },
  { key: 'overLimitPolicy', label: 'Over-limit policy', kind: 'policy' },
  {
    key: 'overLimitGraceDays',
    label: 'Grace days',
    kind: 'number',
    min: 0,
    max: 3650,
    hint: 'Only applies under the "hide newest" policy.',
  },
];

const POLICY_OPTIONS = [
  { value: 'freeze', label: 'Freeze (block new, keep existing)' },
  { value: 'hide_newest', label: 'Hide newest (suppress after grace)' },
];

/** -1 reads as "Unlimited" for numeric allowances. */
function displayValue(field: FieldDef, value: unknown): string {
  if (value === undefined || value === null) return '-';
  if (field.kind === 'boolean') return value ? 'Yes' : 'No';
  if (field.kind === 'policy') return value === 'hide_newest' ? 'Hide newest' : 'Freeze';
  if (typeof value === 'number') return value === -1 ? 'Unlimited' : String(value);
  return String(value);
}

export interface ConnectEntitlementsPanelProps {
  view: AdminConnectEntitlementsView;
  saving?: boolean;
  /** Called with the full set of fields currently overridden (undefined = inherit). */
  onSave: (override: Partial<ConnectAllowances>) => void;
  onClear: () => void;
  /**
   * Compact stacked layout (one block per limit) instead of the wide 5-column
   * table. Use in narrow containers like the Manage Plans drawer, where the
   * table cramps + clips the Usage column. Standalone full-width page omits it.
   */
  dense?: boolean;
}

export function ConnectEntitlementsPanel({
  view,
  saving = false,
  onSave,
  onClear,
  dense = false,
}: ConnectEntitlementsPanelProps) {
  // Local draft of the override, re-seeded whenever a fresh view arrives (after
  // save/clear the parent passes the server's new view back in). Reset happens
  // during render by tracking the view identity - the React-recommended way to
  // adjust state on a prop change, no effect needed.
  const [draft, setDraft] = useState<Partial<ConnectAllowances>>(view.override ?? {});
  const [seenView, setSeenView] = useState(view);
  if (seenView !== view) {
    setSeenView(view);
    setDraft(view.override ?? {});
  }

  const usageByKind = useMemo(() => {
    const map = new Map<UsageKind, AdminConnectEntitlementsView['usage'][number]>();
    for (const row of view.usage) map.set(row.kind as UsageKind, row);
    return map;
  }, [view.usage]);

  const writable = view.hasConnectSubscription;
  const dirtyCount = Object.values(draft).filter((v) => v !== undefined && v !== null).length;

  const setField = (key: keyof ConnectAllowances, value: unknown) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (value === undefined || value === null) delete next[key];
      else (next as Record<string, unknown>)[key] = value;
      return next;
    });
  };

  const handleSave = () => {
    // Only send the fields that are actually set (partial override).
    const clean: Record<string, unknown> = {};
    for (const f of FIELDS) {
      const v = draft[f.key];
      if (v !== undefined && v !== null) clean[f.key] = v;
    }
    onSave(clean as Partial<ConnectAllowances>);
  };

  const renderEditor = (field: FieldDef) => {
    const current = draft[field.key];
    const overridden = current !== undefined && current !== null;
    const clearBtn = overridden ? (
      <Tooltip title="Clear this field (inherit from plan)">
        <Button
          type="text"
          size="small"
          aria-label={`Clear ${field.label}`}
          icon={<CloseCircleOutlined />}
          onClick={() => setField(field.key, undefined)}
        />
      </Tooltip>
    ) : null;

    if (field.kind === 'boolean') {
      return (
        <Space size={4}>
          <Select
            size="small"
            style={{ width: 110 }}
            placeholder="Inherit"
            disabled={!writable}
            value={overridden ? (current ? 'yes' : 'no') : undefined}
            aria-label={`${field.label} override`}
            onChange={(v) => setField(field.key, v === undefined ? undefined : v === 'yes')}
            allowClear
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
          />
          {clearBtn}
        </Space>
      );
    }
    if (field.kind === 'policy') {
      return (
        <Space size={4}>
          <Select
            size="small"
            style={{ width: 230 }}
            placeholder="Inherit"
            disabled={!writable}
            value={overridden ? (current as string) : undefined}
            aria-label={`${field.label} override`}
            onChange={(v) => setField(field.key, v)}
            allowClear
            options={POLICY_OPTIONS}
          />
          {clearBtn}
        </Space>
      );
    }
    return (
      <Space size={4}>
        <InputNumber
          size="small"
          style={{ width: 120 }}
          placeholder="Inherit"
          disabled={!writable}
          min={field.min}
          max={field.max}
          step={1}
          value={overridden ? (current as number) : undefined}
          aria-label={`${field.label} override`}
          onChange={(v) => setField(field.key, v ?? undefined)}
        />
        {clearBtn}
      </Space>
    );
  };

  const renderUsage = (field: FieldDef) => {
    if (!field.usageKind) return <span style={{ color: 'var(--cr-text-4)' }}>-</span>;
    const row = usageByKind.get(field.usageKind);
    if (!row) return <span style={{ color: 'var(--cr-text-4)' }}>-</span>;
    const limitLabel = row.limit === -1 ? '∞' : String(row.limit);
    return (
      // wrap={false} + nowrap keeps "used N / M" on ONE line — in the narrow
      // Manage Plans drawer column it otherwise broke onto three lines.
      <Space size={6} wrap={false}>
        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          used {row.used} / {limitLabel}
        </span>
        {row.overLimit && (
          <Tag color="error" icon={<WarningFilled />}>
            over limit
          </Tag>
        )}
        {row.suppressionActive && <Tag color="warning">hidden {row.suppressedCount}</Tag>}
      </Space>
    );
  };

  const columns = [
    {
      title: 'Limit',
      dataIndex: 'label',
      key: 'label',
      render: (_: unknown, field: FieldDef) => (
        <span>
          <span style={{ fontWeight: 600 }}>{field.label}</span>
          {field.hint && (
            <span style={{ display: 'block', fontSize: 11, color: 'var(--cr-text-4)' }}>
              {field.hint}
            </span>
          )}
        </span>
      ),
    },
    {
      title: 'Plan default',
      key: 'planDefault',
      render: (_: unknown, field: FieldDef) => (
        <span style={{ color: 'var(--cr-text-3)' }}>
          {displayValue(field, view.planDefaults[field.key])}
        </span>
      ),
    },
    {
      title: 'Override',
      key: 'override',
      render: (_: unknown, field: FieldDef) => renderEditor(field),
    },
    {
      title: 'Effective',
      key: 'effective',
      render: (_: unknown, field: FieldDef) => {
        const isOverridden = view.override?.[field.key] !== undefined;
        return (
          <span style={{ fontWeight: 600 }}>
            {displayValue(field, view.effective[field.key])}
            {isOverridden && (
              <Tag color="blue" style={{ marginLeft: 6 }}>
                custom
              </Tag>
            )}
          </span>
        );
      },
    },
    {
      title: 'Usage',
      key: 'usage',
      render: (_: unknown, field: FieldDef) => renderUsage(field),
    },
  ];

  // Compact per-limit blocks for narrow containers (the Manage Plans drawer).
  // Reuses renderEditor + renderUsage; over-limit blocks get the same error tint
  // as the table rows. Each limit is self-contained so nothing wraps or clips.
  const renderDense = () => (
    <div>
      {FIELDS.map((field) => {
        const usageRow = field.usageKind ? usageByKind.get(field.usageKind) : undefined;
        const isOverridden = view.override?.[field.key] !== undefined;
        return (
          <div
            key={field.key}
            style={{
              padding: '10px 12px',
              marginBottom: 8,
              borderRadius: 'var(--cr-radius-md)',
              border: '1px solid var(--cr-border)',
              background: usageRow?.overLimit ? 'var(--cr-error-light, #fff1f0)' : 'transparent',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontWeight: 600 }}>{field.label}</span>
              {field.usageKind ? renderUsage(field) : null}
            </div>
            <div style={{ fontSize: 12, color: 'var(--cr-text-3)', marginTop: 2 }}>
              Plan default {displayValue(field, view.planDefaults[field.key])}
              {'  ·  '}
              Effective{' '}
              <span style={{ fontWeight: 600, color: 'var(--cr-text-1)' }}>
                {displayValue(field, view.effective[field.key])}
              </span>
              {isOverridden && (
                <Tag color="blue" style={{ marginLeft: 6 }}>
                  custom
                </Tag>
              )}
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--cr-text-4)' }}>Override</span>
              {renderEditor(field)}
            </div>
            {field.hint && (
              <div style={{ fontSize: 11, color: 'var(--cr-text-4)', marginTop: 4 }}>
                {field.hint}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      {!writable && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 'var(--cr-radius-md)',
            background: 'var(--cr-warning-light)',
            color: 'var(--cr-warning)',
            fontSize: 13,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            This person has no active Connect subscription, so there is nothing to override yet.
            Assign a Connect plan first; the values below are the free-tier defaults they currently
            get.
          </div>
          {/* One-click bridge to the existing assign-plan flow (the admin Users
              console owns plan assignment). No new logic: just a deep link so
              the admin does not have to hunt for where to assign a plan. */}
          <Link href="/admin/users" prefetch={false}>
            <Button size="small" type="primary">
              Assign a Connect plan
            </Button>
          </Link>
        </div>
      )}

      {dense ? (
        renderDense()
      ) : (
        <Table<FieldDef>
          rowKey="key"
          size="small"
          pagination={false}
          dataSource={FIELDS}
          columns={columns}
          // Size columns to content + scroll horizontally if space is ever tight,
          // rather than squeezing every column.
          scroll={{ x: 'max-content' }}
          onRow={(field) => {
            const row = field.usageKind ? usageByKind.get(field.usageKind) : undefined;
            return row?.overLimit
              ? { style: { background: 'var(--cr-error-light, #fff1f0)' } }
              : {};
          }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <Popconfirm
          title="Clear all overrides?"
          description="This person reverts to their plan's limits for every field."
          okText="Clear all"
          okButtonProps={{ danger: true }}
          onConfirm={onClear}
          disabled={!writable || !view.override}
        >
          <Button danger disabled={!writable || !view.override}>
            Clear all overrides
          </Button>
        </Popconfirm>
        <Button type="primary" loading={saving} disabled={!writable} onClick={handleSave}>
          {dirtyCount > 0 ? `Save ${dirtyCount} override${dirtyCount > 1 ? 's' : ''}` : 'Save'}
        </Button>
      </div>
    </div>
  );
}
