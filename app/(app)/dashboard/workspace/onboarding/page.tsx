'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, Form, Input, Button, message } from 'antd';
import { UserOutlined, ShopOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useAuthStore, useWorkspaceStore } from '@/lib/store';
import { createWorkspace, listWorkspaces } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';

export default function WorkspaceOnboardingPage() {
  const tForm = useTranslations('workspace.createForm');
  const tOnb = useTranslations('workspace.onboarding');
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const { setWorkspaces, setCurrentWorkspaceId } = useWorkspaceStore();
  const [form] = Form.useForm();
  const [msgApi, ctx] = message.useMessage();
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkWorkspaces = async () => {
      try {
        const res = await listWorkspaces();

        // Handle ActionResult format
        if (res && typeof res === 'object' && 'ok' in res) {
          if (res.ok) {
            const list = Array.isArray(res.data) ? res.data : [];

            if (list.length > 0) {
              setWorkspaces(list);
              if (list.length === 1) {
                setCurrentWorkspaceId(list[0]._id);
              }
              router.replace('/dashboard');
              return;
            }
          } else {
            console.error('[Onboarding] Failed to load workspaces:', res.error);
          }
        }
      } catch (error) {
        console.error('[Onboarding] Check workspaces error:', error);
      } finally {
        setChecking(false);
      }
    };

    checkWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount only; router/setters are stable refs
  }, []);

  useEffect(() => {
    if (user) {
      form.setFieldsValue({ userName: user.name });
    }
  }, [user, form]);

  const handleCreate = async (values: {
    userName: string;
    workspaceName: string;
    location?: string;
  }) => {
    setCreating(true);
    try {
      if (values.userName !== user?.name) {
        updateUser({ name: values.userName });
      }

      const createRes = await createWorkspace({
        name: values.workspaceName,
        location: values.location,
      });

      if (!createRes.ok) {
        msgApi.error(createRes.error);
        return;
      }

      const res = await listWorkspaces();

      // Handle ActionResult format
      if (res && typeof res === 'object' && 'ok' in res) {
        if (res.ok) {
          const list = Array.isArray(res.data) ? res.data : [];

          if (list.length > 0) {
            setWorkspaces(list);
            setCurrentWorkspaceId(list[0]._id);
          }
        } else {
          msgApi.error(res.error);
          return;
        }
      }

      msgApi.success(tOnb('createSuccess'));
      setTimeout(() => router.replace('/dashboard'), 500);
    } catch (error) {
      msgApi.error(parseApiError(error));
    } finally {
      setCreating(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-primary-light text-[28px]"
            aria-hidden="true"
          >
            🏢
          </div>
          <p className="text-sm text-muted" role="status" aria-live="polite">
            {tOnb('checking')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {ctx}
      <div className="mx-auto max-w-[600px]">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-primary to-secondary text-[32px] shadow-lg"
            aria-hidden="true"
          >
            🏢
          </div>
          <h1 className="m-0 mb-2 font-display text-[28px] font-extrabold text-heading">
            {tOnb('welcomeTitle')}
          </h1>
          <p className="m-0 text-[15px] text-muted">{tOnb('welcomeSubtitle')}</p>
        </div>

        <Card className="shadow-sm">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreate}
            requiredMark={false}
            size="large"
          >
            <div className="mb-6">
              <h3 className="mb-3 text-[11px] font-bold tracking-wider text-muted uppercase">
                {tOnb('yourDetailsHeader')}
              </h3>
              <Form.Item
                name="userName"
                label={tOnb('yourNameLabel')}
                rules={[
                  { required: true, message: tOnb('yourNameRequired') },
                  { min: 2, message: tOnb('yourNameMinLength') },
                ]}
              >
                <Input
                  prefix={<UserOutlined className="text-subtle" />}
                  placeholder={tOnb('yourNamePlaceholder')}
                />
              </Form.Item>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-[11px] font-bold tracking-wider text-muted uppercase">
                {tOnb('workspaceDetailsHeader')}
              </h3>
              <Form.Item
                name="workspaceName"
                label={tForm('nameLabel')}
                rules={[
                  { required: true, message: tForm('nameRequired') },
                  { min: 2, message: tOnb('workspaceNameMinLength') },
                ]}
              >
                <Input
                  prefix={<ShopOutlined className="text-subtle" />}
                  placeholder={tOnb('workspaceNamePlaceholder')}
                />
              </Form.Item>

              <Form.Item name="location" label={tOnb('locationOptionalLabel')}>
                <Input
                  prefix={<EnvironmentOutlined className="text-subtle" />}
                  placeholder={tOnb('locationPlaceholder')}
                />
              </Form.Item>
            </div>

            <div
              className="mb-6 flex gap-3 rounded-xl border border-primary-border bg-primary-light p-4"
              role="note"
            >
              <div className="text-lg text-primary" aria-hidden="true">
                ℹ️
              </div>
              <p
                className="m-0 text-[13px] leading-relaxed text-body"
                dangerouslySetInnerHTML={{ __html: tOnb('ownerInfo') }}
              />
            </div>

            <Form.Item className="mb-0">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={creating}
                block
                className="h-[48px] font-semibold"
              >
                {tOnb('submitBtn')}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
}
