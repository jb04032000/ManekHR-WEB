'use client';

import { useState } from 'react';
import { Form, Input, Button, Alert, Checkbox, Select, InputNumber } from 'antd';
import {
  ArrowLeftOutlined,
  BankOutlined,
  MailOutlined,
  RightOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Info } from 'lucide-react';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { useTranslations } from 'next-intl';
import { register as registerAction } from '@/lib/actions';
// Legacy-path T&C stamp: this screen creates ERP accounts (invite links,
// /auth?mode=register, OTP variant) that used to skip `acceptedPolicy`
// entirely, so every such user hit the ERP PolicyGate right after signing up.
// The password path now sends acceptedPolicy:'erp' with /auth/register; the
// OTP path (user already exists) stamps via acceptErpPolicy below.
import { acceptErpPolicy } from '@/features/policy/policy.actions';
import { syncAuthCookie } from '@/lib/actions/cookies';
import { useAuthStore, useWorkspaceStore } from '@/lib/store';
import { parseApiError } from '@/lib/utils';
import { useAuthErrorMessage } from '@/lib/format/auth-error-codes';
import { InfoTooltip } from '@/components/ui';
import type { AuthSuccessHandler, BaseModeProps } from './types';

interface RegisterWorkspaceModeProps extends BaseModeProps, AuthSuccessHandler {
  /** Captured from RegisterMode (password path) OR OtpVerifyMode (OTP path). */
  registerData: { name: string; identifier: string; password?: string } | null;
  /**
   * True when the caller is already a registered user with a name + password
   * (e.g. the post-signup workspace step). Suppresses the inline name/password
   * fields that the legacy OTP-only path shows.
   */
  hideAccountFields?: boolean;
  /**
   * Overrides the Back button label. The standalone setup-workspace page uses
   * this to show "Back to Connect" for an existing authed session (where Back
   * returns to Connect, not sign-out). Defaults to the generic "Back".
   */
  backLabel?: string;
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export function RegisterWorkspaceMode({
  setMode,
  registerData,
  onAuthSuccess,
  hideAccountFields = false,
  backLabel,
}: RegisterWorkspaceModeProps) {
  const t = useTranslations('auth');
  // Localize a backend error code (e.g. NETWORK_UNREACHABLE on a backend-down)
  // so the register failure never shows a raw axios string. The workspace POST
  // + catch path use parseApiError, whose network floor is already friendly.
  const authErrMsg = useAuthErrorMessage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Custom controlled disclosure for the optional business-details section.
  // Replaces the AntD `<Collapse>` we used earlier - too much of AntD's
  // built-in chrome was bleeding through (its own padding, header alignment
  // quirks, chevron sizing) and competing with the bespoke header layout.
  // A plain React useState + native button gives full control.
  const [businessOpen, setBusinessOpen] = useState(false);
  const { setAuth, updateUser } = useAuthStore();
  const { setWorkspaces } = useWorkspaceStore();

  // OTP-register path is identified by the absence of a captured password
  // (RegisterMode would have set one). Used to gate the inline name field.
  const isOtpPath = !!registerData && !registerData.password;

  const handleSubmit = async (vals: {
    name?: string;
    password?: string;
    workspaceName: string;
    location?: string;
    businessType?: 'trading' | 'manufacturing' | 'service' | 'composition';
    gstin?: string;
    pan?: string;
    fyStartMonth?: number;
    policyAccepted?: boolean;
  }) => {
    if (!registerData) return;
    setError('');
    setLoading(true);
    try {
      // Password path - call /auth/register. OTP path is handled upstream
      // (account already created by /auth/verify-otp).
      let accessToken: string | undefined;
      let refreshToken: string | undefined;
      if (registerData.password) {
        const isEmail = registerData.identifier.includes('@');
        const payload = {
          name: registerData.name,
          password: registerData.password,
          ...(isEmail ? { email: registerData.identifier } : { mobile: registerData.identifier }),
          // Atomic ERP T&C stamp at user creation (checkbox validated above) -
          // same contract as SignupMode. This screen always ends in an ERP
          // workspace, so the ERP policy is the one being consented to.
          acceptedPolicy: 'erp' as const,
        };
        const res = await registerAction(payload);
        if (!res.ok) {
          setError(authErrMsg(res.errorCode, res.error));
          setLoading(false);
          return;
        }
        accessToken = res.data.accessToken;
        refreshToken = res.data.refreshToken;
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
        await syncAuthCookie(res.data.accessToken, res.data.refreshToken, res.data.platformAccess);
      } else {
        // OTP-register path - caller already populated AuthStore + cookies.
        const accessTok = (useAuthStore.getState().accessToken as string | null) ?? '';
        accessToken = accessTok;
        // OTP-register path: the user was already created by /auth/verify-otp
        // WITHOUT a policy stamp (legacy flow sends no acceptedPolicy), so
        // record the ERP consent ticked above via the me/erp-policy-accept
        // endpoint. Bearer fallback token bypasses the cookie-timing race
        // (same reason as the fetches below). Best-effort: on failure the
        // dashboard PolicyGate is the safety net, don't block the flow.
        // Skipped for hideAccountFields (setup-workspace page: existing users
        // who consented at signup - no checkbox is shown there).
        if (!hideAccountFields) {
          await acceptErpPolicy(accessToken).catch(() => undefined);
        }
      }

      const wsResponse = await fetch('/api/workspaces/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: vals.workspaceName,
          location: vals.location,
          businessType: vals.businessType,
          gstin: vals.gstin?.trim() || undefined,
          pan: vals.pan?.trim() || undefined,
          fyStartMonth: vals.fyStartMonth,
        }),
      });
      const wsResult = await wsResponse.json();
      if (!wsResult.ok) {
        setError(t('registerWorkspace.createFailed', { error: wsResult.error }));
        setLoading(false);
        return;
      }
      setWorkspaces([wsResult.data]);
      // Sync the freshly-flipped `hasWorkspace` flag into local store so the
      // DashboardLayout workspace-gate (`user.hasWorkspace !== false &&
      // workspaces.length > 0`) sees BOTH conditions met on the next render.
      // Without this, the BE-side flip is correct but the client still reads
      // the cached `false` from the register/verify-otp payload and bounces
      // the user right back to /auth/setup-workspace.
      updateUser({ hasWorkspace: true });

