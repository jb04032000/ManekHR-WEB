'use client';
import { useState } from 'react';
import { App, Modal, Input, Button } from 'antd';
import { useTranslations } from 'next-intl';
import { addDesignation } from '@/lib/actions/workspaces.actions';

interface CreateDesignationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (designation: string) => void;
  workspaceId: string;
  existingDesignations: string[];
}

export default function CreateDesignationModal({
  open,
  onClose,
  onCreated,
  workspaceId,
  existingDesignations,
}: CreateDesignationModalProps) {
  const t = useTranslations('team');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const { message: msgApi } = App.useApp();

  const trimmed = value.trim();
  const isDuplicate =
    !!trimmed && existingDesignations.some((d) => d.toLowerCase() === trimmed.toLowerCase());

  const handleClose = () => {
    setValue('');
    onClose();
  };

  const handleCreate = async () => {
    if (!trimmed || isDuplicate || !workspaceId) return;
    setSaving(true);
    try {
      // F3 (2026-05-14): use dedicated sub-resource endpoint instead of the
      // bulk workspace PATCH. Emits `workspace.designation_added` audit event
      // and matches the F1/F2 record shape (single canonical-en label; UI
      // falls back to en for other locales since custom user input is not
      // translated per owner constraint).
      const res = await addDesignation(workspaceId, {
        canonical: trimmed,
        isPreset: false,
        labels: { en: trimmed },
      });
      if (res.ok) {
        msgApi.success(t('createDesignationSuccess'));
        onCreated(trimmed);
        setValue('');
      } else {
        msgApi.error(res.error || t('createDesignationFailure'));
      }
    } catch {
      msgApi.error(t('createDesignationFailure'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={t('createDesignationTitle')}
      footer={null}
      width={400}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
            {t('createDesignationLabel')} <span className="text-red-700">*</span>
          </label>
          <Input
            placeholder={t('createDesignationPlaceholder')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onPressEnter={handleCreate}
            maxLength={40}
            autoFocus
          />
          {isDuplicate && (
            <p className="m-0 mt-1 text-[12px] text-red-700">{t('createDesignationDuplicate')}</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={handleClose}>{t('createDesignationCancel')}</Button>
          <Button
            type="primary"
            loading={saving}
            onClick={handleCreate}
            disabled={!trimmed || isDuplicate}
          >
            {t('createDesignationCreate')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
