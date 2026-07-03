'use client';
/**
 * RecurringTemplateEditor - full-page editor for recurring invoice templates (D-08).
 * Reuses VoucherEditorHeader (with postLabel override), LineItemsTable, TotalsFooter,
 * and adds RecurringScheduleSection below the totals.
 *
 * Differences from VoucherEditor:
 *  - Header shows "Recurring Template" title with "Save Template" primary button
 *  - No e-Invoice / e-Way Bill / UPI tabs (N/A for templates)
 *  - RecurringScheduleSection card below TotalsFooter
 *  - Detail-page action bar: Generate Now / Pause / Resume / Delete
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { App, Input, Form, Row, Col, Select, notification } from 'antd';
import { VoucherEditorHeader } from './VoucherEditorHeader';
import { LineItemsTable } from './LineItemsTable';
import { TotalsFooter } from './TotalsFooter';
import {
  RecurringScheduleSection,
  type RecurringSchedule,
  type NotifyChannels,
} from './RecurringScheduleSection';
import { computeTaxClient } from '@/lib/finance/taxComputeClient';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useWorkspaceStore } from '@/lib/store';
import DsButton from '@/components/ui/DsButton';
import type { RecurringInvoiceTemplate } from '@/types';

interface RecurringFormValues {
  templateName: string;
  partyId: string;
  lineItems: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  additionalCharges: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  notes: string;
  schedule: RecurringSchedule;
  autoPostOnGenerate: boolean;
  notifyOnGenerate: NotifyChannels;
}

interface Props {
  firmId: string;
  mode: 'new' | 'edit';
  existingTemplate?: RecurringInvoiceTemplate;
}

const DEFAULT_SCHEDULE: RecurringSchedule = {
  mode: 'monthly',
  dayOfMonth: new Date().getDate(),
  startDate: new Date().toISOString(),
};

export function RecurringTemplateEditor({ firmId, mode, existingTemplate }: Props) {
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const form = useForm<RecurringFormValues>({
    defaultValues: existingTemplate
      ? {
          templateName: existingTemplate.templateName ?? '',
          partyId: existingTemplate.partyId ?? '',
          lineItems: existingTemplate.lineItems ?? [],
          additionalCharges: existingTemplate.additionalCharges ?? [],
          notes: existingTemplate.notes ?? '',
          schedule: (existingTemplate.schedule as unknown as RecurringSchedule) ?? DEFAULT_SCHEDULE,
          autoPostOnGenerate: existingTemplate.autoPostOnGenerate ?? false,
          notifyOnGenerate: (existingTemplate.notifyOnGenerate as unknown as NotifyChannels) ?? {
            email: true,
            whatsapp: false,
            sms: false,
          },
        }
      : {
          templateName: '',
          partyId: '',
          lineItems: [],
          additionalCharges: [],
          notes: '',
          schedule: DEFAULT_SCHEDULE,
          autoPostOnGenerate: false,
          notifyOnGenerate: { email: true, whatsapp: false, sms: false },
        },
  });

  const watched = form.watch();

  // Live tax preview using client-side mirror of D-18 rules
  const taxResult = computeTaxClient({
    lines: watched.lineItems ?? [],
    additionalCharges: watched.additionalCharges ?? [],
    firmStateCode: '24', // TODO: derive from firm.gstin when firm context wired
    partyStateCode: '24', // TODO: derive from party.gstin when party selection wired
    placeOfSupplyStateCode: '24',
    roundingPolicy: 'half_up',
  });

  const handleSave = async () => {
    if (!ws?._id) return;
    setBusy(true);
    try {
      const values = form.getValues();
      if (mode === 'edit' && existingTemplate?._id) {
        await financeSalesApi.recurring.update(ws._id, firmId, existingTemplate._id, values as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        notification.success({ message: 'Template saved' });
      } else {
        const created = await financeSalesApi.recurring.create(ws._id, firmId, values as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        notification.success({ message: 'Template created' });
        router.replace(
          `/dashboard/finance/firms/${firmId}/sales/recurring/${(created as any)._id}`, // eslint-disable-line @typescript-eslint/no-explicit-any
        );
      }
    } catch (e: any) {
      notification.error({ message: 'Save failed', description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (action: 'trigger' | 'pause' | 'resume' | 'delete') => {
    if (!ws?._id || !existingTemplate?._id) return;
    setActionBusy(action);
    try {
      if (action === 'delete') {
        await financeSalesApi.recurring.delete(ws._id, firmId, existingTemplate._id);
        notification.success({ message: 'Template deleted' });
        router.push(`/dashboard/finance/firms/${firmId}/sales/recurring`);
      } else {
        await financeSalesApi.recurring[action](ws._id, firmId, existingTemplate._id);
        const msgs = {
          trigger: 'Invoice generated',
          pause: 'Template paused',
          resume: 'Template resumed',
        };
        notification.success({ message: msgs[action] });
      }
    } catch (e: any) {
      notification.error({ message: 'Action failed', description: e?.message });
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <App>
      {/* Header - reuses VoucherEditorHeader with postLabel override */}
      <VoucherEditorHeader
        voucherType="sale_invoice"
        autosaveStatus="idle"
        lastSavedAt={null}
        onSaveDraft={handleSave}
        onPost={handleSave}
        isPostable={true}
        isPostLoading={busy}
        postLabel="Save Template"
      />

      {/* Detail-page action bar (edit mode only) */}
      {mode === 'edit' && existingTemplate && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '8px 16px',
            borderBottom: '1px solid var(--cr-border)',
            background: 'var(--cr-surface-2)',
          }}
        >
          <DsButton
            dsVariant="primary"
            dsSize="sm"
            loading={actionBusy === 'trigger'}
            onClick={() => handleAction('trigger')}
          >
            Generate Now
          </DsButton>
          {existingTemplate.isActive ? (
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              loading={actionBusy === 'pause'}
              onClick={() => handleAction('pause')}
            >
              Pause
            </DsButton>
          ) : (
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              loading={actionBusy === 'resume'}
              onClick={() => handleAction('resume')}
            >
              Resume
            </DsButton>
          )}
          <DsButton
            dsVariant="danger"
            dsSize="sm"
            loading={actionBusy === 'delete'}
            onClick={() => handleAction('delete')}
          >
            Delete
          </DsButton>
        </div>
      )}

      {/* Template name + party info section */}
      <div style={{ padding: '16px 16px 0' }}>
        <Row gutter={[24, 0]}>
          <Col xs={24} md={12}>
            <Form.Item label="Template Name" style={{ marginBottom: 12 }}>
              <Input
                value={watched.templateName}
                onChange={(e) => form.setValue('templateName', e.target.value)}
                placeholder="e.g. Monthly retainer - Acme Corp"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Party" style={{ marginBottom: 12 }}>
              <Input
                value={watched.partyId}
                onChange={(e) => form.setValue('partyId', e.target.value)}
                placeholder="Search party by name or GSTIN…"
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Notes" style={{ marginBottom: 12 }}>
          <Input.TextArea
            value={watched.notes}
            onChange={(e) => form.setValue('notes', e.target.value)}
            rows={2}
            placeholder="Notes for the generated invoice"
          />
        </Form.Item>
      </div>

      {/* Line items table */}
      <div style={{ padding: '0 16px' }}>
        <LineItemsTable
          control={form.control as import('react-hook-form').Control<any>} // eslint-disable-line @typescript-eslint/no-explicit-any
          firmId={firmId}
          wsId={ws?._id ?? ''}
        />
      </div>

      {/* Totals footer */}
      <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <TotalsFooter result={taxResult} />
      </div>

      {/* Recurring schedule section */}
      <div style={{ padding: '0 16px 32px' }}>
        <RecurringScheduleSection
          schedule={watched.schedule}
          onChange={(s) => form.setValue('schedule', s)}
          autoPostOnGenerate={watched.autoPostOnGenerate}
          onAutoPostChange={(v) => form.setValue('autoPostOnGenerate', v)}
          notifyOnGenerate={watched.notifyOnGenerate}
          onNotifyChange={(n) => form.setValue('notifyOnGenerate', n)}
        />
      </div>
    </App>
  );
}
