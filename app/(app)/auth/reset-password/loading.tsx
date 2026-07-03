import { Spin } from 'antd';

export default function ResetPasswordLoading() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Spin size="large" />
    </div>
  );
}
