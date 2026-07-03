'use client';

import { useEffect, useState } from 'react';
import { App, Alert, Button, Form, Input, Radio, Select, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  MailOutlined,
  MessageOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { DsModal } from '@/components/ui';
import { inviteTeamMember } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { GrantAccessPayload, Role, TeamMember } from '@/types';

const { Option } = Select;

interface GrantSuccess {
  inviteUrl: string;
  memberName: string;
  mobile?: string;
}

interface Props {
  open: boolean;
  member: TeamMember | null;
  roles: Role[];
  workspaceId: string;
  onClose: () => void;
  /** Fires after the invite call succeeds. Parent can refetch the row /
   *  list to reflect the new appAccessStatus. The success state (cold
   *  path only) stays open until the owner closes it. */
  onGranted?: () => void;
}

/**
 * Quick-grant modal - used ONLY for the list-page row-action surface
 * (three-dot menu + `?grantAccess=<id>` deep-link).
 *
 * Intentionally minimal: role + delivery + optional email override.
 * Permission overrides live on the detail page's App Access rail (the
 * canonical surface for full-fledged grant). Quick-grant mirrors
 * Slack / Linear / Notion row-action invites: pick role, send, done.
 * Owner fine-tunes per-employee permissions later from the rail.
 *
 * Replaces the over-engineered drawer attempted in P1.8.5 (deleted in
 * the P1.8 revert 2026-05-14).
 */
export default function GrantAppAccessModal({
  open,
  member,
  roles,
  workspaceId,
  onClose,
  onGranted,
}: Props) {
  const t = useTranslations();
  const { message: msgApi } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [grantSuccess, setGrantSuccess] = useState<GrantSuccess | null>(null);

  // Pre-select the canonical Member role on open. Removes friction on
  // the happy path; owner can still swap via dropdown.
  useEffect(() => {
    if (!open || !member || roles.length === 0) return;
    const current = form.getFieldValue('rbacRoleId');
    if (current) return;
    const memberRole = roles.find((r) => r.name === 'Member');
    if (memberRole) form.setFieldValue('rbacRoleId', memberRole._id);
  }, [open, member, roles, form]);

  const handleClose = () => {
    if (submitting) return;
    setGrantSuccess(null);
    form.resetFields();
    onClose();
  };

  const handleSubmit = async (vals: GrantAccessPayload) => {
    if (!member) return;
    setSubmitting(true);
    try {
      const res = await inviteTeamMember(workspaceId, member.id, {
        rbacRoleId: vals.rbacRoleId,
        sendMethod: vals.sendMethod ?? 'auto',
        email: vals.email,
      });
      onGranted?.();
      if (res?.inviteToken) {
        const inviteUrl = `${window.location.origin}/invite/${res.inviteToken}`;
        setGrantSuccess({
          inviteUrl,
          memberName: member.name,
          mobile: member.mobile,
        });
        msgApi.success(t('team.inviteCreated'));
      } else {
        msgApi.success(t('team.inviteSent'));
        handleClose();
      }
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteUrl = async () => {
    if (!grantSuccess) return;
    try {
      await navigator.clipboard.writeText(grantSuccess.inviteUrl);
      msgApi.success(t('team.grantAccessSuccess.copied'));
    } catch {
      msgApi.error(t('team.grantAccessSuccess.copyFailed'));
    }
  };

  return (
    <DsModal
      open={open}
      onCancel={handleClose}
      title={
        <span className="font-display">
          {t('team.grantAccess')} - {member?.name}
        </span>
      }
      onOk={!grantSuccess ? () => form.submit() : undefined}
      okText={t('team.sendInvite')}
      okButtonProps={{ loading: submitting }}
      cancelButtonProps={{ disabled: submitting }}
      footer={
        grantSuccess ? (
          <Button type="primary" onClick={handleClose}>
            {t('team.grantAccessSuccess.done')}
          </Button>
        ) : undefined
      }
    >
      {grantSuccess ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="m-0 mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-green-900">
              <CheckCircleOutlined className="text-green-700" />
              {t('team.grantAccessSuccess.title')}
            </p>
            <p className="m-0 text-[12px] text-green-800">
              {t('team.grantAccessSuccess.description', { name: grantSuccess.memberName })}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-gray-700">
              {t('team.grantAccessSuccess.linkLabel')}
            </label>
            <div className="flex gap-2">
              <Input value={grantSuccess.inviteUrl} readOnly />
              <Tooltip title={t('team.grantAccessSuccess.copy')}>
                <Button icon={<CopyOutlined />} onClick={() => void copyInviteUrl()} />
              </Tooltip>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-gray-700">
              {t('team.grantAccessSuccess.shareLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {grantSuccess.mobile && (
                <a
                  href={`https://wa.me/${grantSuccess.mobile.replace(/\D/g, '')}?text=${encodeURIComponent(
                    t('team.grantAccessSuccess.shareMessage', {
                      name: grantSuccess.memberName,
                      url: grantSuccess.inviteUrl,
                    }),
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button icon={<WhatsAppOutlined />}>
                    {t('team.grantAccessSuccess.whatsapp')}
                  </Button>
                </a>
              )}
              {grantSuccess.mobile && (
                <a
                  href={`sms:${grantSuccess.mobile}?body=${encodeURIComponent(
                    t('team.grantAccessSuccess.shareMessage', {
                      name: grantSuccess.memberName,
                      url: grantSuccess.inviteUrl,
                    }),
                  )}`}
                >
                  <Button icon={<MessageOutlined />}>{t('team.grantAccessSuccess.sms')}</Button>
                </a>
              )}
              <a
                href={`mailto:?subject=${encodeURIComponent(
                  t('team.grantAccessSuccess.emailSubject'),
                )}&body=${encodeURIComponent(
                  t('team.grantAccessSuccess.shareMessage', {
                    name: grantSuccess.memberName,
                    url: grantSuccess.inviteUrl,
                  }),
                )}`}
              >
                <Button icon={<MailOutlined />}>{t('team.grantAccessSuccess.email')}</Button>
              </a>
            </div>
          </div>
          <p className="m-0 text-[11px] text-muted">{t('team.grantAccessSuccess.expiryNote')}</p>
        </div>
      ) : (
        <>
          <p className="m-0 mb-4 text-[13px] text-muted">{t('team.grantAccessDesc')}</p>
          {roles.length === 0 && (
            <Alert
              type="info"
              showIcon
              className="mb-4"
              title={t('team.grantAccessEmpty.title')}
              description={
                <div>
                  <p className="m-0 mb-2 text-[12px]">{t('team.grantAccessEmpty.description')}</p>
                  <Link
                    href="/dashboard/roles"
                    className="text-[12px] font-medium text-blue-600 hover:underline"
                  >
                    {t('team.grantAccessEmpty.cta')}
                  </Link>
                </div>
              }
            />
          )}
          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <Form.Item
              name="rbacRoleId"
              label={t('team.permissionRole')}
              rules={[{ required: true, message: t('team.selectRole') }]}
            >
              <Select placeholder={t('team.selectRole')} disabled={roles.length === 0}>
                {roles.map((r) => (
                  <Option key={r._id} value={r._id}>
                    {r.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="sendMethod"
              label={t('team.inviteDelivery')}
              initialValue="auto"
              rules={[{ required: true }]}
            >
              <Radio.Group>
                <Radio value="auto">{t('team.autoSmsEmail')}</Radio>
                <Radio value="link">{t('team.linkOnly')}</Radio>
                <Radio value="both">{t('team.both')}</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.sendMethod !== cur.sendMethod}>
              {({ getFieldValue }) =>
                getFieldValue('sendMethod') !== 'link' ? (
                  <Form.Item
                    name="email"
                    label={t('team.emailForInvite')}
                    rules={[{ type: 'email', message: t('team.emailInvalid') }]}
                  >
                    <Input placeholder={t('team.emailPlaceholder')} />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
            <p className="m-0 text-[11px] text-muted">{t('team.quickGrantPermissionsHint')}</p>
          </Form>
        </>
      )}
    </DsModal>
  );
}
