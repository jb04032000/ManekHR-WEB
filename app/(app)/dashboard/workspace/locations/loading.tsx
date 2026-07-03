import { Skeleton } from 'antd';

export default function Loading() {
  return (
    <div className="max-w-5xl space-y-4" aria-hidden>
      <Skeleton active paragraph={{ rows: 1 }} title={{ width: 160 }} />
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  );
}
