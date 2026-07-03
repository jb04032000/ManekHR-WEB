'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Form, Input, Button, message, Alert, Row, Col } from 'antd';
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useAuthStore } from '@/lib/store';
import { changePassword, setPassword, changePasswordAfterForgot } from '@/lib/actions';
import AppLockPinSection from '@/components/auth/AppLockPinSection';
import { parseApiError } from '@/lib/utils';
import { SectionHeader } from '@/components/settings/SectionHeader';
import { SectionCard } from '@/components/settings/SectionCard';
// DPDP self-serve deletion danger zones (Connect / ERP / whole account). See
// ACCOUNT-DELETION-AND-DPDP-PLAN.md §7. Sits at the bottom of account security.
import { AccountSecurityDeletionSection } from '@/components/account-deletion/AccountSecurityDeletionSection';

export default function SecuritySettingsPage() {
  const t = useTranslations('profile');
  const { user, setAuth, updateUser } = useAuthStore();
  const passwordCardRef = useRef<HTMLDivElement | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [pwForm] = Form.useForm();

  // Auto-scroll the password card into view when the route lands here with a
  // `#password` anchor - used by the SMS-OTP forgot-password redirect and the
  // passive PasswordSetupPrompt CTA. Runs once after first paint.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#password') return;
    const tid = window.setTimeout(() => {
      passwordCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(tid);
  }, []);

  const handlePassword = async (vals: {
    current?: string;
    newPassword: string;
    confirm: string;
  }) => {
    if (vals.newPassword !== vals.confirm) {
      msgApi.error(t('passwordsMismatch'));
      return;
    }
    setPwSaving(true);
    try {
      if (user?.forgotPasswordReset) {
        // OQ-1: no localStorage refresh token — the server action reads the
        // httpOnly refresh cookie to denylist the old pair.
        const res = await changePasswordAfterForgot({
          newPassword: vals.newPassword,
        });
        if (!res.ok) {
          msgApi.error(res.error);
          return;
        }
        setAuth(
          { ...res.data.user, forgotPasswordReset: false, hasPassword: true },
          res.data.accessToken,
          res.data.refreshToken,
        );
      } else if (user?.hasPassword) {
        await changePassword(vals.current ?? '', vals.newPassword);
      } else {
        await setPassword(vals.newPassword);
        // Reflect the new credential locally so the "add a password" nudge
        // (PasswordSetupPrompt) hides and the card switches to change-password
        // mode immediately, without a reload. Previously only the forgot-reset
        // branch updated the store, so the OTP-only banner lingered after a
        // first password was set.
        updateUser({ hasPassword: true });
      }
      msgApi.success(t('passwordUpdated'));
      pwForm.resetFields();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setPwSaving(false);
    }
  };

  const passwordTitle =
    user?.hasPassword && !user?.forgotPasswordReset ? t('changePassword') : t('setPassword');
  const passwordCtaLabel =
    user?.hasPassword && !user?.forgotPasswordReset ? t('updatePassword') : t('setPassword');

  return (
    <>
      {ctx}
      <SectionHeader title={t('section.security.title')} description={t('section.security.desc')} />

      <div ref={passwordCardRef} id="password" className="mb-6" style={{ scrollMarginTop: 24 }}>
        <SectionCard title={passwordTitle} description={t('section.password.desc')}>
          {user?.forgotPasswordReset && (
            <Alert
              type="info"
              title={t('forgotResetBannerTitle')}
              description={t('forgotResetBannerBody')}
              showIcon
              icon={<LockOutlined />}
              className="mb-4 rounded-[10px]"
            />
          )}
          {!user?.hasPassword && !user?.forgotPasswordReset && (
            <Alert
              type="info"
              title={t('googleSignupAlert')}
              showIcon
              className="mb-4 rounded-[10px]"
            />
          )}
          <Form form={pwForm} layout="vertical" onFinish={handlePassword} requiredMark={false}>
            {user?.hasPassword && !user?.forgotPasswordReset && (
              <Form.Item name="current" label={t('currentPassword')} rules={[{ required: true }]}>
                <Input.Password
                  size="large"
                  prefix={<LockOutlined />}
                  placeholder={t('currentPasswordPlaceholder')}
                  iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>
            )}
            <Row gutter={12}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="newPassword"
                  label={t('newPassword')}
                  rules={[{ required: true }, { min: 8 }]}
                >
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder={t('minChars')}
                    iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="confirm" label={t('confirmPassword')} rules={[{ required: true }]}>
                  <Input.Password
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder={t('repeatPassword')}
                    iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Button
              type="primary"
              htmlType="submit"
              loading={pwSaving}
              size="large"
              icon={<LockOutlined />}
              className="w-fit"
            >
              {passwordCtaLabel}
            </Button>
          </Form>
        </SectionCard>
      </div>

      <AppLockPinSection />

      <div className="mt-8">
        <AccountSecurityDeletionSection />
      </div>
    </>
  );
}
