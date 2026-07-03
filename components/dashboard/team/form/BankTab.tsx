'use client';
import { Form, Input, Select, Radio, Switch, Tooltip, type FormInstance } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { FileUpload } from '@/components/ui';

const { Option } = Select;

interface BankTabProps {
  form: FormInstance;
  mode: 'view' | 'add' | 'edit';
  editMode: boolean;
}

export default function BankTab({ form, mode, editMode }: BankTabProps) {
  const t = useTranslations('team');
  const isSameAsEmployeeName = Form.useWatch('isSameAsEmployeeName', form);
  const accountNumber = Form.useWatch('accountNumber', form);
  const passbookImageUrl = Form.useWatch('passbookImageUrl', form) as string | undefined;
  const preferredMethod = Form.useWatch('preferredMethod', form) as
    | 'BANK'
    | 'UPI'
    | 'CASH'
    | undefined;
  const bankRequired = preferredMethod === 'BANK';
  const upiRequired = preferredMethod === 'UPI';

  return (
    <>
      {mode === 'add' && (
        <>
          <div className="mb-3 border-b border-gray-100 pb-2.5">
            <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
              {t('bankPreferredMethodLabel')}
            </p>
            <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
              {t('bankPreferredMethodHelper')}
            </p>
          </div>
          <Form.Item name="preferredMethod" className="mb-6">
            <Radio.Group className="flex flex-wrap gap-3">
              <Radio.Button value="BANK">{t('bankMethodOptionBank')}</Radio.Button>
              <Radio.Button value="UPI">{t('bankMethodOptionUpi')}</Radio.Button>
              <Radio.Button value="CASH">{t('bankMethodOptionCash')}</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </>
      )}

      <div className="mt-0 mb-4 border-b border-gray-100 pb-2.5">
        <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
          {t('bankDetailsTitle')}
        </p>
        <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
          {t('bankDetailsHelper')}
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="mb-0 flex flex-col">
            <div className="mb-1.5 flex min-h-[24px] items-center">
              <span className="text-sm font-medium text-gray-600">
                {t('bankNameLabel')}
                {bankRequired && <span className="ml-1 text-[var(--cr-text-3)]">*</span>}
              </span>
            </div>
            <Form.Item
              name="bankName"
              className="mb-0"
              noStyle
              rules={
                bankRequired ? [{ required: true, message: t('bankNameRequired') }] : undefined
              }
            >
              <Input placeholder={t('bankNamePlaceholder')} className="h-10 rounded-lg" />
            </Form.Item>
          </div>

          <div className="mb-0 flex flex-col">
            <div className="mb-1.5 flex min-h-[24px] w-full items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                {t('bankAccountHolderLabel')}
                {bankRequired && <span className="ml-1 text-[var(--cr-text-3)]">*</span>}
              </span>
              <div className="flex items-center gap-2">
                <Form.Item name="isSameAsEmployeeName" valuePropName="checked" noStyle>
                  <Switch
                    size="small"
                    disabled={!editMode}
                    aria-label={t('bankSameAsEmployeeLabel')}
                  />
                </Form.Item>
                <span className="flex items-center gap-1 text-xs font-normal text-gray-600">
                  {t('bankSameAsEmployeeLabel')}
                  <Tooltip
                    placement="topLeft"
                    styles={{ root: { maxWidth: 280 } }}
                    trigger={['hover', 'click', 'focus']}
                    title={t('bankSameAsEmployeeTooltip')}
                  >
                    <InfoCircleOutlined
                      className="cursor-help text-xs text-[var(--cr-text-4)]"
                      aria-label={t('bankSameAsEmployeeIconAria')}
                    />
                  </Tooltip>
                </span>
              </div>
            </div>
            <Form.Item
              name="accountHolderName"
              className="mb-0"
              noStyle
              rules={
                bankRequired
                  ? [{ required: true, message: t('bankAccountHolderRequired') }]
                  : undefined
              }
            >
              <Input
                placeholder={t('bankAccountHolderPlaceholder')}
                disabled={!editMode || isSameAsEmployeeName}
                className="h-10 rounded-lg"
              />
            </Form.Item>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="accountNumber"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('bankAccountNumberLabel')}
                {bankRequired && <span className="ml-1 text-[var(--cr-text-3)]">*</span>}
              </span>
            }
            extra={
              <span className="text-xs text-[var(--cr-text-4)]">{t('bankAccountNumberExtra')}</span>
            }
            className="mb-0"
            rules={[
              {
                validator: (_, value) => {
                  const trimmed = value?.toString().trim() ?? '';
                  if (trimmed === '') {
                    if (bankRequired) return Promise.reject(t('bankAccountNumberRequired'));
                    return Promise.resolve();
                  }
                  if (!/^[0-9]{9,18}$/.test(trimmed.replace(/\s/g, '')))
                    return Promise.reject(t('bankAccountNumberInvalid'));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input
              placeholder={t('bankAccountNumberPlaceholder')}
              className="h-10 rounded-lg tabular-nums"
            />
          </Form.Item>

          <Form.Item
            name="confirmAccountNumber"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('bankConfirmAccountLabel')}
                {bankRequired && <span className="ml-1 text-[var(--cr-text-3)]">*</span>}
              </span>
            }
            extra={
              <span className="text-xs text-[var(--cr-text-4)]">
                {t('bankConfirmAccountExtra')}
              </span>
            }
            className="mb-0"
            dependencies={['accountNumber']}
            rules={[
              {
                validator: (_, value) => {
                  const trimmed = value?.toString().trim() ?? '';
                  if (trimmed === '') {
                    if (bankRequired) return Promise.reject(t('bankConfirmAccountRequired'));
                    return Promise.resolve();
                  }
                  if (!accountNumber || value !== accountNumber)
                    return Promise.reject(t('bankConfirmAccountMismatch'));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input
              placeholder={t('bankConfirmAccountPlaceholder')}
              className="h-10 rounded-lg tabular-nums"
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="ifscCode"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('bankIfscLabel')}
                {bankRequired && <span className="ml-1 text-[var(--cr-text-3)]">*</span>}
              </span>
            }
            extra={<span className="text-xs text-[var(--cr-text-4)]">{t('bankIfscExtra')}</span>}
            className="mb-0"
            rules={[
              {
                validator: (_, value) => {
                  const trimmed = value?.toString().trim() ?? '';
                  if (trimmed === '') {
                    if (bankRequired) return Promise.reject(t('bankIfscRequired'));
                    return Promise.resolve();
                  }
                  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(trimmed.toUpperCase()))
                    return Promise.reject(t('bankIfscInvalid'));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input
              placeholder={t('bankIfscPlaceholder')}
              className="h-10 rounded-lg tabular-nums"
            />
          </Form.Item>

          <Form.Item
            name="upiId"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('bankUpiIdLabel')}
                {upiRequired && <span className="ml-1 text-[var(--cr-text-3)]">*</span>}
              </span>
            }
            extra={<span className="text-xs text-[var(--cr-text-4)]">{t('bankUpiIdExtra')}</span>}
            className="mb-0"
            rules={[
              {
                validator: (_, value) => {
                  const trimmed = value?.toString().trim() ?? '';
                  if (trimmed === '') {
                    if (upiRequired) return Promise.reject(t('bankUpiIdRequired'));
                    return Promise.resolve();
                  }
                  if (!/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/.test(trimmed))
                    return Promise.reject(t('bankUpiIdInvalid'));
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder={t('bankUpiIdPlaceholder')} className="h-10 rounded-lg" />
          </Form.Item>
        </div>

        {mode === 'add' ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--cr-info-200,#bfdbfe)] bg-[var(--cr-info-50,#eff6ff)] px-3 py-2.5 text-sm text-[var(--cr-info-700,#1d4ed8)]">
            <InfoCircleOutlined className="text-sm" />
            <span>{t('bankPassbookHintBefore')}</span>
            <span className="font-medium">{t('bankPassbookHintLink')}</span>
          </div>
        ) : passbookImageUrl ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-600">{t('bankPassbookLabel')}</span>
            <a
              href={passbookImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-700 underline underline-offset-2 hover:text-blue-800"
            >
              {t('bankPassbookViewLink')}
            </a>
          </div>
        ) : null}
      </div>

      <hr className="mt-1 border-gray-100" />
      <div className="mb-3 border-b border-gray-100 pb-2.5">
        <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
          {t('bankQrCodeTitle')}
        </p>
        <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
          {t('bankQrCodeHelper')}
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <Form.Item
          name="qrCodeUrl"
          label={
            <span className="mb-1.5 block text-sm font-medium text-gray-600">
              {t('bankQrCodeLabel')}
            </span>
          }
          getValueFromEvent={(url) => url}
        >
          <FileUpload category="qrcodes" disabled={!editMode} />
        </Form.Item>
      </div>

      {mode !== 'add' && (
        <div className="flex flex-col gap-4">
          <hr className="mt-1 border-gray-100" />
          <Form.Item
            name="preferredMethod"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('bankPreferredMethodLabel')}
              </span>
            }
            style={{ maxInlineSize: '480px' }}
          >
            <Select
              allowClear
              placeholder={t('bankPreferredMethodPlaceholder')}
              className="rounded-lg"
            >
              <Option value="BANK">{t('bankMethodOptionBank')}</Option>
              <Option value="UPI">{t('bankMethodOptionUpi')}</Option>
              <Option value="CASH">{t('bankMethodOptionCash')}</Option>
            </Select>
          </Form.Item>
        </div>
      )}
    </>
  );
}
