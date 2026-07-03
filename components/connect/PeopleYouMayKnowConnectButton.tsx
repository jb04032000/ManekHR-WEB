'use client';

import { useState } from 'react';
import { App, Button } from 'antd';
import { useTranslations } from 'next-intl';
import { sendConnectionRequest } from '@/features/connect/network.actions';

/**
 * Inline "Connect" action for a People-you-may-know row. A small client island
 * inside the (server) `PeopleYouMayKnow` rail: it sends a connection request,
 * then settles into a disabled "Request sent" state. Failures surface as a
 * toast and the button returns to its idle state so the viewer can retry.
 */
export default function PeopleYouMayKnowConnectButton({ userId }: { userId: string }) {
  const t = useTranslations('connect.network.suggestions');
  const { message } = App.useApp();
  const [state, setState] = useState<'idle' | 'pending' | 'sent'>('idle');

  const onConnect = async () => {
    setState('pending');
    const res = await sendConnectionRequest(userId);
    if (res.ok) {
      setState('sent');
      message.success(t('requestSent'));
    } else {
      setState('idle');
      message.error(t('connectError'));
    }
  };

  return (
    <Button
      size="small"
      type={state === 'sent' ? 'default' : 'primary'}
      ghost={state !== 'sent'}
      loading={state === 'pending'}
      disabled={state === 'sent'}
      onClick={onConnect}
      aria-label={t('connect')}
    >
      {state === 'sent' ? t('requestSentShort') : t('connect')}
    </Button>
  );
}
