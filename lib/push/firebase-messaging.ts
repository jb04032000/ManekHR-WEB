'use client';

/**
 * Browser-only FCM web-push client. Lazy-imports the firebase SDK so it never
 * touches the server bundle. All exports no-op (return null/false) when push is
 * not configured or the browser lacks support. Cross-links: lib/env (config),
 * public/firebase-messaging-sw.js (the SW we register here), useBrowserPush.
 */

import { env } from '@/lib/env';

const SW_PATH = '/firebase-messaging-sw.js';

// FCM worker gets its OWN scope (FCM's conventional one), NOT '/'. The PWA
// worker (public/sw.js, registered by ServiceWorkerRegistrar) owns scope '/'.
// A scope can hold exactly ONE service worker, so registering both at '/'
// made each page load replace the FCM worker with the PWA worker (which has
// no push handler) -> pushes went silent. Keep in sync with
// ServiceWorkerRegistrar's unregister filter.
const SW_SCOPE = '/firebase-cloud-messaging-push-scope';

/** Browser supports the APIs FCM web push needs. */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    env.pushConfigured
  );
}

/** Current permission, or 'unsupported'. */
export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// Encode the public firebase config into the SW registration URL so the static
// SW file can initialise without reading env (it cannot). These values are
// publishable, not secret.
function swUrlWithConfig(): string {
  const f = env.firebase;
  const params = new URLSearchParams({
    apiKey: f.apiKey,
    authDomain: f.authDomain,
    projectId: f.projectId,
    messagingSenderId: f.messagingSenderId,
    appId: f.appId,
  });
  return `${SW_PATH}?${params.toString()}`;
}

async function registerMessagingSw(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register(swUrlWithConfig(), { scope: SW_SCOPE });
  } catch {
    return null;
  }
}

/**
 * Ask for permission (if needed), then mint an FCM token. Returns the token, or
 * null if unsupported / denied / failed. Caller persists + registers the token.
 */
export async function requestPushToken(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const swReg = await registerMessagingSw();
  if (!swReg) return null;

  // Lazy import keeps firebase out of the server + initial bundles.
  const { initializeApp, getApps } = await import('firebase/app');
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return null;

  const f = env.firebase;
  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          apiKey: f.apiKey,
          authDomain: f.authDomain,
          projectId: f.projectId,
          messagingSenderId: f.messagingSenderId,
          appId: f.appId,
        });

  try {
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: f.vapidKey,
      serviceWorkerRegistration: swReg,
    });
    return token || null;
  } catch {
    return null;
  }
}

/** Best-effort: revoke the browser's FCM token (on disable). */
export async function deletePushToken(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const { getApps } = await import('firebase/app');
    if (getApps().length === 0) return;
    const { getMessaging, deleteToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return;
    await deleteToken(getMessaging(getApps()[0]));
  } catch {
    /* best-effort */
  }
}

/**
 * Subscribe to FCM foreground messages. Returns an unsubscribe (no-op when
 * unsupported). Caller shows a toast; the bell itself is already updated by the
 * in-platform socket channel. Cross-link: NotificationProvider (subscriber).
 */
export async function onForegroundMessage(
  handler: (msg: { title: string; body: string; link?: string; category?: string }) => void,
): Promise<() => void> {
  if (!isPushSupported()) return () => undefined;
  try {
    const { getApps, initializeApp } = await import('firebase/app');
    const { getMessaging, onMessage, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return () => undefined;
    const f = env.firebase;
    const app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            apiKey: f.apiKey,
            authDomain: f.authDomain,
            projectId: f.projectId,
            messagingSenderId: f.messagingSenderId,
            appId: f.appId,
          });
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      handler({
        // Browser pushes are data-only (no `notification` payload) to avoid a
        // duplicate OS notification; read title/body from `data` first.
        title: payload.data?.title || payload.notification?.title || 'ManekHR',
        body: payload.data?.body || payload.notification?.body || '',
        link: payload.data?.link,
        // The browser_push channel stamps the category so the FE can suppress
        // the foreground toast for messages while on the inbox (see
        // NotificationProvider's foreground push effect).
        category: payload.data?.category,
      });
    });
  } catch {
    return () => undefined;
  }
}
