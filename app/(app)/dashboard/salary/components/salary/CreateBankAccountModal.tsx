'use client';

import { Modal, Input, Button } from 'antd';

interface CreateBankAccountModalProps {
  open: boolean;
  value: string;
  loading: boolean;
  existingAccounts: Array<{ label: string }>;
  onClose: () => void;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

export function CreateBankAccountModal({
  open,
  value,
  loading,
  existingAccounts,
  onClose,
  onChange,
  onSubmit,
}: CreateBankAccountModalProps) {
  const isDuplicate = value.trim()
    ? existingAccounts.some((a) => a.label.toLowerCase() === value.trim().toLowerCase())
    : false;

  return (
    <Modal open={open} onCancel={onClose} title="Add Bank Account" footer={null} width={400}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
            Bank Account Name <span className="text-red-700">*</span>
          </label>
          <Input
            placeholder="e.g. Main Account, Petty Cash"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPressEnter={onSubmit}
            maxLength={50}
            autoFocus
          />
          {isDuplicate && (
            <p className="m-0 mt-1 text-[12px] text-red-700">This bank account already exists</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            loading={loading}
            onClick={onSubmit}
            disabled={!value.trim() || isDuplicate}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}
