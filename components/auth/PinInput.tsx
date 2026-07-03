'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

interface PinInputProps {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  /**
   * When true, digits render in plain text. Default `false` masks each
   * digit as a `•` (browser native via `type="password"`). Standard for
   * PIN entry in data-sensitive apps; parent may flip via a "Show PIN"
   * toggle.
   */
  reveal?: boolean;
  /**
   * Browser autocomplete hint for the underlying inputs. PIN flow defaults
   * to `'off'` to suppress password-manager noise. SMS-OTP flow should
   * pass `'one-time-code'` so iOS/Android can auto-fill the code from the
   * received SMS.
   */
  autoCompleteHint?: 'off' | 'one-time-code';
}

export interface PinInputHandle {
  focus: () => void;
  clear: () => void;
}

const PIN_LENGTH = 6;

/**
 * 6-digit PIN entry. Six adjacent boxes with auto-advance on input,
 * focus-previous on backspace-empty, and paste-splits-across-six. The single
 * `value` prop holds the concatenated digits; `onChange` fires on every
 * keystroke and `onComplete` fires once when all six digits are filled.
 *
 * Numeric keyboard on mobile via `inputMode="numeric"`. Each box accepts
 * exactly one digit - letters and other non-digit input are silently dropped.
 */
export const PinInput = forwardRef<PinInputHandle, PinInputProps>(function PinInput(
  {
    value,
    onChange,
    onComplete,
    disabled,
    hasError,
    autoFocus,
    ariaLabel,
    reveal,
    autoCompleteHint = 'off',
  },
  ref,
) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length: PIN_LENGTH }, (_, i) => value[i] ?? '');

  const focusIndex = useCallback((idx: number) => {
    const target = inputRefs.current[idx];
    if (target) target.focus();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => focusIndex(0),
      clear: () => {
        onChange('');
        focusIndex(0);
      },
    }),
    [focusIndex, onChange],
  );

  useEffect(() => {
    if (autoFocus) focusIndex(0);
  }, [autoFocus, focusIndex]);

  const handleChange = (idx: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[idx] = digit;
    const joined = next.join('').slice(0, PIN_LENGTH);
    onChange(joined);
    if (digit && idx < PIN_LENGTH - 1) {
      focusIndex(idx + 1);
    }
    if (joined.length === PIN_LENGTH && onComplete) {
      onComplete(joined);
    }
  };

  const handleKeyDown = (idx: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      if (digits[idx]) {
        // current box has a digit - let the default delete it
        return;
      }
      if (idx > 0) {
        event.preventDefault();
        const next = digits.slice();
        next[idx - 1] = '';
        onChange(next.join(''));
        focusIndex(idx - 1);
      }
    } else if (event.key === 'ArrowLeft' && idx > 0) {
      event.preventDefault();
      focusIndex(idx - 1);
    } else if (event.key === 'ArrowRight' && idx < PIN_LENGTH - 1) {
      event.preventDefault();
      focusIndex(idx + 1);
    }
  };

  const handlePaste = (idx: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    const next = digits.slice();
    for (let i = 0; i < PIN_LENGTH - idx; i += 1) {
      const ch = pasted[i];
      if (!ch) break;
      next[idx + i] = ch;
    }
    const joined = next.join('').slice(0, PIN_LENGTH);
    onChange(joined);
    const lastFilled = Math.min(idx + pasted.length, PIN_LENGTH) - 1;
    focusIndex(Math.min(lastFilled + 1, PIN_LENGTH - 1));
    if (joined.length === PIN_LENGTH && onComplete) {
      onComplete(joined);
    }
  };

  return (
    <div role="group" aria-label={ariaLabel ?? 'PIN input'} className="flex justify-center gap-2">
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el;
          }}
          type={reveal ? 'text' : 'password'}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={autoCompleteHint}
          data-1p-ignore
          data-lpignore="true"
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${idx + 1}`}
          aria-invalid={hasError || undefined}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={(e) => handlePaste(idx, e)}
          onFocus={(e) => e.currentTarget.select()}
          className={[
            'h-12 w-11 rounded-md border bg-surface text-center text-lg font-semibold tabular-nums transition outline-none',
            hasError
              ? 'border-error text-error focus:border-error focus:shadow-[var(--cr-focus-ring-error)]'
              : 'border-border-light text-heading focus:border-primary focus:shadow-[var(--cr-focus-ring)]',
            disabled ? 'cursor-not-allowed opacity-50' : '',
          ].join(' ')}
        />
      ))}
    </div>
  );
});
