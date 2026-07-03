import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { User, AuthResult, RegisterPayload } from '@/types';

const E = ApiEndpoints.auth;

export type OtpFlowType = 'login' | 'register' | 'forgot';

export interface SendOtpResponse {
  ok: true;
  sent: true;
  expiresAt: string;
  resendCooldownSec: number;
  mockMode: boolean;
  idempotent?: true;
}

export interface VerifyOtpPayload {
  mobile: string;
  otp: string;
  flowType: OtpFlowType;
  name?: string;
  password?: string;
  /**
   * Wave 4.8 (2026-05-10) - atomic signup-and-accept-invite (mobile path).
   * Set when this verify call is the final step of an invite-link signup.
   * BE creates User + joins workspace via bridge invite row in one shot.
   */
  inviteToken?: string;
}

export const authApi = {
  checkUser: (identifier: string) =>
    http.post(E.checkUser, { identifier }).then(
      unwrap<{
        exists: boolean;
        hasPassword: boolean;
        hasMobile: boolean;
        authMethod: 'password' | 'google' | 'otp_only' | null;
        otpAllowed: boolean;
      }>,
    ),
  login: (identifier: string, password: string) =>
    http.post(E.login, { identifier, password }).then(unwrap<AuthResult>),
  register: (payload: RegisterPayload) => http.post(E.register, payload).then(unwrap<AuthResult>),
  googleAuth: (idToken: string) => http.post(E.google, { idToken }).then(unwrap<AuthResult>),
  refreshToken: (refreshToken: string) =>
    http.post(E.refresh, { refreshToken }).then(unwrap<{ accessToken: string }>),
  forgotPassword: (identifier: string) =>
    http.post(E.forgotPassword, { identifier }).then(unwrap<{ message: string }>),
  resetPassword: (token: string, newPassword: string) =>
    http.post(E.resetPassword, { token, newPassword }).then(unwrap<{ message: string }>),
  sendVerificationEmail: (email: string) =>
    http.post(E.sendVerificationEmail, { email }).then(unwrap<{ message: string }>),
  verifyEmail: (token: string) =>
    http.post(E.verifyEmail, { token }).then(unwrap<{ message: string }>),
  me: () => http.get(E.me).then(unwrap<User>),
  logout: (refreshToken: string) =>
    http.post(E.logout, { refreshToken }).then(unwrap<{ message: string }>),

  // ── SMS-OTP ──────────────────────────────────────────────────────
  sendOtp: (mobile: string, flowType: OtpFlowType) =>
    http.post(E.sendOtp, { mobile, flowType }).then(unwrap<SendOtpResponse>),
  verifyOtp: (payload: VerifyOtpPayload) =>
    http.post(E.verifyOtp, payload).then(unwrap<AuthResult>),
  resendOtp: (mobile: string, flowType: OtpFlowType) =>
    http.post(E.resendOtp, { mobile, flowType }).then(unwrap<SendOtpResponse>),
  sendMobileVerifyOtp: (mobile?: string) =>
    http.post(E.sendMobileVerifyOtp, mobile ? { mobile } : {}).then(unwrap<SendOtpResponse>),
  verifyMobile: (otp: string) => http.post(E.verifyMobile, { otp }).then(unwrap<{ ok: true }>),
};
