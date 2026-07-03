'use client';
import { Form, Input, Switch, message } from 'antd';
import { useEffect } from 'react';
import DsDrawer from '@/components/ui/DsDrawer';
import DsButton from '@/components/ui/DsButton';
import { createGodown, updateGodown } from '@/lib/actions/inventory.actions';
import type { Godown } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  workspaceId: string;
  firmId: string;
  initial?: Godown | null;
}

export function GodownDrawer({ open, onClose, onSaved, workspaceId, firmId, initial }: Props) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (initial) form.setFieldsValue(initial);
      else form.resetFields();
    }
  }, [open, initial, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (initial) {
        await updateGodown(workspaceId, firmId, initial._id, values);
        message.success('Godown updated');
      } else {
        await createGodown(workspaceId, firmId, values);
        message.success('Godown created');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as {
        errorFields?: unknown;
        response?: { data?: { message?: string } };
        message?: string;
      };
      if (e?.errorFields) return; // validation error rendered by form
      message.error(e?.response?.data?.message || e?.message || 'Failed to save godown');
    }
  };

  return (
    <DsDrawer
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Godown' : 'Add Godown'}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <DsButton dsVariant="ghost" onClick={onClose}>
            Cancel
          </DsButton>
          <DsButton dsVariant="primary" onClick={handleSave}>
            {initial ? 'Save Changes' : 'Add Godown'}
          </DsButton>
        </div>
      }
    >
      <div style={{ padding: '16px 24px' }}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, max: 100, message: 'Name is required (max 100 chars)' }]}
          >
            <Input placeholder="e.g. Floor 2 Storage" />
          </Form.Item>
          <Form.Item
            name="address"
            label="Address"
            rules={[{ max: 500, message: 'Max 500 characters' }]}
          >
            <Input.TextArea rows={3} placeholder="Free-text address" />
          </Form.Item>
          <Form.Item
            name="contactPerson"
            label="Contact Person"
            rules={[{ max: 100, message: 'Max 100 characters' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="contactPhone"
            label="Contact Phone"
            rules={[{ max: 20, message: 'Max 20 characters' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="isDefault" label="Set as Default Godown" valuePropName="checked">
            <Switch />
          </Form.Item>
          {initial && (
            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </div>
    </DsDrawer>
  );
}
