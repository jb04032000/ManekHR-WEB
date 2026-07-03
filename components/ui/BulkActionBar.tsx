'use client';

import { useState, ReactNode } from 'react';
import { App, Button, Space, Tooltip } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { Key } from 'antd/es/table/interface';

export type SelectionMode = 'empty' | 'all-active' | 'all-inactive' | 'all-archived' | 'mixed';

export interface BulkAction {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  confirmTitle?: string | (() => string);
  confirmDescription?: string | (() => string);
  enabledFor?: SelectionMode[];
  disabledTooltip?: string;
  onClick: () => void | Promise<void>;
}

export interface BulkActionBarProps {
  selectedCount: number;
  selectionMode: SelectionMode;
  actions: BulkAction[];
  onClearSelection: () => void;
  loading?: boolean;
}

const resolveString = (v?: string | (() => string)): string | undefined =>
  typeof v === 'function' ? v() : v;

export function BulkActionBar({
  selectedCount,
  selectionMode,
  actions,
  onClearSelection,
  loading = false,
}: BulkActionBarProps) {
  const { modal } = App.useApp();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (selectedCount === 0) return null;

  const handleActionClick = async (action: BulkAction) => {
    const title = resolveString(action.confirmTitle);
    const description = resolveString(action.confirmDescription);

    if (title) {
      return new Promise<void>((resolve) => {
        modal.confirm({
          title,
          icon: <ExclamationCircleOutlined />,
          content: description,
          okText: action.danger ? 'Delete' : 'Confirm',
          okButtonProps: { danger: action.danger },
          onOk: async () => {
            setActionLoading(action.key);
            try {
              await action.onClick();
              onClearSelection();
            } finally {
              setActionLoading(null);
            }
            resolve();
          },
          onCancel: () => resolve(),
        });
      });
    }

    setActionLoading(action.key);
    try {
      await action.onClick();
      onClearSelection();
    } finally {
      setActionLoading(null);
    }
  };

  const isActionEnabled = (action: BulkAction): boolean => {
    if (loading || actionLoading !== null) return false;
    if (!action.enabledFor) return true;
    return action.enabledFor.includes(selectionMode);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 mb-4 bg-white border rounded-lg shadow-sm">
      <Space>
        <span className="font-medium text-gray-700">
          {selectedCount} selected
        </span>
        <Button
          type="link"
          size="small"
          onClick={onClearSelection}
          disabled={loading || actionLoading !== null}
        >
          Clear
        </Button>
      </Space>
      <Space>
        {actions.map((action) => {
          const enabled = isActionEnabled(action);
          const isLoading = actionLoading === action.key;

          if (!enabled && action.disabledTooltip) {
            return (
              <Tooltip key={action.key} title={action.disabledTooltip}>
                <Button
                  icon={action.icon}
                  disabled
                  danger={action.danger}
                >
                  {action.label}
                </Button>
              </Tooltip>
            );
          }

          return (
            <Button
              key={action.key}
              icon={action.icon}
              onClick={() => handleActionClick(action)}
              disabled={!enabled}
              danger={action.danger}
              loading={isLoading}
            >
              {action.label}
            </Button>
          );
        })}
      </Space>
    </div>
  );
}