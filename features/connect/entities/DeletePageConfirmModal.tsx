'use client';

/**
 * DeletePageConfirmModal - type-to-confirm guard for deleting a company page.
 *
 * Deleting a page is irreversible (drops the page + its public address), so we
 * gate it behind the GitHub/Vercel "type the exact name to confirm" pattern:
 * the Delete button stays disabled until the typed text matches the page name
 * exactly. Used by ManageCompanyPageScreen for BOTH delete entry points (the
 * Settings tab "Delete page" button and the header More-menu Delete) so the
 * destructive action has one consistent, strong confirmation everywhere.
 *
 * Links to: ManageCompanyPageScreen (owns `open`/`deleting` state + the actual
 * deleteCompanyPage call via onConfirm) and CompanyPageManageHeader (its
 * More-menu Delete just requests open via the same state).
 */

import { useState } from 'react';
import { Input, Modal } from 'antd';
import { useTranslations } from 'next-intl';

interface Props {
  open: boolean;
  /** The exact page name the user must retype to enable deletion. */
  pageName: string;
  /** Deletion in flight - drives the OK button spinner. */
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeletePageConfirmModal({
  open,
  pageName,
  deleting,
  onCancel,
  onConfirm,
}: Props) {
  const t = useTranslations('connect.companyPageAdmin');
  const [typed, setTyped] = useState('');

  // Exact match (trimmed) - mirrors the page name shown in the prompt. Case and
  // spacing must match so the confirmation is deliberate, not a near-miss.
  const matches = typed.trim() === pageName.trim();

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={t('deleteConfirmTitle')}
      okText={t('deleteConfirmOk')}
      okButtonProps={{ danger: true, loading: deleting, disabled: !matches }}
      cancelText={t('cancel')}
      onOk={onConfirm}
      // Clear the field after the close animation so a previous attempt's text
      // never carries over and pre-arms the Delete button on reopen.
      afterClose={() => setTyped('')}
      destroyOnHidden
      centered
    >
      <p className="m-0 text-[13.5px]" style={{ color: 'var(--cr-text-3)' }}>
        {t('deleteConfirmBody')}
      </p>
      <p className="mt-3 mb-1.5 text-[13px]" style={{ color: 'var(--cr-text-2)' }}>
        {t.rich('deleteConfirmPrompt', {
          name: () => <b style={{ color: 'var(--cr-text)' }}>{pageName}</b>,
        })}
      </p>
      <Input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={t('deleteConfirmPlaceholder')}
        aria-label={t('deleteConfirmPlaceholder')}
        autoFocus
        // Enter submits, but only once the name matches - so a stray Enter on an
        // empty/mismatched field can never trigger the irreversible delete.
        onPressEnter={() => {
          if (matches && !deleting) onConfirm();
        }}
        status={typed.length > 0 && !matches ? 'error' : undefined}
      />
    </Modal>
  );
}
