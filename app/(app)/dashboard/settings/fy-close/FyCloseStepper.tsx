'use client';

/**
 * Phase 16 / FIN-15-02 - FY Close Stepper (client component).
 *
 * 4-step Steps progressDot stepper per UI-SPEC §FY Close (verbatim copy):
 *   Step 1 - Before you close (adjustments + cutoff)
 *   Step 2 - System health checks
 *   Step 3 - Preview closing entries
 *   Step 4 - Confirm close (firm-name typing)
 *
 * Plus a separate Reopen modal (REOPEN-typing + reason ≥10 chars).
 *
 * Sub-feature gate: useFeatureAccess('finance', 'finance_advanced')
 *
 * Threat-model (Plan 16-06b):
 *   T-16-06b-01 - Tampering - client requires verbatim firm name; server
 *     re-validates firmNameConfirmation in CloseFyDto.
 *   T-16-06b-02 - Privilege Escalation - client hides Reopen CTA based on
 *     subscription gate; backend RolesGuard / @RequirePermissions('fy_reopen')
 *     remain authoritative.
 *   T-16-06b-03 - Privilege Escalation - useFeatureAccess gates the page;
 *     SubscriptionGuard on the controller is authoritative.
 *
 * NB on naming: CONTEXT.md / UI-SPEC reference `firm.legalName`. The web
 * `Firm` type carries `firmName` (not legalName); backend matches on
 * `firm.legalName ?? firm.firmName`. We pass the firm's `firmName` to the
 * server which is the de-facto legal name on this stack.
 */
import { useEffect, useMemo, useState, startTransition } from 'react';
import {
  Alert,
  Checkbox,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Steps,
  Tooltip,
  message,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { DsButton, DsCard } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { listFirms } from '@/lib/actions/finance.actions';
import { fiscalYearApi } from '@/lib/api/modules/fiscal-year.api';
import type { Firm, FiscalYearRow, FyHealthChecksReport } from '@/types';
import HealthChecksPanel from './HealthChecksPanel';
import JournalsPreview from './JournalsPreview';
import AuditTrail from './AuditTrail';

const CHECKLIST_ITEMS = [
  'Depreciation posted',
  'Provisions raised',
  'Stock revaluation done',
  'Bank reconciliations complete',
] as const;

function fyLabel(fy: FiscalYearRow | null): {
  startYear: number | string;
  endYear: number | string;
  full: string;
} {
  if (!fy) return { startYear: '-', endYear: '-', full: '-' };
  const s = new Date(fy.startDate);
  const e = new Date(fy.endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return { startYear: '-', endYear: '-', full: '-' };
  const startYear = s.getUTCFullYear();
  const endYear = e.getUTCFullYear();
  return {
    startYear,
    endYear,
    full: `${startYear}–${endYear}`,
  };
}

function StatusPill({ status }: { status: FiscalYearRow['status'] }) {
  const map: Record<FiscalYearRow['status'], { bg: string; color: string; label: string }> = {
    OPEN: {
      bg: 'var(--cr-success-bg)',
      color: 'var(--cr-success)',
      label: 'OPEN',
    },
    CLOSED: {
      bg: 'var(--cr-surface-2)',
      color: 'var(--cr-text-3)',
      label: 'CLOSED',
    },
    REOPENED: {
      bg: 'var(--cr-warning-bg)',
      color: 'var(--cr-warning)',
      label: 'REOPENED',
    },
  };
  const s = map[status] ?? map.OPEN;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        background: s.bg,
        color: s.color,
        borderRadius: 'var(--cr-radius-md)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
      }}
    >
      {s.label}
    </span>
  );
}

