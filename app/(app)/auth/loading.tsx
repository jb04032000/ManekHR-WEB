import { Spin } from 'antd';

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <Spin size="large" />
    </div>
  );
}
