'use client';
import { Button, DatePicker, Space } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { todayISO } from '@/lib/utils';

interface DateNavigatorProps {
  date: string;               // YYYY-MM-DD
  onChange: (date: string) => void;
  format?: string;
  todayLabel?: string;
  disableFuture?: boolean;
}

export function DateNavigator({
  date,
  onChange,
  format = 'DD MMM YYYY',
  todayLabel = 'Today',
  disableFuture = false,
}: DateNavigatorProps) {
  const todayStr = todayISO();
  const isToday  = date === todayStr;

  return (
    <Space size="small">
      <Button icon={<LeftOutlined />} onClick={() => onChange(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))} />
      <DatePicker
        value={dayjs(date)}
        onChange={(d) => d && onChange(d.format('YYYY-MM-DD'))}
        format={format}
        allowClear={false}
        disabledDate={disableFuture ? (d) => d.isAfter(dayjs(), 'day') : undefined}
      />
      <Button
        icon={<RightOutlined />}
        onClick={() => onChange(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))}
        disabled={disableFuture && isToday}
      />
      <Button onClick={() => onChange(todayStr)} disabled={isToday}>
        {todayLabel}
      </Button>
    </Space>
  );
}