export default function FyCloseStepper() {
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const {
    hasAccess,
    isLocked,
    isLoading: featureLoading,
  } = useFeatureAccess('finance', 'finance_advanced');

  const [firms, setFirms] = useState<Firm[]>([]);
  const [firmId, setFirmId] = useState<string>('');
  const [fy, setFy] = useState<FiscalYearRow | null>(null);
  const [fyLoading, setFyLoading] = useState(false);

  // Stepper state
  const [step, setStep] = useState(0);
  const [checks, setChecks] = useState<boolean[]>([false, false, false, false]);
  const [cutoff, setCutoff] = useState<Dayjs | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{
    voucherCount: number;
    nextFyStartDate: string;
  } | null>(null);

  // Health checks state
  const [healthLoading, setHealthLoading] = useState(false);
  const [health, setHealth] = useState<FyHealthChecksReport | null>(null);
  const [skipHealthChecks, setSkipHealthChecks] = useState(false);

  // Reopen modal
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenConfirmation, setReopenConfirmation] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);

  const currentFirm = useMemo(
    () => firms.find((f) => f._id === firmId) ?? firms[0],
    [firms, firmId],
  );
  const expectedFirmName = currentFirm?.firmName ?? '';
  const labels = fyLabel(fy);

  // Load firms.
  useEffect(() => {
    if (!wsId) return;
    listFirms(wsId)
      .then((rows) => {
        setFirms(rows ?? []);
        if (rows && rows.length > 0 && !firmId) {
          setFirmId(rows[0]._id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  // Load current FY when firm changes.
  useEffect(() => {
    if (!wsId || !firmId) {
      startTransition(() => {
        setFy(null);
      });
      return;
    }
    startTransition(() => {
      setFyLoading(true);
    });
    fiscalYearApi
      .current(wsId, firmId)
      .then((row) => {
        setFy(row);
        // Default cutoff = fy.endDate
        if (row?.endDate) setCutoff(dayjs(row.endDate));
      })
      .catch(() => setFy(null))
      .finally(() => setFyLoading(false));
  }, [wsId, firmId]);

  // Run health checks when entering Step 2.
  useEffect(() => {
    if (step !== 1 || !fy || !wsId || !firmId) return;
    startTransition(() => {
      setHealthLoading(true);
      setHealth(null);
    });
    fiscalYearApi
      .health(wsId, firmId, fy._id)
      .then((r) => setHealth(r))
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false));
  }, [step, fy, wsId, firmId]);

  // Step gating
  const allChecks = checks.every(Boolean);
  const step1Ready = allChecks && !!cutoff;
  const step2Ready = !!health && health.allPassed;
  const step4Ready = confirmName === expectedFirmName && expectedFirmName !== '';

  const isClosed = fy?.status === 'CLOSED';
  const showReopen = isClosed;

  function refreshFy() {
    if (!wsId || !firmId) return;
    fiscalYearApi
      .current(wsId, firmId)
      .then((row) => setFy(row))
      .catch(() => {});
  }

  async function handleClose() {
    if (!fy || !wsId || !firmId || !cutoff) return;
    if (!step4Ready) return;
    setSubmitting(true);
    try {
      const updated = await fiscalYearApi.close(wsId, firmId, fy._id, {
        effectiveCloseDate: cutoff.format('YYYY-MM-DD'),
        firmNameConfirmation: confirmName,
        skipHealthChecks: skipHealthChecks || undefined,
      });
      const nextStart = (() => {
        const e = new Date(updated.endDate);
        return new Date(e.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        });
      })();
      setSuccess({
        voucherCount: 1, // backend posts one closing journal voucher
        nextFyStartDate: nextStart,
      });
      setFy(updated);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || 'Close failed. Please try again or contact support.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkipConfirm() {
    Modal.confirm({
      title: 'Continue at your own risk',
      content:
        'These items will carry into the new FY as opening balances. Continue at your own risk.',
      okText: 'Confirm',
      okButtonProps: {
        danger: true,
      },
      onOk: () => {
        setSkipHealthChecks(true);
        setStep(2);
      },
    });
  }

  async function handleReopen() {
    if (!fy || !wsId || !firmId) return;
    if (reopenReason.length < 10 || reopenConfirmation !== 'REOPEN') return;
    setReopenSubmitting(true);
    try {
      const updated = await fiscalYearApi.reopen(wsId, firmId, fy._id, {
        reason: reopenReason,
        confirmation: 'REOPEN',
      });
      setFy(updated);
      setReopenOpen(false);
      setReopenReason('');
      setReopenConfirmation('');
      message.success('Fiscal year reopened.');
      refreshFy();
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || 'Reopen failed. Please try again or contact support.',
      );
    } finally {
      setReopenSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  if (featureLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin />
      </div>
    );
  }

  return (
    <>
      {/* Sub-feature gate banner */}
      {!hasAccess && (
        <Alert
          type="warning"
          showIcon
          title="Upgrade required"
          description="FY Close is available on plans that include the Finance Advanced sub-feature. Form is read-only until upgraded."
          style={{
            marginBottom: 16,
            background: 'var(--cr-warning-bg)',
            borderColor: 'var(--cr-warning)',
          }}
        />
      )}

      {/* Firm + current-FY card */}
      <DsCard
        title="Current FY"
        styles={{
          header: { fontFamily: 'var(--font-display)', fontWeight: 700 },
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16 /* md */,
          }}
        >
          <Form layout="vertical" disabled={isLocked}>
            <Form.Item label="Business" style={{ marginBottom: 0 }}>
              <Select
                value={firmId || undefined}
                onChange={(v) => {
                  setFirmId(v);
                  setStep(0);
                  setChecks([false, false, false, false]);
                  setConfirmName('');
                  setSuccess(null);
                  setSkipHealthChecks(false);
                }}
                placeholder="Select business"
                aria-label="Business"
                style={{ width: '100%', maxWidth: 360 }}
                options={firms.map((f) => ({
                  value: f._id,
                  label: f.firmName,
                }))}
              />
            </Form.Item>
          </Form>

          {fyLoading ? (
            <Spin />
          ) : !fy ? (
            <p style={{ margin: 0, color: 'var(--cr-text-3)', fontSize: 14 }}>
              No fiscal year found for this firm.
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 16 /* md */,
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: 'var(--cr-text-3)',
                  }}
                >
                  Period
                </p>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontWeight: 600,
                    fontSize: 16,
                    color: 'var(--cr-text)',
                  }}
                >
                  {labels.full}
                </p>
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: 'var(--cr-text-3)',
                  }}
                >
                  Status
                </p>
                <div style={{ marginTop: 4 }}>
                  {isClosed ? (
                    <Tooltip
                      title={`Closed on ${
                        fy.closedAt ? new Date(fy.closedAt).toLocaleDateString('en-IN') : '-'
                      } by ${fy.closedBy ?? 'unknown'}. Reopen if you need to make corrections.`}
                    >
                      <span>
                        <StatusPill status={fy.status} />
                      </span>
                    </Tooltip>
                  ) : (
                    <StatusPill status={fy.status} />
                  )}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {showReopen && (
                  <Tooltip title={!hasAccess ? 'Subscription required' : ''}>
                    <span>
                      <DsButton
                        dsVariant="ghost"
                        disabled={!hasAccess}
                        onClick={() => setReopenOpen(true)}
                        style={{ color: 'var(--cr-error)' }}
                      >
                        Reopen this FY
                      </DsButton>
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
        </div>
      </DsCard>

      {/* Reopened banner */}
      {fy?.status === 'REOPENED' && (
        <Alert
          type="warning"
          showIcon
          style={{
            marginTop: 24 /* lg */,
            background: 'var(--cr-warning-bg)',
            borderColor: 'var(--cr-warning)',
          }}
          title="This FY is reopened"
          description="Re-run the close once corrections are posted."
        />
      )}

      {/* Stepper - only show if FY exists and is not yet success-closed in this session */}
      {fy && !success && fy.status !== 'CLOSED' && (
        <DsCard
          style={{ marginTop: 32 /* xl */ }}
          styles={{
            header: { fontFamily: 'var(--font-display)', fontWeight: 700 },
          }}
        >
          <Steps
            progressDot
            current={step}
            style={{ marginBottom: 32 /* xl */ }}
            items={[
              { title: 'Before you close' },
              { title: 'System health checks' },
              { title: 'Preview closing entries' },
              { title: 'Confirm close' },
            ]}
          />

          <div style={{ padding: 24 /* lg */ }}>
            {/* Step 1 */}
            {step === 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16 /* md */,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: 'var(--cr-text)',
                    lineHeight: 1.5,
                  }}
                >
                  Have you posted all adjustment entries for this year? Once closed, no new vouchers
                  can be dated within this FY until you explicitly reopen it.
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16 /* md */,
                  }}
                >
                  {CHECKLIST_ITEMS.map((label, idx) => (
                    <Checkbox
                      key={label}
                      checked={checks[idx]}
                      onChange={(e) =>
                        setChecks((prev) => {
                          const next = [...prev];
                          next[idx] = e.target.checked;
                          return next;
                        })
                      }
                      disabled={!hasAccess}
                    >
                      {label}
                    </Checkbox>
                  ))}
                </div>

                <Form layout="vertical" style={{ marginTop: 16 }}>
                  <Form.Item
                    label="Effective close date"
                    help="Closing entries dated this day. Opening journal dated the next day."
                    style={{ marginBottom: 0 }}
                  >
                    <DatePicker
                      value={cutoff as any}
                      onChange={(v) => setCutoff((v as Dayjs) ?? null)}
                      style={{ maxWidth: 240, width: '100%' }}
                      disabled={!hasAccess}
                    />
                  </Form.Item>
                </Form>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'flex-end',
                    marginTop: 24 /* lg */,
                  }}
                >
                  <DsButton
                    dsVariant="primary"
                    disabled={!step1Ready || !hasAccess}
                    onClick={() => setStep(1)}
                  >
                    Continue
                  </DsButton>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 1 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16 /* md */,
                }}
              >
                <HealthChecksPanel loading={healthLoading} report={health} />

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    marginTop: 16 /* md */,
                  }}
                >
                  <DsButton dsVariant="ghost" onClick={() => setStep(0)}>
                    Back
                  </DsButton>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {health && !health.allPassed && (
                      <DsButton
                        dsVariant="ghost"
                        onClick={handleSkipConfirm}
                        disabled={!hasAccess}
                        style={{ color: 'var(--cr-warning)' }}
                      >
                        Continue at your own risk
                      </DsButton>
                    )}
                    <DsButton
                      dsVariant="primary"
                      disabled={!hasAccess || (!step2Ready && !skipHealthChecks)}
                      onClick={() => setStep(2)}
                    >
                      Continue
                    </DsButton>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 2 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16 /* md */,
                }}
              >
                <JournalsPreview
                  fy={fy}
                  effectiveCloseDate={cutoff ? cutoff.format('YYYY-MM-DD') : (fy.endDate as string)}
                />

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'space-between',
                    marginTop: 16 /* md */,
                  }}
                >
                  <DsButton dsVariant="ghost" onClick={() => setStep(1)}>
                    Back
                  </DsButton>
                  <DsButton dsVariant="primary" onClick={() => setStep(3)} disabled={!hasAccess}>
                    Continue
                  </DsButton>
                </div>
              </div>
            )}

            {/* Step 4 */}
            {step === 3 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16 /* md */,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: 'var(--cr-text)',
                    lineHeight: 1.5,
                  }}
                >
                  Type the firm&apos;s legal name to confirm:
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 18,
                    color: 'var(--cr-text)',
                  }}
                >
                  {expectedFirmName}
                </p>

                <Input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={expectedFirmName}
                  status={confirmName && confirmName !== expectedFirmName ? 'error' : undefined}
                  style={{ maxWidth: 480 }}
                  disabled={!hasAccess || submitting}
                />
                {confirmName && confirmName !== expectedFirmName && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: 'var(--cr-error)',
                    }}
                  >
                    Name doesn&apos;t match. Type exactly as shown above.
                  </p>
                )}

                {submitting && (
                  <Alert
                    type="info"
                    showIcon
                    title="Posting closing and opening journals. Don't close this tab."
                  />
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'space-between',
                    marginTop: 24 /* lg */,
                  }}
                >
                  <DsButton dsVariant="ghost" disabled={submitting} onClick={() => setStep(2)}>
                    Back
                  </DsButton>
                  <DsButton
                    dsVariant="primary"
                    onClick={handleClose}
                    disabled={!step4Ready || !hasAccess || submitting}
                    loading={submitting}
                    style={{
                      background: 'var(--cr-error)',
                      borderColor: 'var(--cr-error)',
                    }}
                  >
                    {`Close FY ${labels.startYear}–${labels.endYear}`}
                  </DsButton>
                </div>
              </div>
            )}
          </div>
        </DsCard>
      )}

      {/* Success state */}
      {success && fy && (
        <DsCard
          style={{ marginTop: 32 /* xl */ }}
          styles={{
            header: { fontFamily: 'var(--font-display)', fontWeight: 700 },
          }}
          title="FY closed successfully"
        >
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: 'var(--cr-text)',
              lineHeight: 1.5,
            }}
          >
            {success.voucherCount} closing entries posted. {success.nextFyStartDate} is now your
            active FY.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
            <DsButton dsVariant="primary" href="/dashboard">
              Go to Dashboard
            </DsButton>
          </div>
        </DsCard>
      )}

      {/* Audit trail */}
      {fy && fy.auditTrail && fy.auditTrail.length > 0 && <AuditTrail entries={fy.auditTrail} />}

      {/* Reopen Modal */}
      <Modal
        open={reopenOpen}
        title="Reopen this FY"
        onCancel={() => {
          if (reopenSubmitting) return;
          setReopenOpen(false);
          setReopenReason('');
          setReopenConfirmation('');
        }}
        footer={null}
        destroyOnHidden
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16 /* md */,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: 'var(--cr-text)',
              lineHeight: 1.5,
            }}
          >
            Reopening removes the FY lock. Closing/opening journals stay in place; you must re-run
            the close after edits.
          </p>

          <Form layout="vertical">
            <Form.Item
              label="Reason"
              help="Required. Audit-logged with your IP and user-agent."
              style={{ marginBottom: 16 }}
            >
              <Input.TextArea
                rows={4}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Why are you reopening this FY? (required, audit-logged)"
                disabled={reopenSubmitting}
              />
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 12,
                  color: reopenReason.length < 10 ? 'var(--cr-text-3)' : 'var(--cr-success)',
                }}
              >
                {reopenReason.length}/10 characters minimum
              </p>
            </Form.Item>

            <Form.Item label="Type 'REOPEN' to confirm" style={{ marginBottom: 0 }}>
              <Input
                value={reopenConfirmation}
                onChange={(e) => setReopenConfirmation(e.target.value)}
                placeholder="REOPEN"
                status={reopenConfirmation && reopenConfirmation !== 'REOPEN' ? 'error' : undefined}
                disabled={reopenSubmitting}
              />
            </Form.Item>
          </Form>

          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              marginTop: 8,
            }}
          >
            <DsButton
              dsVariant="ghost"
              disabled={reopenSubmitting}
              onClick={() => setReopenOpen(false)}
            >
              Cancel
            </DsButton>
            <DsButton
              dsVariant="primary"
              onClick={handleReopen}
              loading={reopenSubmitting}
              disabled={
                reopenReason.length < 10 || reopenConfirmation !== 'REOPEN' || reopenSubmitting
              }
              style={{
                background: 'var(--cr-error)',
                borderColor: 'var(--cr-error)',
              }}
            >
              Confirm reopen
            </DsButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
