import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { User, UpdateProfilePayload } from '@/types';

const E = ApiEndpoints.users;

export const usersApi = {
  getProfile: () => http.get(E.profile).then(unwrap<User>),
  updateProfile: (data: UpdateProfilePayload) => http.patch(E.profile, data).then(unwrap<User>),
  changePassword: (currentPassword: string, newPassword: string) =>
    http
      .patch(E.changePassword, { currentPassword, newPassword })
      .then(unwrap<{ message: string }>),
  setPassword: (newPassword: string) =>
    http.patch(E.setPassword, { newPassword }).then(unwrap<{ message: string }>),
};
