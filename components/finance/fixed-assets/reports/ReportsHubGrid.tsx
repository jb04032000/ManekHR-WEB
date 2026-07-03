'use client';
import React from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Row, Col, Card, Typography, Space } from 'antd';
import {
  TableOutlined,
  BarChartOutlined,
  ApartmentOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';

const { Title, Text } = Typography;

interface ReportCard {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  color: string;
}

export default function ReportsHubGrid() {
  const t = useTranslations('finance.fixedAssets.reports.hub');
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();

  const base = `/dashboard/finance/firms/${firmId}/fixed-assets/reports`;

  const cards: ReportCard[] = [
    {
      key: 'asset-register',
      icon: <TableOutlined style={{ fontSize: 28, color: 'var(--cr-primary)' }} />,
      title: t('cards.assetRegister.title'),
      description: t('cards.assetRegister.description'),
      href: `${base}/asset-register`,
      color: 'var(--cr-primary)',
    },
    {
      key: 'depreciation-schedule',
      icon: <BarChartOutlined style={{ fontSize: 28, color: 'var(--cr-success-500)' }} />,
      title: t('cards.depreciationSchedule.title'),
      description: t('cards.depreciationSchedule.description'),
      href: `${base}/depreciation-schedule`,
      color: 'var(--cr-success-500)',
    },
    {
      key: 'block-summary',
      icon: <ApartmentOutlined style={{ fontSize: 28, color: 'var(--cr-warning-500)' }} />,
      title: t('cards.blockSummary.title'),
      description: t('cards.blockSummary.description'),
      href: `${base}/block-summary`,
      color: 'var(--cr-warning-500)',
    },
    {
      key: 'additions-disposals',
      icon: <PlusCircleOutlined style={{ fontSize: 28, color: 'var(--cr-indigo-400)' }} />,
      title: t('cards.additionsDisposals.title'),
      description: t('cards.additionsDisposals.description'),
      href: `${base}/additions-disposals`,
      color: 'var(--cr-indigo-400)',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={1} style={{ marginBottom: 8, fontSize: 22 }}>
        {t('title')}
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        {t('subtitle')}
      </Text>

      <Row gutter={[16, 16]}>
        {cards.map((card) => (
          <Col xs={24} sm={12} xl={12} key={card.key}>
            <Card
              style={{
                height: '100%',
                border: '1px solid var(--cr-border, var(--cr-border-light))',
                borderRadius: 12,
              }}
              styles={{ body: { padding: 20 } }}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {card.icon}
                  <Title level={5} style={{ margin: 0 }}>
                    {card.title}
                  </Title>
                </div>
                <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  {card.description}
                </Text>
                <DsButton dsVariant="primary" dsSize="sm" onClick={() => router.push(card.href)}>
                  {t('openReport')}
                </DsButton>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
