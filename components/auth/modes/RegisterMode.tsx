'use client';

import { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { ArrowLeftOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { InfoTooltip } from '@/components/ui';
import type { BaseModeProps } from './types';

interface RegisterModeProps extends BaseModeProps {
  onProceedToWorkspace: (data: { name: string; password: string }) => void;
}

export function RegisterMode({
  setMode,
  identifier,
  setIdentifier,
  onProceedToWorkspace,
}: RegisterModeProps) {
  const t = useTranslations('auth');
  const [form] = Form.useForm();
  const [error, setError] = useState('');

  const handleSubmit = (vals: { name: string; password: string; confirm: string }) => {
    if (vals.password !== vals.confirm) {
      setError(t('register.confirm.mismatch'));
      return;
    }
    setError('');
    onProceedToWorkspace({ name: vals.name, password: vals.password });
  };

  return (
    <>
      <button
        onClick={() => {
          setMode('check');
          setError('');
          setIdentifier('');
          form.resetFields();
        }}
        className="mb-5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-body"
      >
        <ArrowLeftOutlined /> {t('register.back')}
      </button>
      <h1 className="m-0 mb-1 font-display text-2xl font-extrabold text-heading">
        {t('register.title')}
      </h1>
      <p className="m-0 mb-1 text-[13px] text-muted">{t('register.subtitle')}</p>
      <p className="m-0 mb-3 text-[13px] text-muted">
        {t('register.creatingFor')} <strong className="text-primary">{identifier}</strong>
      </p>
      <Alert
        type="info"
        title={
          <span className="text-[12px]">
            {t('register.noAccountFound')} <strong>{identifier}</strong>
            {t('register.noAccountFoundSuffix')}{' '}
            <button
              type="button"
              onClick={() => {
                setMode('check');
                setError('');
                setIdentifier('');
                form.resetFields();
              }}
              className="cursor-pointer border-none bg-transparent p-0 font-semibold text-primary hover:underline"
            >
              {t('register.tryDifferent')}
            </button>
            .
          </span>
        }
        showIcon
        className="mb-4 rounded-[10px]"
      />
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
        <Form.Item
          name="name"
          label={t('register.name.label')}
          rules={[
            { required: true, message: t('register.name.required') },
            { min: 2, message: t('register.name.minLength') },
          ]}
        >
          <Input
            prefix={<UserOutlined className="text-subtle" />}
            placeholder={t('register.name.placeholder')}
            size="large"
            autoFocus
            autoComplete="name"
          />
        </Form.Item>
        <Form.Item
          name="password"
          label={
            <span className="flex items-center gap-1.5">
              {t('register.password.label')}
              <InfoTooltip text={t('register.password.tooltipText')} iconClassName="text-[12px]" />
            </span>
          }
          rules={[
            { required: true, message: t('register.password.required') },
            { min: 8, message: t('register.password.minLength') },
          ]}
        >
          <PasswordInput placeholder={t('register.password.placeholder')} />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={t('register.confirm.label')}
          rules={[
            { required: true, message: t('register.confirm.required') },
            ({ getFieldValue }) => ({
              validator(_, v) {
                return !v || getFieldValue('password') === v
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('register.confirm.mismatch')));
              },
            }),
          ]}
        >
          <PasswordInput placeholder={t('register.confirm.placeholder')} />
        </Form.Item>
        <Form.Item className="mb-0">
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            className="h-[46px] font-semibold"
          >
            {t('register.submit')}
          </Button>
        </Form.Item>
      </Form>
      <p className="mt-4 mb-0 text-center text-[13px] text-muted">
        {t('register.alreadyHaveAccount')}{' '}
        <button
          onClick={() => {
            setMode('check');
            setError('');
          }}
          className="cursor-pointer border-none bg-transparent text-[13px] font-semibold text-primary hover:underline"
        >
          {t('register.signInLink')}
        </button>
      </p>
      <p className="mt-2 mb-0 text-center text-[11px] text-subtle">{t('register.terms')}</p>
    </>
  );
}
