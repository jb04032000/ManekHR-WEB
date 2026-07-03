/**
 * Single source of truth for environment variables in crewroster-web.
 *
 * Every other file MUST import from here - never read `process.env.X` directly.
 * The lint rule `no-restricted-syntax` (in eslint.config.mjs) is activated
 * after the Phase 0.7 web migration and blocks direct `process.env` access
 * outside this file + build-time configs.
 *
 * Next.js inlines `NEXT_PUBLIC_*` vars at build time so they reach client
 * bundles. Non-prefixed vars are server-only and resolve to `undefined`
 * if accessed from a client component.
 */

/**
 * Make a localhost backend URL reachable when the app is opened from ANOTHER
 * device on the LAN (e.g. a phone hitting `http://192.168.1.5:3001`). In that
 * case `localhost` would resolve to the PHONE, which has no backend, so every
 * browser-side call + the realtime socket fails. We rewrite the host to whatever
 * host served the page (same machine, same port), so any LAN device reaches the
 * dev backend with NO hardcoded IP. No-op on the server (no `window`) and for any
 * non-localhost target (a real production API domain is never touched). Cross-
 * module: every client API call (lib/api/config.ts) + the notifications socket URL
 * (lib/connect/notification-socket.ts) derive from `env.backendApiUrl`, so this
 * one rewrite fixes them all together.
 */
function resolveBrowserApiUrl(configured: string): string {
  if (typeof window === 'undefined') return configured;
  try {
    const target = new URL(configured);
    const targetIsLocal = target.hostname === 'localhost' || target.hostname === '127.0.0.1';
    const pageHost = window.location.hostname;
    const pageIsLocal = pageHost === 'localhost' || pageHost === '127.0.0.1';
    if (targetIsLocal && !pageIsLocal) {
      target.hostname = pageHost;
      return target.toString().replace(/\/$/, '');
    }
  } catch {
    /* malformed configured URL -> fall through and use it verbatim */
  }
  return configured;
}

