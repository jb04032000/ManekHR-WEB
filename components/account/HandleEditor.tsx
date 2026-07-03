'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Tooltip, message } from 'antd';
import { CheckCircle2, XCircle, Loader2, Copy, Save, AlertTriangle } from 'lucide-react';
import { checkHandleAvailable, claimHandle } from '@/features/connect/profile.actions';
import {
  HANDLE_FORMAT_RE,
  HANDLE_MAX_LEN,
  HANDLE_MIN_LEN,
  type HandleAvailabilityReason,
} from '@/features/connect/profile.types';
import { useAuthStore } from '@/lib/store';
import { parseApiError } from '@/lib/utils';

/**
 * Debounce window between the last keystroke and the availability request.
 * 400 ms is the sweet spot: short enough to feel responsive, long enough that
 * a fast typist doesn't fire 8 requests for a 12-char handle.
 */
const AVAILABILITY_DEBOUNCE_MS = 400;

/** Cooldown between user-initiated handle changes (mirrors the backend). */
const HANDLE_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Inline status of the candidate input - drives the prefix icon + helper-row
 * copy. `idle` = pristine or untouched; `format` = client-side regex rejects;
 * `checking` = network request in flight; `available` / `taken` / `reserved`
 * = backend verdicts.
 */
type CheckStatus = 'idle' | 'format' | 'checking' | 'available' | 'taken' | 'reserved';

/** Network-verdict portion of the state machine - what the server told us. */
type ApiVerdict = 'checking' | 'available' | 'taken' | 'reserved';

/**
 * Snapshot of the last network response. Pairing the verdict with the
 * `value` it answered for defeats stale-response writes: if the user has
 * since typed something else, we ignore the stored verdict (treat as
 * "checking" until a new request lands). The string is the lowercase-trimmed
 * candidate exactly as the request was made.
 */
interface ApiSnapshot {
  value: string;
  verdict: ApiVerdict;
}

/**
 * Map the backend `HandleAvailability` discriminator to the local verdict.
 * Reused by both the inline response and the post-submit error path so the
 * UI uses one mapping.
 */
function reasonToApiVerdict(reason: HandleAvailabilityReason): ApiVerdict {
  if (reason === 'taken') return 'taken';
  return 'reserved';
}

/**
 * Cheap client-side pre-check that mirrors `validateHandleFormat` on the
 * backend (length envelope + format regex). Reserved-list rejection is
 * deferred to the server - duplicating the (long, evolving) reserved list
 * client-side would create drift. The server is the final authority.
 */
function validateFormatLocally(value: string): boolean {
  if (value.length < HANDLE_MIN_LEN || value.length > HANDLE_MAX_LEN) return false;
  return HANDLE_FORMAT_RE.test(value);
}

/**
 * Days remaining on the 30-day cooldown from the last `handleChangedAt`.
 * Rounded UP so the user never sees "0 days" while still locked out. Returns
 * 0 once the cooldown has elapsed.
 */
function cooldownDaysRemaining(handleChangedAt: string | null | undefined): number {
  if (!handleChangedAt) return 0;
  const changedAt = new Date(handleChangedAt).getTime();
  if (!Number.isFinite(changedAt)) return 0;
  const next = changedAt + HANDLE_CHANGE_COOLDOWN_MS;
  const remaining = next - Date.now();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / (24 * 60 * 60 * 1000));
}

