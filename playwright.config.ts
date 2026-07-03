import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Playwright config for zari360 web e2e.
 *
 * Prerequisites (owner-side):
 *   1. pnpm install                                 # picks up @playwright/test
 *   2. pnpm test:e2e:install                        # downloads chromium binary
 *   3. crewroster-backend running on :3000 with AUTH_OTP_MOCK=true
 *   4. crewroster-web running on :3001 (or pass BASE_URL env)
 *
 * Required env vars for the RBAC + setup projects (Wave 4.13):
 *   E2E_OWNER_MOBILE / E2E_OWNER_PIN - pre-seeded owner account
 *   E2E_MEMBER_MOBILE / E2E_MEMBER_PIN - pre-seeded second user
 *   E2E_OWNER_WORKSPACE_ID - workspace owned by owner (must have ≥1 Member role; W4.11 seed handles new ws)
 *   E2E_OWNER_TEAM_MEMBER_ID - directory member ID without app access (used by L1)
 *   E2E_OWNER_TEAM_MEMBER_FOR_REMOVAL_ID - directory member earmarked for L4
 *   MONGO_URI - direct DB write target for L7 expired-invite seed
 *
 * Local run:
 *   pnpm test:e2e                                   # runs all projects
 *   pnpm test:e2e --project=auth-flow               # OTP-only (no fixtures needed)
 *   pnpm test:e2e --project=rbac-owner              # owner-side L1/L4 scenarios
 *   pnpm test:e2e --project=rbac-member             # member-side L2/L4/L5 scenarios
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';

const OWNER_STORAGE = path.join(process.cwd(), 'tests/e2e/.auth/owner.json');
const MEMBER_STORAGE = path.join(process.cwd(), 'tests/e2e/.auth/member.json');
const CONNECT_STORAGE = path.join(process.cwd(), 'tests/e2e/.auth/connect.json');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Serialize: BE per-phone + per-IP rate-limits (sms-otp throttler tier +
  // Redis sliding-window) reject parallel sendOtp calls from a single dev
  // host. CI can still parallelize across runners with isolated IPs.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    // 1. Setup project - populates storage state for owner + member contexts.
    //    Both setups can run in parallel inside this project (each picks its
    //    own pre-seeded mobile, no per-phone collision).
    {
      name: 'setup',
      testMatch: /setup\/.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // 2. OTP register/login flow - independent, no fixtures needed. Mirrors
    //    pre-W4.13 default project so existing CI invocations keep working.
    {
      name: 'auth-flow',
      testMatch: /auth-sms-otp\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // 3. RBAC owner-side scenarios (L1 + L4 owner-side + L7).
    {
      name: 'rbac-owner',
      testMatch: /rbac-grant-access\.spec\.ts/,
      grep: /@owner/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: OWNER_STORAGE,
      },
    },
    // 4. RBAC member-side scenarios (L2 + L4 member-side + L5).
    {
      name: 'rbac-member',
      testMatch: /rbac-grant-access\.spec\.ts/,
      grep: /@member/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: MEMBER_STORAGE,
      },
    },
    // 5. Attendance happy path (Phase 5 slot 4 W6.16).
    {
      name: 'attendance',
      testMatch: /attendance\.spec\.ts/,
      grep: /@attendance/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: OWNER_STORAGE,
      },
    },
    // 6. Connect: log in ONCE (connect-setup) then reuse the session for the
    //    specs — a single OTP request per run (the BE rate-limits OTP per phone).
    //    Requires: backend AUTH_OTP_MOCK=true + `npm run seed:connect` run.
    {
      name: 'connect-setup',
      testMatch: /connect\/connect\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'connect',
      testMatch: /connect\/.*\.spec\.ts/,
      dependencies: ['connect-setup'],
      use: { ...devices['Desktop Chrome'], storageState: CONNECT_STORAGE },
    },
  ],
});
