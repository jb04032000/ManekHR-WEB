'use client';
import { useState } from 'react';
import { App, Drawer, Button, Form, Input, Row, Col, TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { createShift } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { CreateShiftPayload, Shift } from '@/types';
import { SHIFT_COLORS } from './memberFormDefaults';
import { useMemberFormOptions } from './useMemberFormOptions';

interface CreateShiftDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated: (shift: Shift) => void;
  workspaceId: string;
}

export default function CreateShiftDrawer({
  open,
  onClose,
  onCreated,
  workspaceId,
}: CreateShiftDrawerProps) {
  const t = useTranslations('team');
  const { shiftDays } = useMemberFormOptions();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [shiftColor, setShiftColor] = useState(SHIFT_COLORS[0].color);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const { message: msgApi } = App.useApp();

  const toggleDay = (day: number) => {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const reset = () => {
    form.resetFields();
    setShiftColor(SHIFT_COLORS[0].color);
    setWorkingDays([1, 2, 3, 4, 5]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (vals: Record<string, unknown>) => {
    if (!workspaceId) return;
    setSaving(true);
    const colorPair = SHIFT_COLORS.find((c) => c.color === shiftColor) ?? SHIFT_COLORS[0];
    const startTime = dayjs.isDayjs(vals.startTime)
      ? (vals.startTime as Dayjs).format('HH:mm')
      : (vals.startTime as string);
    const endTime = dayjs.isDayjs(vals.endTime)
      ? (vals.endTime as Dayjs).format('HH:mm')
      : (vals.endTime as string);
    const payload: CreateShiftPayload = {
      name: vals.name as string,
      startTime,
      endTime,
      workingDays,
      color: colorPair.color,
      colorBg: colorPair.bg,
    };
    try {
      const newShift = (await createShift(workspaceId, payload)) as Shift;
      msgApi.success(t('createShiftSuccess'));
      onCreated(newShift);
      reset();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={<span className="font-display font-bold">{t('createShiftTitle')}</span>}
      size="large"
      placement="right"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={handleClose}>{t('createShiftCancel')}</Button>
          <Button type="primary" loading={saving} onClick={() => form.submit()}>
            {t('createShiftSubmit')}
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit}>
        <Form.Item name="name" label={t('createShiftLabelName')} rules={[{ required: true }]}>
          <Input placeholder={t('createShiftPlaceholderName')} size="large" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="startTime"
              label={t('createShiftLabelStart')}
              rules={[{ required: true }]}
            >
              <TimePicker use12Hours format="hh:mm A" size="large" className="w-full" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="endTime" label={t('createShiftLabelEnd')} rules={[{ required: true }]}>
              <TimePicker use12Hours format="hh:mm A" size="large" className="w-full" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label={t('createShiftLabelDays')}>
          <div className="flex gap-2">
            {shiftDays.map((day) => {
              const isWorking = workingDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  title={day.name}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    border: `1.5px solid ${isWorking ? shiftColor : 'var(--cr-border, var(--cr-border))'}`,
                    background: isWorking ? `${shiftColor}15` : 'var(--cr-surface, #fff)',
                    color: isWorking ? shiftColor : 'var(--cr-text-4, var(--cr-text-5))',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </Form.Item>
        <Form.Item label={t('createShiftLabelColor')}>
          <div className="flex flex-wrap gap-2">
            {SHIFT_COLORS.map((c) => (
              <div
                key={c.color}
                onClick={() => setShiftColor(c.color)}
                className="flex flex-shrink-0 cursor-pointer items-center justify-center rounded-full"
                style={{
                  width: 20,
                  height: 20,
                  background: c.color,
                  boxShadow:
                    shiftColor === c.color ? `0 0 0 2px #fff, 0 0 0 3.5px ${c.color}` : 'none',
                  transition: 'box-shadow 0.15s ease',
                }}
              >
                {shiftColor === c.color && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="#fff"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
