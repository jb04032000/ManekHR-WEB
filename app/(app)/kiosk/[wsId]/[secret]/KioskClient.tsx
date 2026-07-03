'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { kioskApi } from '@/lib/api/modules/kiosk.api';

type KioskState = 'idle' | 'looking-up' | 'confirm' | 'pin' | 'submitting' | 'success' | 'fail';

interface LookupResult {
  name: string;
  photoUrl: string | null;
}

interface PunchResult {
  name: string;
  photoUrl: string | null;
  punchType: 'CHECK_IN' | 'CHECK_OUT';
  time: string;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return isoString;
  }
}

function InitialsAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase();
  const colors = [
    'var(--cr-info-500)',
    'var(--cr-success-500)',
    'var(--cr-warning-500)',
    'var(--cr-indigo-400)',
    'var(--cr-info-500)',
    'var(--cr-danger-500)',
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      className="mx-auto flex h-48 w-48 items-center justify-center rounded-full text-6xl font-bold text-white select-none"
      style={{ background: color }}
    >
      {initial}
    </div>
  );
}

interface NumpadProps {
  onDigit: (d: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  disabled?: boolean;
}

function Numpad({ onDigit, onClear, onSubmit, submitLabel = 'Submit', disabled }: NumpadProps) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'submit'];
  return (
    <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3">
      {keys.map((k) => {
        if (k === 'clear') {
          return (
            <button
              key={k}
              onClick={onClear}
              disabled={disabled}
              className="h-16 rounded-xl border border-gray-200 bg-white text-lg font-semibold shadow select-none active:bg-gray-200 disabled:opacity-50"
            >
              Clear
            </button>
          );
        }
        if (k === 'submit') {
          return (
            <button
              key={k}
              onClick={onSubmit}
              disabled={disabled}
              className="h-16 rounded-xl bg-blue-600 text-lg font-semibold text-white shadow select-none active:bg-blue-700 disabled:opacity-50"
            >
              {submitLabel}
            </button>
          );
        }
        return (
          <button
            key={k}
            onClick={() => onDigit(k)}
            disabled={disabled}
            className="h-16 rounded-xl border border-gray-200 bg-white text-3xl font-semibold shadow select-none active:bg-gray-200 disabled:opacity-50"
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}

export default function KioskClient({ wsId, secret }: { wsId: string; secret: string }) {
  const [kioskState, setKioskState] = useState<KioskState>('idle');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [punchResult, setPunchResult] = useState<PunchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('Invalid employee or PIN');
  const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoReset = () => {
    if (autoResetRef.current) {
      clearTimeout(autoResetRef.current);
      autoResetRef.current = null;
    }
  };

  const resetToIdle = useCallback(() => {
    clearAutoReset();
    setKioskState('idle');
    setCode('');
    setPin('');
    setLookupResult(null);
    setPunchResult(null);
    setErrorMessage('Invalid employee or PIN');
  }, []);

  // Auto-reset after success (3s) or fail (5s)
  useEffect(() => {
    if (kioskState === 'success') {
      autoResetRef.current = setTimeout(() => resetToIdle(), 3000);
    } else if (kioskState === 'fail') {
      autoResetRef.current = setTimeout(() => resetToIdle(), 5000);
    }
    return clearAutoReset;
  }, [kioskState, resetToIdle]);

  // Code numpad handlers
  const handleCodeDigit = (d: string) => {
    setCode((prev) => (prev.length < 20 ? prev + d : prev));
  };
  const handleCodeClear = () => setCode('');

  const handleCodeSubmit = async () => {
    if (!code.trim()) return;
    setKioskState('looking-up');
    try {
      const result = await kioskApi.lookup(wsId, secret, code.trim());
      setLookupResult(result);
      setKioskState('confirm');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      // Show "locked" message verbatim if present; otherwise show generic message
      setErrorMessage(
        msg && msg.toLowerCase().includes('locked') ? msg : 'Invalid employee or PIN',
      );
      setKioskState('fail');
    }
  };

  // PIN handlers
  const handlePinDigit = (d: string) => {
    setPin((prev) => {
      const next = prev.length < 4 ? prev + d : prev;
      // Auto-submit when 4 digits entered
      if (next.length === 4) {
        // Use setTimeout to let state settle before submitting
        setTimeout(() => handlePinSubmit(next), 50);
      }
      return next;
    });
  };
  const handlePinClear = () => setPin('');

  const handlePinSubmit = async (pinValue?: string) => {
    const p = pinValue ?? pin;
    if (p.length !== 4 || !lookupResult) return;
    setKioskState('submitting');
    try {
      const result = await kioskApi.punch(wsId, secret, code.trim(), p);
      setPunchResult(result);
      setKioskState('success');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setErrorMessage(
        msg && msg.toLowerCase().includes('locked') ? msg : 'Invalid employee or PIN',
      );
      setKioskState('fail');
    }
  };

  // ── Render states ──────────────────────────────────────────────────

  if (kioskState === 'success' && punchResult) {
    const bg = punchResult.punchType === 'CHECK_IN' ? 'bg-green-500' : 'bg-blue-500';
    const label = punchResult.punchType === 'CHECK_IN' ? 'Checked in' : 'Checked out';
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center ${bg} select-none`}>
        <div className="space-y-4 text-center text-white">
          <p className="text-5xl font-bold">{punchResult.name}</p>
          <p className="text-3xl font-semibold">{label}</p>
          <p className="font-mono text-4xl">{formatTime(punchResult.time)}</p>
          <p className="mt-6 text-xl opacity-75">Returning in 3 seconds…</p>
        </div>
      </div>
    );
  }

  if (kioskState === 'fail') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-red-500 select-none">
        <div className="space-y-6 text-center text-white">
          <p className="text-5xl font-bold">Error</p>
          <p className="text-2xl">{errorMessage}</p>
          <button
            onClick={resetToIdle}
            className="mt-6 rounded-xl bg-white px-8 py-4 text-xl font-semibold text-red-700 active:bg-gray-100"
          >
            Try again
          </button>
          <p className="text-lg opacity-75">Auto-returning in 5 seconds…</p>
        </div>
      </div>
    );
  }

  if (kioskState === 'confirm' && lookupResult) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 select-none">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 text-center shadow-lg">
          <h2 className="text-2xl font-semibold text-gray-800">Is this you?</h2>
          {lookupResult.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lookupResult.photoUrl}
              alt={lookupResult.name}
              className="mx-auto h-48 w-48 rounded-full object-cover"
            />
          ) : (
            <InitialsAvatar name={lookupResult.name} />
          )}
          <p className="text-3xl font-bold text-gray-900">{lookupResult.name}</p>
          <div className="flex gap-3">
            <button
              onClick={resetToIdle}
              className="h-14 flex-1 rounded-xl border border-gray-300 bg-white text-lg font-semibold select-none active:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => setKioskState('pin')}
              className="h-14 flex-1 rounded-xl bg-blue-600 text-lg font-semibold text-white select-none active:bg-blue-700"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (kioskState === 'pin') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 select-none">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg">
          <h2 className="text-center text-2xl font-semibold text-gray-800">
            Enter your 4-digit PIN
          </h2>
          {/* PIN dots */}
          <div className="flex justify-center gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-6 w-6 rounded-full border-2 transition-colors ${
                  i < pin.length ? 'border-blue-600 bg-blue-600' : 'border-gray-400 bg-white'
                }`}
              />
            ))}
          </div>
          <Numpad
            onDigit={handlePinDigit}
            onClear={handlePinClear}
            onSubmit={() => handlePinSubmit()}
            submitLabel="OK"
          />
          <button
            onClick={resetToIdle}
            className="h-12 w-full text-base text-gray-700 underline select-none"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (kioskState === 'looking-up' || kioskState === 'submitting') {
    const label = kioskState === 'looking-up' ? 'Checking…' : 'Recording…';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 select-none">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-2xl font-semibold text-gray-700">{label}</p>
        </div>
      </div>
    );
  }

  // idle state
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 select-none">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-center text-2xl font-bold text-gray-900">Enter Employee Code</h1>
        {/* Display input (read-only, fed by numpad) */}
        <div
          className="flex h-14 w-full items-center justify-center rounded-xl border-2 border-gray-300 bg-gray-50 font-mono text-2xl tracking-widest text-gray-800 select-none"
          style={{ inputMode: 'numeric' } as React.CSSProperties}
        >
          {code || <span className="text-xl text-faint">_ _ _ _</span>}
        </div>
        <Numpad
          onDigit={handleCodeDigit}
          onClear={handleCodeClear}
          onSubmit={handleCodeSubmit}
          submitLabel="Next"
        />
      </div>
    </div>
  );
}