      // OTP-register path: optional password set inline. Direct fetch + Bearer
      // header (same pattern as workspace POST) - avoids the server-action
      // cookie-timing race. Best-effort: a failed set-password shouldn't
      // block dashboard entry; user can retry in Settings > Security.
      if (isOtpPath && !hideAccountFields && vals.password) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/users/set-password`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ newPassword: vals.password }),
          });
        } catch {
          // Swallow - non-blocking. Dashboard prompt will keep nudging.
        }
      }

      // OTP-register path: replace the placeholder name (e.g. "User 3210" set
      // by /auth/verify-otp) with the real one captured here. Direct fetch
      // with Bearer token (same pattern as the workspace POST above) avoids
      // a server-action / cookie-timing race where the freshly-written
      // httpOnly cookie hasn't reached the next server-action's request yet.
      // Best-effort - a transient profile-update failure shouldn't block the
      // user; they can fix it later in Settings.
      if (isOtpPath && !hideAccountFields && vals.name) {
        try {
          const profileRes = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/users/profile`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ name: vals.name.trim() }),
            },
          );
          const profileBody = (await profileRes.json()) as {
            success?: boolean;
            data?: { user?: { name?: string } };
          };
          const updatedName = profileBody?.data?.user?.name;
          const current = useAuthStore.getState();
          if (profileRes.ok && updatedName && current.user) {
            setAuth(
              { ...current.user, name: updatedName },
              current.accessToken ?? '',
              current.refreshToken ?? '',
            );
          }
        } catch {
          // Swallow - non-blocking.
        }
      }

      // OTP-register path: workspace + name done - flush the httpOnly auth
      // cookie so middleware lets the user into /dashboard. AuthClient
      // deferred this so the redirect-to-/dashboard didn't fire mid-flow.
      if (isOtpPath && refreshToken === undefined) {
        const stored = useAuthStore.getState();
        // OQ-1: the verify-otp server action already set the httpOnly refresh
        // cookie. Flush the access token (refresh token may be in-memory only or
        // already cookie-resident) so middleware unlocks /dashboard routing.
        if (stored.accessToken) {
          await syncAuthCookie(stored.accessToken, stored.refreshToken ?? undefined);
        }
      }

      // Hand back upstream so the orchestrator can routes-and-redirect. Pass
      // a minimal AuthResult shape that triggers doRedirect.
      await onAuthSuccess({
        accessToken: accessToken ?? '',
        refreshToken: refreshToken ?? '',
        user: useAuthStore.getState().user as never,
        isNewUser: true,
      } as never);
    } catch (e) {
      setError(parseApiError(e));
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setMode('register');
          setError('');
        }}
        className="mb-5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-body"
      >
        <ArrowLeftOutlined /> {backLabel ?? t('registerWorkspace.back')}
      </button>
      <h1 className="m-0 mb-1 font-display text-2xl font-extrabold text-heading">
        {t('registerWorkspace.title')}
      </h1>
      <p className="m-0 mb-6 text-[13px] text-muted">{t('registerWorkspace.subtitle')}</p>
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          className="mb-4 rounded-[10px]"
          closable={{ onClose: () => setError('') }}
        />
      )}
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        {isOtpPath && !hideAccountFields && (
          <>
            <Form.Item
              name="name"
              label={t('registerWorkspace.name.label')}
              rules={[
                { required: true, message: t('registerWorkspace.name.required') },
                { min: 2, message: t('registerWorkspace.name.minLength') },
              ]}
            >
              <Input
                prefix={<UserOutlined className="text-subtle" />}
                placeholder={t('registerWorkspace.name.placeholder')}
                size="large"
                autoFocus
                autoComplete="name"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label={t('registerWorkspace.password.label')}
              rules={[
                {
                  validator: (_, v) => {
                    if (!v) return Promise.resolve();
                    if (String(v).length < 8) {
                      return Promise.reject(new Error(t('registerWorkspace.password.minLength')));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
              extra={
                <span className="text-[11px] leading-relaxed text-subtle">
                  {t('registerWorkspace.password.helper')}
                </span>
              }
            >
              <PasswordInput placeholder={t('registerWorkspace.password.placeholder')} />
            </Form.Item>
          </>
        )}
        <Form.Item
          name="workspaceName"
          label={t('registerWorkspace.workspaceName.label')}
          rules={[
            { required: true, message: t('registerWorkspace.workspaceName.required') },
            { min: 2 },
          ]}
        >
          <Input
            prefix={<BankOutlined className="text-subtle" />}
            placeholder={t('registerWorkspace.workspaceName.placeholder')}
            size="large"
            autoFocus={!isOtpPath || hideAccountFields}
          />
        </Form.Item>
        <Form.Item name="location" label={t('registerWorkspace.location.label')}>
          <Input
            prefix={<MailOutlined className="text-subtle" />}
            placeholder={t('registerWorkspace.location.placeholder')}
            size="large"
          />
        </Form.Item>
        {/* Custom controlled disclosure as ONE bordered card containing the
            header button (top) + the expanded panel (bottom). Border-radius
            matches AntD's input radius (`rounded-lg` = 8px) so the disclosure
            sits in the same rhythm as Workspace Name and Location fields.
            When open, the panel attaches directly below the button with a
            divider line - visually one card, no gap. When closed, the
            button alone fills the card. */}
        <div
          className={`mt-2 mb-4 overflow-hidden rounded-lg border bg-surface transition ${
            businessOpen ? 'border-primary' : 'border-border'
          }`}
        >
          <button
            type="button"
            aria-expanded={businessOpen}
            aria-controls="register-business-panel"
            onClick={() => setBusinessOpen((o) => !o)}
            className="flex w-full cursor-pointer items-center gap-3 bg-transparent px-4 py-3 text-left transition focus-visible:outline-none"
          >
            <span
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full"
              style={{ background: 'var(--cr-primary-light)' }}
              aria-hidden
            >
              <BankOutlined style={{ fontSize: 16, color: 'var(--cr-primary)' }} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[12px] font-semibold tracking-[0.08em] text-heading uppercase">
                {t('registerWorkspace.businessDetails.headerLabel')}
              </span>
              <span className="mt-0.5 truncate text-[12px] font-normal text-muted">
                {t('registerWorkspace.businessDetails.headerHelper')}
              </span>
            </span>
            <span
              className="inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase"
              style={{
                background: 'var(--cr-wash-cream, var(--cr-surface-2))',
                color: 'var(--cr-text-4, var(--cr-text))',
              }}
            >
              {t('registerWorkspace.businessDetails.optionalPill')}
            </span>
            <RightOutlined
              aria-hidden
              className="flex-shrink-0 text-[12px] text-muted transition-transform"
              style={{
                transform: businessOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {businessOpen && (
            <div
              id="register-business-panel"
              className="border-t border-border-light px-4 pt-4 pb-2"
            >
              <>
                <p className="m-0 mb-3 text-[12px] leading-relaxed text-muted">
                  {t('registerWorkspace.businessDetails.subtitle')}
                </p>
                <Form.Item name="businessType" label={t('registerWorkspace.businessType.label')}>
                  <Select
                    placeholder={t('registerWorkspace.businessType.placeholder')}
                    size="large"
                    allowClear
                    options={[
                      {
                        value: 'trading',
                        label: t('registerWorkspace.businessType.options.trading'),
                      },
                      {
                        value: 'manufacturing',
                        label: t('registerWorkspace.businessType.options.manufacturing'),
                      },
                      {
                        value: 'service',
                        label: t('registerWorkspace.businessType.options.service'),
                      },
                      {
                        value: 'composition',
                        label: t('registerWorkspace.businessType.options.composition'),
                      },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="gstin"
                  label={t('registerWorkspace.gstin.label')}
                  rules={[
                    {
                      pattern: GSTIN_RE,
                      message: t('registerWorkspace.gstin.invalid'),
                    },
                  ]}
                >
                  <Input
                    placeholder="22AAAAA0000A1Z5"
                    size="large"
                    maxLength={15}
                    style={{ textTransform: 'uppercase' }}
                  />
                </Form.Item>
                <Form.Item
                  name="pan"
                  label={t('registerWorkspace.pan.label')}
                  rules={[
                    {
                      pattern: PAN_RE,
                      message: t('registerWorkspace.pan.invalid'),
                    },
                  ]}
                >
                  <Input
                    placeholder="ABCDE1234F"
                    size="large"
                    maxLength={10}
                    style={{ textTransform: 'uppercase' }}
                  />
                </Form.Item>
                <Form.Item
                  name="fyStartMonth"
                  label={
                    <span className="flex items-center gap-1.5">
                      {t('registerWorkspace.fyStartMonth.label')}
                      <InfoTooltip
                        text={t('registerWorkspace.fyStartMonth.tooltipText')}
                        iconClassName="text-[12px]"
                      />
                    </span>
                  }
                  initialValue={4}
                >
                  <InputNumber
                    min={1}
                    max={12}
                    size="large"
                    style={{ width: '100%' }}
                    placeholder={t('registerWorkspace.fyStartMonth.placeholder')}
                  />
                </Form.Item>
              </>
            </div>
          )}
        </div>
        {/* Owner-info note. Modernised: lucide-react Info icon (was a stock
            emoji ℹ️), `rounded-lg` to match the input + disclosure radius,
            tighter padding, primary-tinted border + wash background, body
            text-[12px] aligned with the other helper copy on this surface. */}
        <div
          className="mb-5 flex items-start gap-3 rounded-lg px-3.5 py-3"
          style={{
            background: 'var(--cr-primary-light)',
            border: '1px solid var(--cr-primary-border)',
          }}
        >
          <Info
            size={16}
            strokeWidth={2.25}
            aria-hidden
            className="mt-0.5 flex-shrink-0"
            style={{ color: 'var(--cr-primary)' }}
          />
          <p className="m-0 text-[12px] leading-relaxed text-body">
            {t('registerWorkspace.ownerNotePrefix')}{' '}
            <strong>{t('registerWorkspace.ownerNoteRole')}</strong>{' '}
            {t('registerWorkspace.ownerNoteSuffix')}
          </p>
        </div>
        {/* ERP T&C consent - mirrors SignupMode's policyErp checkbox so the
            legacy register flows (invite links, /auth?mode=register, OTP
            variant) record consent like the main signup does. Hidden on the
            setup-workspace page (hideAccountFields: user already consented at
            signup). Validated required; value read from `vals.policyAccepted`
            and stamped via acceptedPolicy / acceptErpPolicy in handleSubmit. */}
        {!hideAccountFields && (
          <Form.Item
            name="policyAccepted"
            valuePropName="checked"
            rules={[
              {
                validator: (_, v: boolean) =>
                  v ? Promise.resolve() : Promise.reject(new Error(t('signup.policyErp.required'))),
              },
            ]}
          >
            <Checkbox>
              {t.rich('signup.policyErp.label', {
                // Same canonical /terms target as SignupMode; new tab so the
                // half-filled form is preserved.
                terms: (chunks) => (
                  <a href="/terms" target="_blank" rel="noopener noreferrer">
                    {chunks}
                  </a>
                ),
              })}
            </Checkbox>
          </Form.Item>
        )}
        <Form.Item className="mb-0">
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            block
            className="h-[46px] font-semibold"
          >
            {t('registerWorkspace.submit')}
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}
