'use client';

import { Modal, ModalProps } from 'antd';
import { ReactNode } from 'react';

export interface DsModalProps extends ModalProps {
  children: ReactNode;
  scrollable?: boolean;
  scrollHeight?: string;
  footer?: ReactNode | null;
}

export function DsModal({
  children,
  scrollable = true,
  scrollHeight = 'calc(100vh - 200px)',
  footer,
  width = 520,
  centered = true,
  styles: customStyles,
  ...props
}: DsModalProps) {
  return (
    <Modal
      {...props}
      width={width}
      centered={centered}
      footer={footer}
      styles={{
        body: scrollable
          ? {
              maxHeight: scrollHeight,
              overflowY: 'auto',
              padding: '24px',
            }
          : { padding: '24px' },
        ...customStyles,
      }}
    >
      {children}
    </Modal>
  );
}
