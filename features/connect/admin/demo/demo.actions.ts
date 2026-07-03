'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { DemoUserRow } from './demo.types';

/**
 * Server actions for the admin Connect demo manager. Thin wrappers over the
 * admin-guarded backend endpoints (admin-connect-demo.controller.ts).
 * Linked to: lib/api/endpoints.ts (admin.connectDemo*).
 */
const E = ApiEndpoints.admin;

export async function listDemoUsers(): Promise<DemoUserRow[]> {
  const http = await serverHttp();
  return http.get(E.connectDemoUsers).then(unwrapServer<DemoUserRow[]>);
}

export async function clearAllDemo(): Promise<{ removed: number }> {
  const http = await serverHttp();
  return http.post(E.connectDemoClear, {}).then(unwrapServer<{ removed: number }>);
}

export async function deleteDemoUser(id: string): Promise<{ removed: number }> {
  const http = await serverHttp();
  return http.delete(E.connectDemoUser(id)).then(unwrapServer<{ removed: number }>);
}

export async function postAsDemoUser(id: string, body: string): Promise<{ postId: string }> {
  const http = await serverHttp();
  return http.post(E.connectDemoPost(id), { body }).then(unwrapServer<{ postId: string }>);
}
