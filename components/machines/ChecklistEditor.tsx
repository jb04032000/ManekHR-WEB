'use client';

/**
 * ChecklistEditor - controlled list-of-strings editor for maintenance schedules.
 *
 * - Fully controlled: parent owns `value`, receives every change via `onChange`.
 * - Reorder via up/down arrow buttons (no drag-lib dependency - keeps bundle lean).
 * - Cap of 50 items per D-01 (max 50, each ≤200 chars).
 * - All copy via `useTranslations('machines-maintenance').schedule`.
 */

import { Input, Button, Tooltip } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';

import { DsButton } from '@/components/ui';

interface ChecklistEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}

const DEFAULT_MAX = 50;
const ITEM_MAX_LEN = 200;

export function ChecklistEditor({ value, onChange, max = DEFAULT_MAX }: ChecklistEditorProps) {
  const t = useTranslations('machines-maintenance');

  const setItem = (idx: number, next: string) => {
    const copy = [...value];
    copy[idx] = next;
    onChange(copy);
  };

  const removeItem = (idx: number) => {
    const copy = [...value];
    copy.splice(idx, 1);
    onChange(copy);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const copy = [...value];
    const tmp = copy[idx];
    copy[idx] = copy[target];
    copy[target] = tmp;
    onChange(copy);
  };

  const addItem = () => {
    if (value.length >= max) return;
    onChange([...value, '']);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.length === 0 && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--cr-text-3, var(--cr-text-5))',
            padding: '8px 0',
          }}
        >
          {t('schedule.checklist')} - {/* Use the add label as inline empty hint */}
          <span>{t('schedule.checklistAdd')}</span>
        </div>
      )}
      {value.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 11,
              width: 22,
              textAlign: 'right',
              color: 'var(--cr-text-3, var(--cr-text-5))',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {idx + 1}.
          </span>
          <Input
            value={item}
            maxLength={ITEM_MAX_LEN}
            onChange={(e) => setItem(idx, e.target.value)}
          />
          <Tooltip title="Move up">
            <Button
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={idx === 0}
              onClick={() => moveItem(idx, -1)}
            />
          </Tooltip>
          <Tooltip title="Move down">
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={idx === value.length - 1}
              onClick={() => moveItem(idx, 1)}
            />
          </Tooltip>
          <Button
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => removeItem(idx)}
            style={{ color: 'var(--cr-error)' }}
            aria-label="Remove checklist item"
          />
        </div>
      ))}
      <div>
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          icon={<PlusOutlined />}
          disabled={value.length >= max}
          onClick={addItem}
        >
          {t('schedule.checklistAdd')}
          {value.length >= max ? ` (${max})` : ''}
        </DsButton>
      </div>
    </div>
  );
}

export default ChecklistEditor;
