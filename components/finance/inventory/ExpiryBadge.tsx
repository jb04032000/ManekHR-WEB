'use client';
import { Tag } from 'antd';

interface Props {
  expiryDate?: string | Date | null;
}

export function ExpiryBadge({ expiryDate }: Props) {
  if (!expiryDate) return <Tag color="default">No Expiry</Tag>;
  const exp = new Date(expiryDate);
  const now = new Date();
  const days = Math.ceil((exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return <Tag color="red">Expired {Math.abs(days)}d ago</Tag>;
  if (days < 7) return <Tag color="red">Expires in {days}d</Tag>;
  if (days <= 30) return <Tag color="orange">Expires in {days}d</Tag>;
  return <Tag color="green">Expires in {days}d</Tag>;
}
