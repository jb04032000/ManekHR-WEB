import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card, Row, Col } from 'antd';
import {
  BellOutlined,
  SettingOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

// Reminder hub landing (server component). i18n via finance.reminders.index. Cards
// link to the reminders sub-pages (settings/rules/logs); Templates is a disabled stub.
export default async function RemindersIndexPage({
  params,
}: {
  params: Promise<{ firmId: string }>;
}) {
  const { firmId } = await params;
  const t = await getTranslations('finance.reminders');

  const cards = [
    {
      title: t('index.settingsTitle'),
      description: t('index.settingsDesc'),
      icon: <SettingOutlined style={{ fontSize: 28, color: 'var(--cr-primary)' }} />,
      href: `/dashboard/finance/firms/${firmId}/reminders/settings`,
    },
    {
      title: t('index.rulesTitle'),
      description: t('index.rulesDesc'),
      icon: <UnorderedListOutlined style={{ fontSize: 28, color: 'var(--cr-success-500)' }} />,
      href: `/dashboard/finance/firms/${firmId}/reminders/rules`,
    },
    {
      title: t('index.logsTitle'),
      description: t('index.logsDesc'),
      icon: <FileTextOutlined style={{ fontSize: 28, color: 'var(--cr-warning-500)' }} />,
      href: `/dashboard/finance/firms/${firmId}/reminders/logs`,
    },
    {
      title: t('index.templatesTitle'),
      description: t('index.templatesDesc'),
      icon: <BellOutlined style={{ fontSize: 28, color: 'var(--cr-indigo-400)' }} />,
      href: null,
      disabled: true,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{t('index.title')}</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--cr-text-3)', fontSize: 14 }}>
          {t('index.subtitle')}
        </p>
      </div>
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.title}>
            {c.disabled ? (
              <Card
                style={{ height: '100%', opacity: 0.6, cursor: 'not-allowed' }}
                hoverable={false}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '8px 0',
                  }}
                >
                  {c.icon}
                  <div style={{ marginTop: 12, fontWeight: 600, fontSize: 15 }}>{c.title}</div>
                  <div style={{ marginTop: 6, color: 'var(--cr-text-3)', fontSize: 13 }}>
                    {c.description}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--cr-neutral-300)' }}>
                    {t('index.comingSoon')}
                  </div>
                </div>
              </Card>
            ) : (
              <Link href={c.href!} style={{ textDecoration: 'none' }}>
                <Card hoverable style={{ height: '100%' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      padding: '8px 0',
                    }}
                  >
                    {c.icon}
                    <div style={{ marginTop: 12, fontWeight: 600, fontSize: 15 }}>{c.title}</div>
                    <div style={{ marginTop: 6, color: 'var(--cr-text-3)', fontSize: 13 }}>
                      {c.description}
                    </div>
                  </div>
                </Card>
              </Link>
            )}
          </Col>
        ))}
      </Row>
    </div>
  );
}
