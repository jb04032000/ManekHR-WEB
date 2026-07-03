'use client';
import { useEffect } from 'react';
import { Button, Result } from 'antd';

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}
    >
      <Result
        status="error"
        title="Something went wrong"
        subTitle={error.message ?? 'An error occurred while loading this page.'}
        extra={[
          <Button type="primary" key="retry" onClick={reset}>
            Try again
          </Button>,
          <Button key="home" href="/dashboard">
            Go to Dashboard
          </Button>,
        ]}
      />
    </div>
  );
}
