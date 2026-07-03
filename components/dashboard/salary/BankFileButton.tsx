'use client';

import { useState } from 'react';
import { Button } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import { BankFileModal } from './BankFileModal';

interface BankFileButtonProps {
  wsId: string;
  month: number;
  year: number;
  disabled?: boolean;
}

export function BankFileButton({ wsId, month, year, disabled }: BankFileButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        icon={<BankOutlined />}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Bank Transfer File
      </Button>
      {open && (
        <BankFileModal
          open={open}
          onClose={() => setOpen(false)}
          wsId={wsId}
          defaultMonth={month}
          defaultYear={year}
        />
      )}
    </>
  );
}
