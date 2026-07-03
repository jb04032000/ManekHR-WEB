'use client';

/**
 * Lazy loader for the Razorpay JS SDK (`https://checkout.razorpay.com/v1/checkout.js`).
 *
 * Single shared promise - repeated calls reuse the same `<script>`.
 * Resolves with the `Razorpay` constructor exposed on `window.Razorpay`.
 *
 * Reasons not to lazy-load via next/script:
 * - Razorpay's checkout script registers a global; it must be loaded
 *   before user clicks "Pay" but ideally NOT on every page render.
 * - We need an explicit Promise (not a render-driven flag) so the
 *   click handler can `await loadRazorpay()` and call `new Razorpay(...)`
 *   in one synchronous flow with the correct user-gesture context.
 */

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const SCRIPT_ID = 'razorpay-checkout-sdk';

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

export interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: 'payment.failed', handler: (resp: unknown) => void) => void;
}

export type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

let loaderPromise: Promise<RazorpayConstructor> | null = null;

export function loadRazorpay(): Promise<RazorpayConstructor> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('loadRazorpay called on the server'));
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.Razorpay) resolve(window.Razorpay);
        else reject(new Error('Razorpay SDK loaded but window.Razorpay missing'));
      });
      existing.addEventListener('error', () => {
        loaderPromise = null;
        reject(new Error('Failed to load Razorpay SDK'));
      });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else {
        loaderPromise = null;
        reject(new Error('Razorpay SDK loaded but window.Razorpay missing'));
      }
    };
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error('Failed to load Razorpay SDK'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}
