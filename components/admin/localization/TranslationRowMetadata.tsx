'use client';
import { useState } from 'react';
import { Button, Input, Space, Tag } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';

export type TranslationMetadata = {
  description?: string;
  screen?: string;
  feature?: string;
  componentRef?: string;
  tags?: string[];
};

type Props = {
  initial: TranslationMetadata;
  saving?: boolean;
  onSave: (next: TranslationMetadata) => void;
  onCancel: () => void;
};

export function TranslationRowMetadataEditor({ initial, saving, onSave, onCancel }: Props) {
  const [description, setDescription] = useState(initial.description ?? '');
  const [screen, setScreen] = useState(initial.screen ?? '');
  const [feature, setFeature] = useState(initial.feature ?? '');
  const [componentRef, setComponentRef] = useState(initial.componentRef ?? '');
  const [tagsInput, setTagsInput] = useState((initial.tags ?? []).join(', '));

  const submit = () => {
    onSave({
      description: description.trim() || undefined,
      screen: screen.trim() || undefined,
      feature: feature.trim() || undefined,
      componentRef: componentRef.trim() || undefined,
      tags: tagsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  return (
    <div
      className="rounded-lg border bg-[var(--cr-surface-2,var(--cr-bg))] p-3"
      style={{ borderColor: 'var(--cr-border-subtle, rgba(0,0,0,0.08))' }}
    >
      <p className="m-0 mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
        Metadata
      </p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-[11px] text-subtle">
          Description
          <Input
            size="small"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this string do?"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-subtle">
          Component ref
          <Input
            size="small"
            value={componentRef}
            onChange={(e) => setComponentRef(e.target.value)}
            placeholder="e.g. <TeamCard> or path"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-subtle">
          Screen
          <Input
            size="small"
            value={screen}
            onChange={(e) => setScreen(e.target.value)}
            placeholder="e.g. team.list"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-subtle">
          Feature
          <Input
            size="small"
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            placeholder="e.g. bulk-actions"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-subtle md:col-span-2">
          Tags (comma-separated)
          <Input
            size="small"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. phase-1a, premium, deprecated"
          />
          {tagsInput.trim() && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tagsInput
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((tag) => (
                  <Tag key={tag} className="text-[10.5px]">
                    {tag}
                  </Tag>
                ))}
            </div>
          )}
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <Space size={4}>
          <Button size="small" icon={<CloseOutlined />} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            loading={saving}
            onClick={submit}
          >
            Save metadata
          </Button>
        </Space>
      </div>
    </div>
  );
}
