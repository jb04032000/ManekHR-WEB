import { test as setup } from '@playwright/test';
import * as path from 'path';
import { signInDemo, DEMO } from './connect-auth';

/**
 * Connect storage-state setup. Signs in ONCE as the master-karigar demo persona
 * (so the suite makes a single OTP request per run, not one per test) and saves
 * the session to tests/e2e/.auth/connect.json. The `connect` project reuses it
 * via storageState. Requires backend AUTH_OTP_MOCK=true + `npm run seed:connect`.
 */
const CONNECT_STORAGE = path.join(process.cwd(), 'tests/e2e/.auth/connect.json');

setup('authenticate connect demo persona', async ({ page }) => {
  await signInDemo(page, DEMO.meera);
  await page.context().storageState({ path: CONNECT_STORAGE });
});
