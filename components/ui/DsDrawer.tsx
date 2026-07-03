'use client';

import { ReactNode } from 'react';
import { Drawer, Button } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

interface DsDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  onOk?: () => void;
  okText?: string;
  okLoading?: boolean;
  cancelText?: string;
  cancelDisabled?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  closable?: boolean;
}

export default function DsDrawer({
  open,
  onClose,
  title,
  subtitle,
  extra,
  onOk,
  okText = 'Save',
  okLoading = false,
  cancelText = 'Cancel',
  cancelDisabled = false,
  footer,
  children,
  closable = true,
}: DsDrawerProps) {
  const renderFooter = () => {
    if (footer) return footer;
    if (!onOk) return null;
    return (
      <>
        <Button onClick={onClose} disabled={cancelDisabled}>
          {cancelText}
        </Button>
        <Button type="primary" icon={<SaveOutlined />} loading={okLoading} onClick={onOk}>
          {okText}
        </Button>
      </>
    );
  };

  const footerContent = renderFooter();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      closable={false}
      size="large"
      placement="right"
      styles={{
        body: { padding: 0 },
        header: { display: 'none' },
        wrapper: { zIndex: 1050 },
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            backgroundColor: 'var(--cr-surface)',
            paddingBottom: '20px',
            borderBottom: '1px solid var(--cr-border)',
            zIndex: 50,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {closable && (
                <Button
                  type="text"
                  onClick={onClose}
                  icon={<CloseOutlined />}
                  className="flex h-8 w-8 items-center justify-center !p-0"
                />
              )}
              <div>
                <h2 className="m-0 font-display text-[17px] font-bold text-gray-900">{title}</h2>
                {subtitle && <p className="m-0 text-xs font-normal text-gray-700">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">{extra}</div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{children}</div>

        {/* Footer */}
        {footerContent && (
          <div
            style={{
              flexShrink: 0,
              backgroundColor: 'var(--cr-surface)',
              paddingTop: '15px',
              borderTop: '1px solid var(--cr-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
            }}
          >
            {footerContent}
          </div>
        )}
      </div>
    </Drawer>
  );
}
