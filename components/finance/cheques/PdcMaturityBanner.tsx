'use client';

import { useEffect, useState } from 'react';
import { Alert, List, Tag, Button, Collapse, Typography } from 'antd';
import {
  getPdcMaturityAlerts,
  depositCheque,
  presentCheque,
} from '@/lib/actions/finance-cheques.actions';
import type { FinanceCheque } from '@/types';
import dayjs from 'dayjs';

const { Text } = Typography;

function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

interface PdcMaturityBannerProps {
  wsId: string;
  firmId: string;
  onAction?: () => void;
}

export default function PdcMaturityBanner({ wsId, firmId, onAction }: PdcMaturityBannerProps) {
  const [cheques, setCheques] = useState<FinanceCheque[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!wsId || !firmId) return;
    getPdcMaturityAlerts(wsId, firmId, 7)
      .then(setCheques)
      .catch(() => setCheques([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [wsId, firmId]); // eslint-disable-line

  // Render nothing if no upcoming maturities or still loading
  if (loading || cheques.length === 0) return null;

  const handleAction = async (cheque: FinanceCheque) => {
    const date = dayjs(cheque.chequeDate).format('YYYY-MM-DD');
    if (cheque.chequeType === 'received') {
      await depositCheque(wsId, firmId, cheque._id, { depositDate: date });
    } else {
      await presentCheque(wsId, firmId, cheque._id, { depositDate: date });
    }
    load();
    onAction?.();
  };

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      title={`${cheques.length} post-dated cheque${cheques.length > 1 ? 's' : ''} mature in the next 7 days`}
      description={
        <Collapse
          ghost
          size="small"
          style={{ marginTop: 4 }}
          items={[
            {
              key: '1',
              label: 'View upcoming cheques',
              children: (
                <List
                  size="small"
                  dataSource={cheques}
                  renderItem={(cheque) => (
                    <List.Item
                      actions={[
                        <Button
                          key="action"
                          size="small"
                          type="link"
                          onClick={() => handleAction(cheque)}
                        >
                          {cheque.chequeType === 'received' ? 'Mark Deposited' : 'Mark Presented'}
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Text>
                            #{cheque.chequeNumber}
                            {cheque.partyName && (
                              <Text type="secondary"> · {cheque.partyName}</Text>
                            )}
                          </Text>
                        }
                        description={
                          <Text type="secondary">
                            {formatPaise(cheque.amount)} · Matures{' '}
                            {dayjs(cheque.chequeDate).format('DD MMM YYYY')}
                            <Tag color="gold" style={{ marginLeft: 8 }}>
                              {cheque.chequeType === 'received' ? 'Received' : 'Issued'}
                            </Tag>
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />
      }
    />
  );
}
