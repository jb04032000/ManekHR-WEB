'use client';

// Reusable App-Lock-PIN confirmation gate for sensitive BULK operations.
//
// What it does: blocks a bulk action behind the user's 6-digit App Lock PIN.
// On submit it verifies via pinApi.verify (auth/pin-verify); only on success
// does it call `onConfirmed()`, where the caller runs the actual bulk request.
//
// Cross-module links:
//   • PIN verification -> lib/api/modules/pin.api `pinApi` -> BE auth/pin-verify.
//   • Reuses components/auth/PinInput (the same 6-box entry used by App Lock).
//   • Used by team bulk import (TeamBulkImportModal) and attendance bulk mark
//     (BulkMarkMonthModal). Add new bulk surfaces here, don't fork the gate.
//
// Watch: if the user has NOT set an App Lock PIN we can't gate, so we surface a
// "set a PIN" prompt linking to /account/security rather than silently
// allowing the action. Keep the no-PIN copy honest.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Button, Alert, Spin } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { pinApi } from '@/lib/api/modules';
import { PinInput, type PinInputHandle } from '@/components/auth/PinInput';
import { parseApiError } from '@/lib/utils';

interface PinConfirmModalProps {
  open: boolean;
  /** Headline, e.g. "Confirm bulk import". */
  title: string;
  /** One-line description of what is about to happen + the count. */
  description: string;
  /** Verb on the confirm button once the PIN is entered, e.g. "Import 42 members". */
  confirmLabel: string;
  /** Runs only after the PIN verifies. Throw to surface an error in the modal. */
  onConfirmed: () => Promise<void> | void;
  onCancel: () => void;
  /** Caller-driven busy state (the underlying bulk request running). */
  submitting?: boolean;
  /** Optional live progress text shown while submitting (e.g. "120 / 500"). */
  progress?: string;
}

export default function PinConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onConfirmed,
  onCancel,
  submitting,
  progress,
}: PinConfirmModalProps) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<PinInputHandle>(null);

  // Probe whether a PIN exists each time the modal opens - a user may set one
  // mid-session from the security page, so we never cache across opens.
  useEffect(() => {
    if (!open) return;
    setPin('');
    setError(null);
    setCheckingStatus(true);
    let cancelled = false;
    pinApi
      .status()
      .then((s) => {
        if (cancelled) return;
        setPinSet(s.pinSet);
      })
      .catch(() => {
        if (!cancelled) setPinSet(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Accept the completed PIN as an argument: PinInput.onComplete fires in the
  // same tick the 6th digit is typed, BEFORE the parent `pin` state has
  // committed - reading state here would see only 5 digits and wrongly show
  // "enter your PIN". The Enter key / button paths pass nothing and fall back
  // to state (which is current by then).
  const handleConfirm = useCallback(
    async (pinValue?: string) => {
      const p = pinValue ?? pin;
      if (p.length !== 6) {
        setError('Enter your 6-digit PIN.');
        return;
      }
      setVerifying(true);
      setError(null);
      try {
        await pinApi.verify(p);
        await onConfirmed();
      } catch (e) {
        // pinApi.verify throws on a wrong PIN (BE 401/403); the caller's
        // onConfirmed may also throw (bulk request failed) - both land here.
        setError(parseApiError(e) ?? 'Incorrect PIN. Please try again.');
        setPin('');
        inputRef.current?.clear();
      } finally {
        setVerifying(false);
      }
    },
    [pin, onConfirmed],
  );

  const busy = verifying || !!submitting;

  return (
    <Modal
      open={open}
      onCancel={busy ? undefined : onCancel}
      title={
        <span className="flex items-center gap-2">
          <LockOutlined /> {title}
        </span>
      }
      footer={null}
      destroyOnHidden
      mask={{ closable: !busy }}
      width={420}
    >
      {checkingStatus ? (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      ) : pinSet === false ? (
        <div className="space-y-4">
          <Alert
            type="warning"
            showIcon
            title="App Lock PIN required"
            description="Bulk actions are protected by your App Lock PIN. Set one to continue."
          />
          <div className="flex justify-end gap-2">
            <Button onClick={onCancel}>Cancel</Button>
            <Button type="primary" onClick={() => router.push('/account/security')}>
              Set up PIN
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="m-0 text-sm text-subtle">{description}</p>
          {/* Enter submits with the current PIN (PinInput doesn't intercept
              Enter, so it bubbles to this wrapper). */}
          <div
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy) {
                e.preventDefault();
                void handleConfirm();
              }
            }}
          >
            <PinInput
              ref={inputRef}
              value={pin}
              onChange={(v) => {
                setPin(v);
                if (error) setError(null);
              }}
              onComplete={(value) => void handleConfirm(value)}
              disabled={busy}
              hasError={!!error}
              autoFocus
              ariaLabel="Confirmation PIN"
            />
          </div>
          {error && <p className="m-0 text-center text-sm text-error">{error}</p>}
          {busy && progress && <p className="m-0 text-center text-sm text-subtle">{progress}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="primary"
              loading={busy}
              disabled={pin.length !== 6}
              onClick={() => void handleConfirm()}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