export const env = {
  // ---------- Runtime mode (inlined client + server) ----------
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV !== 'production',

  // ---------- API endpoints ----------
  // Browser base URL for the backend. Host-rewritten on the client for LAN/phone
  // testing (see resolveBrowserApiUrl); server reads keep the configured value.
  backendApiUrl: resolveBrowserApiUrl(
    process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3000/api',
  ),
  /** Server-only override - falls back to public var if unset. */
  serverBackendApiUrl:
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_API_URL ||
    'http://localhost:3000/api',

  // ---------- Google OAuth (client) ----------
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',

  // ---------- Sentry (Phase 0.9) ----------
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  sentryEnv: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV || 'development',
  /** Build-time (server-only) source-map upload credentials. */
  sentryOrg: process.env.SENTRY_ORG || '',
  sentryProject: process.env.SENTRY_PROJECT || '',
  sentryAuthToken: process.env.SENTRY_AUTH_TOKEN || '',
  /**
   * Deterministic release tag (launch hardening — Workstream F). Set
   * NEXT_PUBLIC_SENTRY_RELEASE (or server-only SENTRY_RELEASE) to the git SHA /
   * image tag in the deploy pipeline so web errors map to the exact build for
   * release-health tracking. Empty -> the @sentry/nextjs build plugin's
   * auto-detected build id is used.
   */
  sentryRelease: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE || '',

  // ---------- PostHog (Phase 0.10) ----------
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',

  // ---------- Google Analytics 4 (Phase 0.10) ----------
  ga4MeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '',

  // ---------- Google AdSense (Connect ad rails) ----------
  // Owner supplies the publisher id (`ca-pub-...`) + one slot id per rail
  // placement. Empty `adSenseClientId` = Google ads OFF: the loader script is
  // not mounted and `AdSlot` renders nothing (no empty box). Personalization /
  // consent (DPDP) is governed by the AdSense account + an optional CMP.
  adSenseClientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '',
  adSenseSlots: {
    'connect.right.top': process.env.NEXT_PUBLIC_ADSENSE_SLOT_RIGHT_TOP || '',
    'connect.right.mid': process.env.NEXT_PUBLIC_ADSENSE_SLOT_RIGHT_MID || '',
    'connect.left.top': process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEFT_TOP || '',
    // In-grid native ad in the marketplace product grid.
    'connect.marketplace.grid': process.env.NEXT_PUBLIC_ADSENSE_SLOT_MARKETPLACE_GRID || '',
  },

  // ---------- App URL (used in absolute links / redirects) ----------
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',

  // ---------- Support / contact email (SINGLE source for all user-facing email) ----------
  // ONE address used everywhere a user can reach us: marketing contact/footer,
  // in-app "contact support", cancellation, attendance device-setup help. Change
  // it in ONE place (this var) and it reflects across the whole app. Default is
  // the brand mailbox; override with NEXT_PUBLIC_SUPPORT_EMAIL. Consumed by
  // components/marketing/content.ts (CONTACT_EMAIL), DeviceSetupGuide,
  // CancelWithOfferModal, and the grievance fallback below.
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@manekhr.in',

  // ---------- Support WhatsApp / phone (SINGLE source, like supportEmail) ----------
  // ONE contact number, used wherever we show a WhatsApp/phone link (today: the
  // marketing contact page). wa.me format = country code + number, DIGITS ONLY,
  // no '+' or spaces (e.g. 919876543210). EMPTY (default) HIDES the WhatsApp
  // contact option entirely. Set NEXT_PUBLIC_SUPPORT_PHONE to your number.
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '',

  // ---------- DPDP grievance / account-deletion recovery contact ----------
  // The grievance-officer mailbox shown on the /grievance page (and the mailto on
  // the deletion-recovery surfaces). Falls back to the single supportEmail above
  // so one mailbox covers grievance too until a dedicated officer address is set
  // via NEXT_PUBLIC_GRIEVANCE_EMAIL. Consumed by the /grievance page +
  // components/account-deletion/constants.
  grievanceEmail:
    process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    'support@manekhr.in',

  // ---------- Connect image CDN resizing (lib/media/imageUrl.ts) ----------
  // Base URL of the Cloudflare zone that fronts the public R2 bucket and has
  // Image Resizing enabled. EMPTY = OFF: `imageVariant()` returns every URL
  // unchanged, so full-size images are served as before. Image Resizing only
  // works when the bucket is served through a PROXIED custom domain (orange
  // cloud), NOT a raw `r2.dev` URL. Set this to that custom domain origin, e.g.
  // https://cdn.manekhr.in - see .env.example for the full setup note.
  imageTransformBase: process.env.NEXT_PUBLIC_IMAGE_TRANSFORM_BASE || '',

  // ---------- App Lock (Quick PIN) ----------
  // Idle timeout in ms before the in-memory lock fires. Mirrors backend's
  // APP_LOCK_IDLE_MS - set both to the same value in deployment.
  appLockIdleMs: (() => {
    const raw = process.env.NEXT_PUBLIC_APP_LOCK_IDLE_MS;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 300_000;
  })(),

  // ---------- Auth SMS-OTP mock mode ----------
  // When true, FE shows the "Mock OTP active - use 123456" banner on /auth.
  // Mirrors backend's AUTH_OTP_MOCK; both must flip together at cutover.
  authOtpMockEnabled: process.env.NEXT_PUBLIC_AUTH_OTP_MOCK === 'true',

  // ---------- SMS-OTP availability (interim until DLT Sender ID is live) ----------
  // The master switch for mobile-number OTP. DEFAULT ON so dev/e2e keep the full
  // OTP flow (served by the mock code). Set NEXT_PUBLIC_SMS_OTP_ENABLED=false on a
  // deploy while a DLT Sender ID is pending: mobile sign-up then creates the
  // account with name + password and NO OTP (phone left unverified), and existing
  // mobile users sign in with their password. When it flips back true (credentials
  // live), a "verify your number" gate force-verifies the phones created during
  // the interim. Drives: CheckMode routing, SignupMode (register-vs-OTP),
  // ForgotMode, verify-mobile page, the team MobileOtpModal, and
  // MobileVerificationGate. Full plan: docs/deployment/SMS-OTP-GOLIVE.md.
  smsOtpEnabled: process.env.NEXT_PUBLIC_SMS_OTP_ENABLED !== 'false',

  // ---------- MSG91 OTP Widget (2026-07) ----------
  // Which OTP product the FE talks to — MUST match the backend's
  // AUTH_OTP_CHANNEL so both sides agree on whether to load the MSG91
  // Widget SDK. 'widget' is the default (no DLT sender-ID needed).
  // widgetId/tokenAuth are the MSG91 Widget's own public client credentials
  // (tokenAuth is designed to be exposed to the browser — see
  // docs/superpowers/specs/2026-07-03-msg91-widget-otp-design.md).
  authOtpChannel: (process.env.NEXT_PUBLIC_AUTH_OTP_CHANNEL === 'dlt' ? 'dlt' : 'widget') as
    | 'dlt'
    | 'widget',
  msg91WidgetId: process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? '',
  msg91WidgetTokenAuth: process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN_AUTH ?? '',

  // ---------- ManekHR Connect ----------
  // Highest Connect phase enabled in this deploy. Each Connect module goes live
  // at its phase (gating in `lib/connect/flags.ts`; the highest is the inbox at
  // 7). DEFAULT 7 = full-featured launch: every current module is on without
  // any env var. Set NEXT_PUBLIC_CONNECT_PHASE lower in a deploy to stage a
  // narrower rollout (e.g. 4 for marketplace-only).
  connectPhase: (() => {
    const raw = process.env.NEXT_PUBLIC_CONNECT_PHASE;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : 7;
  })(),

  // ---------- Online payments (subscription / credits checkout) ----------
  // Master switch for self-serve PAID actions in the account Subscription hub
  // (buy/upgrade a plan, buy credit packs, purchase add-ons, set up auto-renew).
  // DEFAULT OFF: there is no live payment gateway yet - plans/credits are
  // assigned by an admin. While off, those buy CTAs show a "coming soon - contact
  // your admin" notice (see usePaymentsGate / PaymentsComingSoon) instead of
  // opening checkout; everything else (viewing the plan, invoices, history,
  // billing info, cancel, mandate pause/resume) stays fully usable. Flip to
  // `true` once the gateway is live and the real checkout lights up unchanged.
  // Keep in sync with the backend gateway config when enabling.
  paymentsEnabled: process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true',

  // ---------- PWA (installable web app) ----------
  // Master switch for the installable-app behaviour: the service worker
  // (public/sw.js) + the "Install app" prompt (components/pwa/*). DEFAULT ON.
  // Set NEXT_PUBLIC_PWA_ENABLED=false in a deploy to turn it off - the registrar
  // then unregisters any installed worker and purges its caches, so the kill
  // switch fully removes the PWA for users. Note: even when enabled, the worker
  // only registers in PRODUCTION builds; `next dev` skips it to avoid the stale
  // service-worker cache churn that plagues local development.
  pwaEnabled: process.env.NEXT_PUBLIC_PWA_ENABLED !== 'false',

  // ---------- Firebase Cloud Messaging (browser push) ----------
  // Web app config from the Firebase console (Project settings -> General ->
  // your web app) + the Web Push certificate key pair public key (Cloud
  // Messaging -> Web configuration). These are PUBLISHABLE (they ship in every
  // client bundle) -> safe as NEXT_PUBLIC_*. EMPTY any of them = browser push
  // OFF: the SDK never initialises, the enable banner never shows, the settings
  // toggle reads "coming soon". Backend service-account keys (FIREBASE_* in the
  // api repo) are separate and stay server-side. Cross-module: lib/push/* reads
  // this block; pushConfigured gates the whole feature.
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '',
  },

  // True only when every Firebase web-push value is present. Gate the whole
  // browser-push feature on this so a half-configured deploy stays inert.
  // Plain boolean (not a getter) so it survives the `as const` assertion.
  pushConfigured: Boolean(
    (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '') &&
    (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '') &&
    (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '') &&
    (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '') &&
    (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '') &&
    (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''),
  ),
} as const;

export type WebEnv = typeof env;
