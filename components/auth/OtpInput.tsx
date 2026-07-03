'use client';

import { forwardRef } from 'react';
import { PinInput, type PinInputHandle } from './PinInput';

interface OtpInputProps {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (otp: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
}

/**
 * 6-digit SMS-OTP entry. Wraps `<PinInput>` with the OTP-specific reveal
 * default (true - codes are short-lived public tokens, not secrets) and the
 * iOS/Android SMS auto-fill hint via `autoComplete="one-time-code"` so the
 * platform can read the latest SMS and auto-populate the field.
 */
export const OtpInput = forwardRef<PinInputHandle, OtpInputProps>(function OtpInput(props, ref) {
  return (
    <PinInput
      ref={ref}
      value={props.value}
      onChange={props.onChange}
      onComplete={props.onComplete}
      disabled={props.disabled}
      hasError={props.hasError}
      autoFocus={props.autoFocus}
      reveal
      ariaLabel={props.ariaLabel ?? 'OTP input'}
      autoCompleteHint="one-time-code"
    />
  );
});
