'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  AdminConnectEntitlementsView,
  ConnectEntitlementsOverride,
} from './entitlements.types';

/**
 * Server actions for the admin per-user Connect entitlements console.
 *
 * Thin wrappers over the admin-guarded backend endpoints (admin-connect-
 * entitlements.controller.ts). All three return the full refreshed view so the
 * client re-renders plan/override/effective/usage after every mutation without a
 * second round-trip. Linked to: lib/api/endpoints.ts (admin.connectEntitlements*).
 */
const E = ApiEndpoints.admin;

/** Plan defaults vs override vs effective + usage for one person. */
export async function getConnectEntitlements(
  userId: string,
): Promise<AdminConnectEntitlementsView> {
  const http = await serverHttp();
  return http.get(E.connectEntitlements(userId)).then(unwrapServer<AdminConnectEntitlementsView>);
}

/** Set/replace the connect override (partial - only provided fields override). */
export async function setConnectEntitlementsOverride(
  userId: string,
  override: ConnectEntitlementsOverride,
): Promise<AdminConnectEntitlementsView> {
  const http = await serverHttp();
  return http
    .put(E.connectEntitlementsOverride(userId), override)
    .then(unwrapServer<AdminConnectEntitlementsView>);
}

/** Clear the connect override entirely (restore plan values). */
export async function clearConnectEntitlementsOverride(
  userId: string,
): Promise<AdminConnectEntitlementsView> {
  const http = await serverHttp();
  return http
    .delete(E.connectEntitlementsOverride(userId))
    .then(unwrapServer<AdminConnectEntitlementsView>);
}