export default function HandleEditor() {
  const t = useTranslations('connect.profile.handle');
  const tCommon = useTranslations('common');
  const { user, updateUser } = useAuthStore();
  const [msgApi, ctx] = message.useMessage();

  const userHandle = user?.handle ?? null;
  const userHandleChangedAt = user?.handleChangedAt ?? null;

  const initial = userHandle ?? '';
  const [value, setValue] = useState(initial);
  const [apiSnapshot, setApiSnapshot] = useState<ApiSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncedHandle, setSyncedHandle] = useState(initial);

  // React's documented "deriving state from a changing external source"
  // pattern. When the auth store rehydrates from localStorage (or a save
  // elsewhere updates `user.handle`), `initial` changes and we reset the
  // local input + drop any stale `apiSnapshot`. Doing the setState
  // conditionally during render - not inside useEffect - satisfies
  // `react-hooks/set-state-in-effect`; React simply restarts the render
  // with the new state.
  if (syncedHandle !== initial) {
    setSyncedHandle(initial);
    setValue(initial);
    setApiSnapshot(null);
  }

  const trimmed = value.trim().toLowerCase();
  const isDirty = trimmed !== initial.trim();
  const formatValid = trimmed ? validateFormatLocally(trimmed) : false;
  const daysLeft = useMemo(() => cooldownDaysRemaining(userHandleChangedAt), [userHandleChangedAt]);
  const isCooldown = daysLeft > 0;

  /**
   * Derive the displayed status from `(value, formatValid, apiSnapshot)`.
   * Keeping this purely derived (no setState inside effects) defeats the
   * "cascading renders" lint rule + makes the state machine readable in one
   * place: empty/equal/format → sync verdicts; format-passing → network
   * verdict if it matches the current input, otherwise `checking`.
   */
  const status: CheckStatus = useMemo(() => {
    if (!trimmed || !isDirty) return 'idle';
    if (!formatValid) return 'format';
    if (apiSnapshot && apiSnapshot.value === trimmed) return apiSnapshot.verdict;
    return 'checking';
  }, [trimmed, isDirty, formatValid, apiSnapshot]);

  /**
   * The latest in-flight candidate. Used to drop stale network responses if
   * the user has since typed something else (so an older slow response can
   * never overwrite a newer fast one).
   */
  const pendingValueRef = useRef<string>('');

  const runAvailabilityCheck = useCallback(async (candidate: string) => {
    pendingValueRef.current = candidate;
    const res = await checkHandleAvailable(candidate);
    if (pendingValueRef.current !== candidate) return; // stale response
    if (!res.ok) {
      // Network/transport failure - leave the snapshot empty so the editor
      // stays in `checking` for the current input but the save button stays
      // disabled (we never promote an unverified handle). The user can retry
      // by tweaking + reverting the input.
      setApiSnapshot(null);
      return;
    }
    if (res.data.available) {
      setApiSnapshot({ value: candidate, verdict: 'available' });
      return;
    }
    if (res.data.reason === 'format') {
      // Server-side format rejection - should not happen because we pre-check
      // client-side, but cover the case defensively. Surfaces as the same
      // inline copy.
      setApiSnapshot({ value: candidate, verdict: 'reserved' });
      return;
    }
    setApiSnapshot({ value: candidate, verdict: reasonToApiVerdict(res.data.reason) });
  }, []);

  /**
   * Debounce the network call. The effect ONLY schedules + cancels the
   * timer; it never writes state synchronously - `status` is derived above,
   * and `runAvailabilityCheck` writes the snapshot from inside its async
   * body. This shape satisfies `react-hooks/set-state-in-effect`.
   */
  useEffect(() => {
    if (!trimmed || !isDirty || !formatValid) return;
    if (apiSnapshot?.value === trimmed) return; // already answered
    const timer = setTimeout(() => {
      void runAvailabilityCheck(trimmed);
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, isDirty, formatValid, apiSnapshot, runAvailabilityCheck]);

  const onSubmit = useCallback(async () => {
    if (!trimmed || !isDirty || status !== 'available' || isCooldown) return;
    setSaving(true);
    const res = await claimHandle(trimmed);
    setSaving(false);
    if (res.ok) {
      // Optimistically reflect the new handle in the auth store so the rest
      // of the app (ProfileView share URL, sidebar avatar link, etc.) picks
      // it up without a full reload. `handleChangedAt` is also written so
      // the local cooldown rendering becomes truthful immediately.
      updateUser({
        handle: res.data.handle,
        handleChangedAt: res.data.handleChangedAt,
      });
      msgApi.success(t('saved'));
      return;
    }
    // Translate the discriminated error code to a snapshot the derived
    // `status` will render + a toast for the cooldown branch.
    if (res.code === 'HANDLE_INVALID_FORMAT') {
      setApiSnapshot({ value: trimmed, verdict: 'reserved' }); // format codes
    } else if (res.code === 'HANDLE_RESERVED') {
      setApiSnapshot({ value: trimmed, verdict: 'reserved' });
    } else if (res.code === 'HANDLE_TAKEN') {
      setApiSnapshot({ value: trimmed, verdict: 'taken' });
    }
    if (res.code === 'HANDLE_COOLDOWN') {
      msgApi.error(t('cooldown.error', { days: daysLeft }));
      return;
    }
    msgApi.error(parseApiError(res.error) ?? t('saveFailed'));
  }, [trimmed, isDirty, status, isCooldown, updateUser, msgApi, t, daysLeft]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return userHandle ? `/u/${userHandle}` : '';
    return userHandle ? `${window.location.origin}/u/${userHandle}` : '';
  }, [userHandle]);

  const copyShareUrl = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => msgApi.success(t('copied')))
      .catch(() => msgApi.error(t('copyFailed')));
  }, [shareUrl, msgApi, t]);

  // The status row below the input. Each branch returns a self-contained
  // line - icon + colored text - so the editor's helper row is always
  // exactly one visual statement.
  const statusRow = (() => {
    if (status === 'checking') {
      return (
        <span
          className="flex items-center gap-1.5 text-[12px]"
          style={{ color: 'var(--cr-text-4)' }}
        >
          <Loader2 className="animate-spin" size={13} aria-hidden />
          {t('checking')}
        </span>
      );
    }
    if (status === 'available') {
      return (
        <span
          className="flex items-center gap-1.5 text-[12px]"
          style={{ color: 'var(--cr-success)' }}
        >
          <CheckCircle2 size={13} aria-hidden />
          {t('available')}
        </span>
      );
    }
    if (status === 'format') {
      return (
        <span
          className="flex items-center gap-1.5 text-[12px]"
          style={{ color: 'var(--cr-danger)' }}
        >
          <XCircle size={13} aria-hidden />
          {t('unavailable.format')}
        </span>
      );
    }
    if (status === 'reserved') {
      return (
        <span
          className="flex items-center gap-1.5 text-[12px]"
          style={{ color: 'var(--cr-danger)' }}
        >
          <XCircle size={13} aria-hidden />
          {t('unavailable.reserved')}
        </span>
      );
    }
    if (status === 'taken') {
      return (
        <span
          className="flex items-center gap-1.5 text-[12px]"
          style={{ color: 'var(--cr-danger)' }}
        >
          <XCircle size={13} aria-hidden />
          {t('unavailable.taken')}
        </span>
      );
    }
    // idle - hint at the format so first-timers know what's allowed.
    return (
      <span className="text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
        {t('format')}
      </span>
    );
  })();

  const canSubmit = !saving && isDirty && status === 'available' && !isCooldown;

  return (
    <div>
      {ctx}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label
          htmlFor="connect-handle"
          className="text-[13px] font-semibold"
          style={{ color: 'var(--cr-text)' }}
        >
          {t('label')}
        </label>
        {userHandle && shareUrl && (
          <Tooltip title={shareUrl}>
            <Button
              size="small"
              type="text"
              icon={<Copy size={13} aria-hidden />}
              onClick={copyShareUrl}
              aria-label={t('copyAria')}
            >
              {t('copy')}
            </Button>
          </Tooltip>
        )}
      </div>

      <p className="m-0 mb-3 text-[12px]" style={{ color: 'var(--cr-text-4)', maxWidth: 540 }}>
        {t('description')}
      </p>

      <div className="flex flex-wrap items-stretch gap-2">
        <Input
          id="connect-handle"
          size="large"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          // AntD v6 deprecated `addonBefore`; the modern replacement is
          // `prefix`. Visually slightly different (inline inside the input
          // border vs the original detached grey block), but the `/u/` cue
          // still reads naturally before the user's slug.
          prefix={<span style={{ color: 'var(--cr-text-4)', userSelect: 'none' }}>/u/</span>}
          placeholder={t('placeholder')}
          maxLength={HANDLE_MAX_LEN}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={isCooldown || saving}
          aria-describedby="connect-handle-status"
          style={{ flex: '1 1 280px', maxWidth: 420 }}
        />
        <Button
          type="primary"
          size="large"
          icon={<Save size={15} aria-hidden />}
          onClick={onSubmit}
          loading={saving}
          disabled={!canSubmit}
        >
          {tCommon('save')}
        </Button>
      </div>

      <div id="connect-handle-status" className="mt-2" aria-live="polite">
        {statusRow}
      </div>

      {isCooldown && (
        <div
          className="mt-3 flex items-start gap-2 rounded-[10px] p-3 text-[12px]"
          style={{
            background: 'var(--cr-wash-amber, var(--cr-wash))',
            border: '1px solid var(--cr-border)',
            color: 'var(--cr-text)',
          }}
        >
          <AlertTriangle size={14} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{t('cooldown.locked', { days: daysLeft })}</span>
        </div>
      )}
    </div>
  );
}
