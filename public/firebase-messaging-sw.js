/* Zari360 FCM background-message worker.
 *
 * SEPARATE from public/sw.js (the PWA cache worker, scope '/'). This worker is
 * registered under its own scope '/firebase-cloud-messaging-push-scope' (see
 * lib/push/firebase-messaging.ts) so the two can coexist: one scope holds only
 * ONE service worker, so sharing '/' made each PWA registration evict this
 * worker and silence all pushes. This file
 * only handles Web Push: it shows a notification when a push arrives while the
 * tab is backgrounded, and routes a click to data.link. Config arrives via the
 * registration URL query string (set in lib/push/firebase-messaging.ts) because
 * a static SW cannot read NEXT_PUBLIC_* env. These config values are publishable.
 * Keep the SDK version below in sync with the `firebase` npm dep (lib/push).
 */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // Browser pushes are DATA-ONLY (see api PushAdapter.sendUserPush dataOnly):
    // title/body ride in `data` so the FCM SDK does not auto-display a duplicate.
    // Fall back to a `notification` payload for any non-data-only sender.
    const d = payload.data || {};
    const n = payload.notification || {};
    const title = d.title || n.title || 'Zari360';
    const body = d.body || n.body || '';
    const link = d.link || '/connect/notifications';
    // vibrate makes Android treat it as an alerting (heads-up) notification
    // instead of a silent tray entry. Pairs with the BE's webpush Urgency:high
    // (api push.adapter sendUserPush dataOnly branch).
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { link },
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link =
    (event.notification.data && event.notification.data.link) || '/connect/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
