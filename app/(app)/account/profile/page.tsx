'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Form, Input, Button, message, Row, Col, Tag } from 'antd';
import {
  CameraOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  EditOutlined,
  CloseOutlined,
  CheckOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/lib/store';
import { updateProfile } from '@/lib/actions';
import { uploadService } from '@/lib/services/upload.service';
import { VerifyChannelModal } from '@/components/auth/VerifyChannelModal';
import { parseApiError, fmt } from '@/lib/utils';
import { DsAvatar } from '@/components/ui';
import { SectionHeader } from '@/components/settings/SectionHeader';
import { SectionCard } from '@/components/settings/SectionCard';
import HandleEditor from '@/components/account/HandleEditor';
import type { UpdateProfilePayload } from '@/types';

export default function ProfileSettingsPage() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const { user, updateUser } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [profileForm] = Form.useForm();
  const [verifyChannel, setVerifyChannel] = useState<null | 'email' | 'mobile'>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  // Avatar uploader - a hidden `<input type="file">` keyed by `fileInputRef`,
  // triggered by the "Change photo" button below the avatar. Uploads to R2
  // via the `avatars` category (the existing identity-photo bucket) and
  // patches `User.profilePicture`. `updateUser` syncs the auth store so
  // every `<DsAvatar>` everywhere reflects the new photo without a refresh.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    try {
      const { url } = await uploadService.uploadSingle(file, { category: 'avatars' });
      const updated = await updateProfile({ profilePicture: url });
      updateUser({ profilePicture: updated?.profilePicture ?? url });
      msgApi.success(t('photoUpdated'));
    } catch (err) {
      msgApi.error(parseApiError(err));
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAvatarRemove() {
    if (!user?.profilePicture) return;
    setAvatarBusy(true);
    try {
      const updated = await updateProfile({ profilePicture: '' });
      updateUser({ profilePicture: updated?.profilePicture ?? '' });
      msgApi.success(t('photoRemoved'));
    } catch (err) {
      msgApi.error(parseApiError(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  const profileInitial = useMemo(
    () => ({
      name: user?.name ?? '',
      email: user?.email ?? '',
      mobile: user?.mobile ?? '',
    }),
    [user?.name, user?.email, user?.mobile],
  );

  const watchedName = Form.useWatch('name', profileForm);

  const isProfileDirty = useMemo(() => {
    const name = (watchedName ?? '').toString().trim();
    return name !== (profileInitial.name ?? '').trim();
  }, [watchedName, profileInitial]);

  useEffect(() => {
    profileForm.setFieldsValue(profileInitial);
  }, [profileInitial, profileForm]);

  const enterEditMode = () => {
    profileForm.setFieldsValue(profileInitial);
    setIsEditingProfile(true);
  };

  const cancelEdit = () => {
    profileForm.setFieldsValue(profileInitial);
    setIsEditingProfile(false);
  };

  const handleProfile = async (vals: UpdateProfilePayload) => {
    if (!isProfileDirty) {
      setIsEditingProfile(false);
      return;
    }
    const payload: UpdateProfilePayload = { name: vals.name };
    setSaving(true);
    try {
      const res = await updateProfile(payload);
      updateUser(res ?? {});
      msgApi.success(tCommon('saved'));
      setIsEditingProfile(false);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const accountId = user?._id?.slice(-8).toUpperCase() ?? '-';
  const signinMethod = (() => {
    if (user?.googleId) return t('google');
    const channels: string[] = [];
    if (user?.email) channels.push(t('signinChannelEmail'));
    if (user?.mobile) channels.push(t('signinChannelMobile'));
    if (user?.hasPassword) channels.push(t('signinChannelPassword'));
    if (user?.mobile && !user?.hasPassword) channels.push(t('signinChannelOtp'));
    return channels.length > 0 ? channels.join(' · ') : '-';
  })();

  const copyAccountId = () => {
    if (!user?._id) return;
    navigator.clipboard
      .writeText(user._id)
      .then(() => msgApi.success(t('accountIdCopied')))
      .catch(() => msgApi.error(t('accountIdCopyFailed')));
  };

  return (
    <>
      {ctx}
      <SectionHeader title={t('section.profile.title')} description={t('section.profile.desc')} />

      {/* Header card - avatar + name + status pill + meta strip + Copy ID.
          Mobile: centered vertical stack (avatar -> name -> meta on their own
          lines -> full-width Copy ID) so nothing crams on a narrow screen.
          sm+ restores the original horizontal row (identity left, Copy ID
          right). All breakpoint changes are `sm:` overrides; desktop is
          unchanged. */}
      <section className="mb-6 rounded-[14px] border border-border bg-surface px-5 py-5 sm:px-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex w-full min-w-0 flex-col items-center gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
            <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
              <DsAvatar name={user?.name ?? ''} src={user?.profilePicture} size={64} />
              <div className="flex items-center gap-1">
                <Button
                  size="small"
                  type="text"
                  icon={<CameraOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  loading={avatarBusy}
                  aria-label={t('changePhotoAria')}
                  className="text-[12px]"
                >
                  {user?.profilePicture ? t('changePhoto') : t('addPhoto')}
                </Button>
                {user?.profilePicture && (
                  <Button
                    size="small"
                    type="text"
                    danger
                    onClick={handleAvatarRemove}
                    disabled={avatarBusy}
                    className="text-[12px]"
                  >
                    {t('removePhoto')}
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarPick}
                hidden
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h2
                  style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.2 }}
                  className="font-display text-[20px] font-bold text-heading"
                >
                  {user?.name || '-'}
                </h2>
                <Tag color={user?.isActive ? 'success' : 'default'}>
                  {user?.isActive ? t('active') : t('inactive')}
                </Tag>
              </div>
              {/* Meta - stacked + centered on mobile (the `·` separators are
                  hidden there); a single inline dotted strip on sm+. */}
              <div className="mt-2 flex flex-col items-center gap-1 text-[13px] text-muted sm:mt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
                <span>
                  {t('accountId')}{' '}
                  <code className="rounded-[4px] bg-surface-2 px-1.5 py-0.5 text-[12px]">
                    {accountId}
                  </code>
                </span>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span>
                  {t('signinMethod')}: <span className="text-heading">{signinMethod}</span>
                </span>
                {user?.createdAt && (
                  <>
                    <span aria-hidden="true" className="hidden sm:inline">
                      ·
                    </span>
                    <span>
                      {t('joined')} {fmt(user.createdAt)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Button icon={<CopyOutlined />} onClick={copyAccountId} className="w-full sm:w-auto">
            {t('copyId')}
          </Button>
        </div>
      </section>

      <SectionCard
        title={t('section.personalDetails.title')}
        description={t('section.personalDetails.desc')}
        trailing={
          !isEditingProfile ? (
            <Button
              type="default"
              icon={<EditOutlined />}
              onClick={enterEditMode}
              aria-label={t('editProfileAria')}
            >
              {tCommon('edit')}
            </Button>
          ) : null
        }
      >
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleProfile}
          requiredMark={false}
          disabled={!isEditingProfile}
          initialValues={profileInitial}
        >
          <Form.Item
            name="name"
            label={t('fullName')}
            rules={[
              { required: true, message: t('fullNameRequired') },
              { min: 2, message: t('fullNameMinChars') },
            ]}
          >
            <Input size="large" placeholder={t('yourName')} autoComplete="name" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label={
                  <span className="flex items-center gap-2">
                    {t('emailAddress')}
                    {user?.email &&
                      (user.isEmailVerified ? (
                        <Tag color="success" className="m-0 text-[10px]">
                          {t('verifiedShort')}
                        </Tag>
                      ) : (
                        <Tag color="warning" className="m-0 text-[10px]">
                          {t('notVerifiedShort')}
                        </Tag>
                      ))}
                    {user?.isEmailVerified && (
                      <LockOutlined
                        className="text-[11px] text-subtle"
                        aria-label={t('emailLockedAria')}
                      />
                    )}
                  </span>
                }
              >
                <Input
                  size="large"
                  prefix={<MailOutlined />}
                  placeholder={t('noEmailOnFile')}
                  readOnly
                  aria-readonly="true"
                  autoComplete="email"
                />
              </Form.Item>
              {!user?.isEmailVerified && (
                <button
                  type="button"
                  className="-mt-3 cursor-pointer border-0 bg-transparent px-0 text-[13px] font-semibold text-primary hover:underline"
                  onClick={() => setVerifyChannel('email')}
                >
                  {user?.email ? t('verifyEmail') : t('addEmail')}
                </button>
              )}
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="mobile"
                label={
                  <span className="flex items-center gap-2">
                    {t('mobileNumber')}
                    {user?.mobile &&
                      (user.isMobileVerified ? (
                        <Tag color="success" className="m-0 text-[10px]">
                          {t('verifiedShort')}
                        </Tag>
                      ) : (
                        <Tag color="warning" className="m-0 text-[10px]">
                          {t('notVerifiedShort')}
                        </Tag>
                      ))}
                    {user?.isMobileVerified && (
                      <LockOutlined
                        className="text-[11px] text-subtle"
                        aria-label={t('mobileLockedAria')}
                      />
                    )}
                  </span>
                }
              >
                <Input
                  size="large"
                  prefix={<PhoneOutlined />}
                  placeholder={t('noMobileOnFile')}
                  readOnly
                  aria-readonly="true"
                  autoComplete="tel"
                />
              </Form.Item>
              {!user?.isMobileVerified && (
                <button
                  type="button"
                  className="-mt-3 cursor-pointer border-0 bg-transparent px-0 text-[13px] font-semibold text-primary hover:underline"
                  onClick={() => setVerifyChannel('mobile')}
                >
                  {user?.mobile ? t('verifyMobile') : t('addMobile')}
                </button>
              )}
            </Col>
          </Row>
          {isEditingProfile && (
            <div className="flex items-center gap-2">
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                size="large"
                icon={<CheckOutlined />}
              >
                {t('saveChanges')}
              </Button>
              <Button
                type="default"
                size="large"
                icon={<CloseOutlined />}
                onClick={cancelEdit}
                disabled={saving}
              >
                {tCommon('cancel')}
              </Button>
            </div>
          )}
        </Form>
      </SectionCard>

      {/* Public-profile handle ("/u/<handle>") - the LinkedIn-style URL the
          user shares. Backend auto-generates one at signup from the user's
          name; this card lets them claim a custom one with a 30-day cooldown
          (mirrors the backend's anti-squatting guard). */}
      <SectionCard title={t('section.handle.title')} description={t('section.handle.desc')}>
        <HandleEditor />
      </SectionCard>

      {verifyChannel && (
        <VerifyChannelModal
          open
          channel={verifyChannel}
          currentValue={
            verifyChannel === 'email' ? (user?.email ?? undefined) : (user?.mobile ?? undefined)
          }
          isLocked={false}
          onVerified={(canonical) => {
            if (verifyChannel === 'email') {
              updateUser({ email: canonical, isEmailVerified: true });
            } else {
              updateUser({ mobile: canonical, isMobileVerified: true });
            }
            msgApi.success(
              verifyChannel === 'email' ? t('emailVerifiedToast') : t('mobileVerifiedToast'),
            );
          }}
          onClose={() => setVerifyChannel(null)}
        />
      )}
    </>
  );
}
