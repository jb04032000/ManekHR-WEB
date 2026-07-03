'use client';
import { useState, useEffect } from 'react';
import { Popover, TimePicker, Form, Button } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';

interface Props {
  open: boolean;
  onClose: () => void;
  rowDate: string; // ISO date of the attendance row
  defaultCheckIn?: string | null; // existing ISO datetime
  defaultCheckOut?: string | null;
  shiftStart?: string | null; // 'HH:mm' from shift snapshot
  shiftEnd?: string | null;
  onSubmit: (checkInIso: string | null, checkOutIso: string | null) => Promise<void>;
  children: React.ReactNode; // trigger element
}

export function SetTimesPopover({
  open,
  onClose,
  rowDate,
  defaultCheckIn,
  defaultCheckOut,
  shiftStart,
  shiftEnd,
  onSubmit,
  children,
}: Props) {
  const t = useTranslations('attendance.setTimes');
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Only pre-fill from existing saved values - never from shift times.
    // Shift times are shown as placeholder text so the user sees the suggestion
    // without accidentally submitting them as actual values.
    form.setFieldsValue({
      checkInTime: defaultCheckIn ? dayjs(defaultCheckIn) : null,
      checkOutTime: defaultCheckOut ? dayjs(defaultCheckOut) : null,
    });
  }, [open, defaultCheckIn, defaultCheckOut, form]);

  const handleSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      const dateOnly = dayjs(rowDate).startOf('day');
      const checkInMoment = v.checkInTime
        ? dateOnly.hour(v.checkInTime.hour()).minute(v.checkInTime.minute()).second(0)
        : null;
      let checkOutMoment: Dayjs | null = null;
      if (v.checkOutTime) {
        checkOutMoment = dateOnly
          .hour(v.checkOutTime.hour())
          .minute(v.checkOutTime.minute())
          .second(0);
        // Cross-midnight: checkout before or equal to checkin in clock time → next calendar day
        if (checkInMoment && !checkOutMoment.isAfter(checkInMoment)) {
          checkOutMoment = checkOutMoment.add(1, 'day');
        }
      }
      await onSubmit(
        checkInMoment ? checkInMoment.toISOString() : null,
        checkOutMoment ? checkOutMoment.toISOString() : null,
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      trigger="click"
      title={t('title')}
      content={
        <Form form={form} layout="vertical" style={{ width: 240 }}>
          <Form.Item name="checkInTime" label={t('checkIn')}>
            <TimePicker
              format="hh:mm a"
              use12Hours
              minuteStep={5}
              allowClear
              placeholder={
                shiftStart ? t('placeholderShift', { time: shiftStart }) : t('placeholderDefault')
              }
              style={{ width: '100%' }}
              onChange={() => form.validateFields(['checkOutTime'])}
            />
          </Form.Item>
          <Form.Item
            name="checkOutTime"
            label={t('checkOut')}
            rules={[
              {
                validator: async (_, value: Dayjs | null | undefined) => {
                  if (!value) return;
                  const checkIn: Dayjs | null = form.getFieldValue('checkInTime');
                  if (!checkIn) throw new Error(t('validationCheckInRequired'));
                  // Allow cross-midnight (checkout before checkin in clock time = next day)
                  if (value.isSame(checkIn)) throw new Error(t('validationCheckOutDiffer'));
                },
              },
            ]}
          >
            <TimePicker
              format="hh:mm a"
              use12Hours
              minuteStep={5}
              allowClear
              placeholder={
                shiftEnd ? t('placeholderShift', { time: shiftEnd }) : t('placeholderDefault')
              }
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Button type="primary" loading={submitting} onClick={handleSubmit} block>
            {t('save')}
          </Button>
        </Form>
      }
    >
      {children}
    </Popover>
  );
}
