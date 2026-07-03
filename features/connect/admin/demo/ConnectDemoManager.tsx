'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { App, Button, Card, Input, Modal, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { listDemoUsers, clearAllDemo, deleteDemoUser, postAsDemoUser } from './demo.actions';
import type { DemoUserRow } from './demo.types';

/**
 * Admin "Demo manager": list the seeded Connect demo accounts, post as them,
 * and remove them (one, selected, or all) once real users arrive. Client-driven
 * (loads on mount); every mutation re-fetches the list. Linked to:
 * demo.actions.ts (admin-guarded backend).
 */

function errorText(e: unknown): string {
  const data = (e as { response?: { data?: { message?: string; error?: { message?: string } } } })
    ?.response?.data;
  return data?.error?.message || data?.message || (e as Error)?.message || 'Something went wrong.';
}

export default function ConnectDemoManager() {
  const { message } = App.useApp();

  const [rows, setRows] = useState<DemoUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const [postTarget, setPostTarget] = useState<DemoUserRow | null>(null);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDemoUsers();
      setRows(data);
      setSelected([]);
    } catch (e) {
      message.error(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const onClearAll = useCallback(async () => {
    setBusy(true);
    try {
      const res = await clearAllDemo();
      message.success(`Removed ${res.removed} demo account(s) and their content.`);
      await load();
    } catch (e) {
      message.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }, [load, message]);

  const onDelete = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await deleteDemoUser(id);
        message.success('Demo account removed.');
        await load();
      } catch (e) {
        message.error(errorText(e));
      } finally {
        setBusy(false);
      }
    },
    [load, message],
  );

  const onDeleteSelected = useCallback(async () => {
    setBusy(true);
    try {
      for (const id of selected) await deleteDemoUser(id);
      message.success(`Removed ${selected.length} demo account(s).`);
      await load();
    } catch (e) {
      message.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }, [selected, load, message]);

  const submitPost = useCallback(async () => {
    if (!postTarget) return;
    const body = postText.trim();
    if (!body) {
      message.warning('Write something to post.');
      return;
    }
    setPosting(true);
    try {
      await postAsDemoUser(postTarget.id, body);
      message.success(`Posted as ${postTarget.name}.`);
      setPostTarget(null);
      setPostText('');
      await load();
    } catch (e) {
      message.error(errorText(e));
    } finally {
      setPosting(false);
    }
  }, [postTarget, postText, load, message]);

  const columns: ColumnsType<DemoUserRow> = useMemo(
    () => [
      {
        title: 'Account',
        dataIndex: 'name',
        key: 'name',
        render: (_: string, r: DemoUserRow) => (
          <div>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{r.headline}</div>
          </div>
        ),
      },
      {
        title: 'Login',
        key: 'login',
        render: (_: unknown, r: DemoUserRow) => (
          <div style={{ fontSize: 13 }}>
            <div>{r.mobile}</div>
            <div style={{ color: '#888' }}>OTP {r.loginOtp}</div>
          </div>
        ),
      },
      {
        title: 'Profile',
        dataIndex: 'handle',
        key: 'handle',
        render: (handle: string) =>
          handle ? (
            <Link href={`/connect/u/${handle}`} target="_blank">
              /u/{handle}
            </Link>
          ) : (
            <span style={{ color: '#aaa' }}>—</span>
          ),
      },
      {
        title: 'Content',
        key: 'content',
        render: (_: unknown, r: DemoUserRow) => (
          <Space size={4} wrap>
            <Tag>{r.posts} posts</Tag>
            <Tag>{r.listings} listings</Tag>
            <Tag>{r.jobs} jobs</Tag>
          </Space>
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_: unknown, r: DemoUserRow) => (
          <Space>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setPostTarget(r);
                setPostText('');
              }}
            >
              Post as
            </Button>
            <Popconfirm
              title={`Remove ${r.name} and all their content?`}
              okText="Remove"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(r.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [onDelete],
  );

  return (
    <Card
      title={`Demo accounts (${rows.length})`}
      extra={
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} disabled={loading || busy}>
            Refresh
          </Button>
          {selected.length > 0 && (
            <Popconfirm
              title={`Remove ${selected.length} selected account(s)?`}
              okText="Remove"
              okButtonProps={{ danger: true }}
              onConfirm={onDeleteSelected}
            >
              <Button danger disabled={busy}>
                Delete selected ({selected.length})
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="Remove ALL demo accounts and their content? Real users are not affected."
            okText="Clear all"
            okButtonProps={{ danger: true }}
            onConfirm={onClearAll}
          >
            <Button danger type="primary" disabled={busy || rows.length === 0}>
              Clear all
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
        Seeded sample accounts (<code>isDemo</code>). Sign in as any of them with the mobile number
        + dev OTP to post manually, or use “Post as”. Removing demo data never touches real users.
      </Typography.Paragraph>
      <Table<DemoUserRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        size="middle"
        scroll={{ x: 760 }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as string[]),
        }}
      />

      <Modal
        open={!!postTarget}
        title={postTarget ? `Post as ${postTarget.name}` : 'Post'}
        okText="Post"
        confirmLoading={posting}
        onCancel={() => setPostTarget(null)}
        onOk={submitPost}
      >
        <Input.TextArea
          rows={4}
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="Write a short post in this persona's voice…"
          maxLength={3000}
          showCount
        />
      </Modal>
    </Card>
  );
}
