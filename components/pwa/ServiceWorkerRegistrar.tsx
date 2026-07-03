'use client';

import { useEffect } from 'react';
import { env } from '@/lib/env';

// Registers (or tears down) the service worker in public/sw.js - the engine
// behind the installable app: cached static assets for instant loads + the
// /offline fallback. Registers in PRODUCTION only; in dev, or when the
// NEXT_PUBLIC_PWA_ENABLED kill switch is off, it actively unregisters any stale
// worker and clears its caches so the PWA is fully removed for users.
// Rendered (no UI) by components/pwa/PwaManager.tsx.
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const enabled = env.pwaEnabled && env.isProd;

    if (!enabled) {
      // Kill switch / dev: remove the previously-installed PWA worker + its
      // caches. ONLY the PWA worker (/sw.js): the FCM push worker
      // (firebase-messaging-sw.js, own scope, lib/push/firebase-messaging.ts)
      // must survive, otherwise every dev reload destroyed the push
      // subscription and killed the registered FCM token.
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => {
          const url = (r.active ?? r.waiting ?? r.installing)?.scriptURL ?? '';
          if (new URL(url, location.origin).pathname === '/sw.js') void r.unregister();
        });
      });
      if (typeof caches !== 'undefined') {
        void caches.keys().then((keys) => {
          keys.forEach((k) => {
            if (k.startsWith('z360-')) void caches.delete(k);
          });
        });
      }
      return;
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('[pwa] service worker registration failed', err);
      });
    };

    // Register after load so the worker never competes with first paint.
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
