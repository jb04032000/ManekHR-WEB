import { Spin } from 'antd';

export default function VerifyEmailLoading() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Spin size="large" />
    </div>
  );
}
