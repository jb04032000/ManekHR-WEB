'use client';

import { Button } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { BaseModeProps } from './types';

/**
 * Email-only confirmation step. The mobile path skips this screen entirely
 * (forgot-via-mobile fires sendOtp inline and routes straight to OtpVerifyMode),
 * so copy can address the email recipient directly. Identifier is echoed back
 * to the user for trust without confirming account existence (anti-enumeration
 * protection lives on the BE - same generic 200 response whether or not the
 * email matches a known account).
 */
export function ResetSentMode({ setMode, identifier, setIdentifier }: BaseModeProps) {
  const t = useTranslations('auth');
  const trimmedEmail = identifier.trim();
  const hasEmail = trimmedEmail.length > 0;

  return (
    <div className="py-2">
      <div className="mb-5 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <MailOutlined className="text-2xl text-primary" />
        </div>
      </div>
      <h2 className="m-0 mb-2 text-center font-display text-[22px] font-extrabold text-heading">
        {t('resetSent.title')}
      </h2>
      <p className="m-0 mb-6 text-center text-sm leading-relaxed text-muted">
        {hasEmail
          ? t.rich('resetSent.subtitle', {
              email: trimmedEmail,
              strong: (chunks) => <strong className="text-heading">{chunks}</strong>,
            })
          : t('resetSent.subtitleNoIdentifier')}
      </p>
      <div className="mb-6 rounded-[10px] border border-border bg-page px-4 py-3">
        <p className="m-0 mb-1 text-[13px] font-semibold text-heading">{t('resetSent.tipTitle')}</p>
        <p className="m-0 text-[12px] leading-relaxed text-muted">{t('resetSent.tipBody')}</p>
      </div>
      <Button
        type="primary"
        block
        size="large"
        onClick={() => setMode('login')}
        className="mb-3 h-[46px] font-semibold"
      >
        {t('resetSent.submit')}
      </Button>
      <Button
        type="default"
        block
        size="large"
        onClick={() => {
          // Clear so ForgotMode opens with an editable input. Carry-over
          // identifier would lock the field (intentional protection in the
          // first-time forgot path), but here the user explicitly asked for a
          // different one.
          setIdentifier('');
          setMode('check');
        }}
        className="h-[46px] font-medium"
      >
        {t('resetSent.resend')}
      </Button>
    </div>
  );
}
