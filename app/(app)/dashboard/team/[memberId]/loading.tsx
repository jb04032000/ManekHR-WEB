import { Skeleton } from 'antd';

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <Skeleton active avatar={{ size: 56 }} paragraph={{ rows: 1 }} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <Skeleton active paragraph={{ rows: 5 }} title={false} />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </div>
    </div>
  );
}
