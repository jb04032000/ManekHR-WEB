// web/lib/auth/use-msg91-widget.ts
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { env } from '@/lib/env';

const SDK_SRC = 'https://verify.msg91.com/otp-provider.js';

declare global {
  interface Window {
    sendOtp?: (
      identifier: string,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void,
    ) => void;
    retryOtp?: (
      channel: string | null,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void,
      reqId?: string,
    ) => void;
    verifyOtp?: (
      otp: string | number,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void,
      reqId?: string,
    ) => void;
    initSendOTP?: (configuration: Record<string, unknown>) => void;
  }
}

function promisify<TArgs extends unknown[]>(
  fn: ((...args: [...TArgs, (data: unknown) => void, (error: unknown) => void]) => void) | undefined,
) {
  return (...args: TArgs) =>
    new Promise<unknown>((resolve, reject) => {
      if (!fn) {
        reject(new Error('MSG91 widget SDK not loaded yet'));
        return;
      }
      fn(...args, resolve, reject);
    });
}

/**
 * Thin wrapper over MSG91's OTP Widget JS SDK (custom-UI mode —
 * exposeMethods:true, no captchaRenderId so no reCAPTCHA step). Loads the
 * SDK script once per page and exposes promisified sendOtp/retryOtp/verifyOtp
 * matching MSG91's window.sendOtp/retryOtp/verifyOtp callback signatures.
 * No-ops (methods reject) when the widget channel is off — callers only
 * invoke this when `env.authOtpChannel === 'widget'`.
 * Cross-module: called from OtpSendMode.tsx (send/retry) and
 * OtpVerifyMode.tsx (verify). Backend counterpart:
 * api/src/modules/sms/services/msg91-widget-otp.service.ts.
 * Watch: MSG91's `access-token` returned by verifyOtp's success callback
 * must be forwarded to our backend verify-otp action as `accessToken`, not
 * the raw digits the user typed — the backend never sees the real OTP for
 * this channel.
 */
export function useMsg91Widget() {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (env.authOtpChannel !== 'widget') return;
    if (loadedRef.current || document.getElementById('msg91-otp-widget-sdk')) return;
    loadedRef.current = true;

    const configuration = {
      widgetId: env.msg91WidgetId,
      tokenAuth: env.msg91WidgetTokenAuth,
      exposeMethods: true,
      success: () => undefined,
      failure: () => undefined,
    };
    window.initSendOTP = undefined;
    const script = document.createElement('script');
    script.id = 'msg91-otp-widget-sdk';
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => {
      // MSG91's script expects a global `initSendOTP` to exist before it
      // loads (see their <script onload="initSendOTP(configuration)">
      // pattern) — since we load it programmatically instead, call it
      // ourselves once the script tag has executed.
      window.initSendOTP?.(configuration);
    };
    document.body.appendChild(script);
  }, []);

  const sendOtp = useCallback(
    (identifier: string) => promisify<[string]>(window.sendOtp)(identifier),
    [],
  );
  const retryOtp = useCallback(
    // MSG91's retryOtp requires an explicit channel for any NON-default
    // widget configuration (ours is custom-UI, exposeMethods:true) — passing
    // null (only valid for their default-UI config) throws "Channel not
    // provided in retryOtp() method." '11' = resend via SMS.
    () => promisify<[string]>(window.retryOtp)('11'),
    [],
  );
  const verifyOtp = useCallback(
    (otp: string) => promisify<[string]>(window.verifyOtp)(otp),
    [],
  );

  return { sendOtp, retryOtp, verifyOtp };
}
