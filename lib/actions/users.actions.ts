'use server';

import axios from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { User, UpdateProfilePayload } from '@/types';

const E = ApiEndpoints.users;

// Server actions only marshal `Error.message` across the boundary - the
// axios error object (with `response.data`) is dropped. Convert backend
// errors into Error.message so the FE catch shows the real reason
// (e.g. "Invalid password") instead of the generic
// "Request failed with status code 400".
function rethrowApiError(e: unknown): never {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as Record<string, unknown> | undefined;
    const raw = data?.message ?? data?.error;
    let msg: string | undefined;
    if (typeof raw === 'string' && raw) msg = raw;
    else if (raw && typeof raw === 'object') {
      const nested = (raw as Record<string, unknown>).message;
      if (typeof nested === 'string' && nested) msg = nested;
    }
    if (msg) throw new Error(msg);
  }
  if (e instanceof Error) throw e;
  throw new Error('Something went wrong');
}

export async function getProfile(): Promise<User> {
  const http = await serverHttp();
  const envelope = await http.get(E.profile).then(unwrapServer<{ user: User }>);
  return envelope.user;
}

/**
 * PATCH `/users/profile`. BE wraps the updated user in `{ user: {...} }`;
 * this helper unpacks the `user` field so callers can read fresh values
 * directly (`updated.profilePicture`, etc.). Earlier it cast the whole
 * envelope as `User`, which silently returned `undefined` for every
 * field - same shape bug as `getMe`.
 */
export async function updateProfile(data: UpdateProfilePayload) {
  const http = await serverHttp();
  try {
    const envelope = await http.patch(E.profile, data).then(unwrapServer<{ user: User }>);
    return envelope.user;
  } catch (e) {
    rethrowApiError(e);
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const http = await serverHttp();
  try {
    return await http
      .patch(E.changePassword, { currentPassword, newPassword })
      .then(unwrapServer<{ message: string }>);
  } catch (e) {
    rethrowApiError(e);
  }
}

export async function setPassword(newPassword: string) {
  const http = await serverHttp();
  try {
    return await http.patch(E.setPassword, { newPassword }).then(unwrapServer<{ message: string }>);
  } catch (e) {
    rethrowApiError(e);
  }
}
