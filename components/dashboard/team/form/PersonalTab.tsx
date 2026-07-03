'use client';
import { useEffect, useState } from 'react';
import { App, Button, Collapse, DatePicker, Form, Input, Select, type FormInstance } from 'antd';
import {
  CheckCircleFilled,
  PhoneOutlined,
  MailOutlined,
  NumberOutlined,
  LockOutlined,
  RightOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { FileUpload } from '@/components/ui';
import type { TeamMember, EmployeeCodeSettings } from '@/types';
import { isValidIndianMobile } from '@/lib/common/indian-mobile';
import { useMemberFormOptions } from './useMemberFormOptions';
import { useMobileClassification } from './useMobileClassification';
import { buildMobileClassificationHelp } from './MobileClassificationBanner';
import MobileOtpModal from './MobileOtpModal';
import { verifyMemberMobileNow } from '@/lib/actions/team.actions';
import { useMyPermissions } from '@/hooks/useMyPermissions';

const { Option } = Select;

interface PersonalTabProps {
  form: FormInstance;
  mode: 'view' | 'add' | 'edit';
  editMode: boolean;
  member: TeamMember | null;
  employeeCodeSettings: EmployeeCodeSettings | null;
  // Read-only preview of the auto-generated code (shown as a non-editable note in
  // add mode). The code itself is always system-assigned on save - never typed.
  employeeCodePreview: string;
  /**
   * Optional async validators that hit the workspace's
   * `team/check-identifier` endpoint to flag duplicate mobile / email
   * within the same workspace. Run after format/required validation
   * passes - see `useUniqueIdentifierValidator`.
   */
  mobileAvailabilityValidator?: (value: unknown) => Promise<void>;
  emailAvailabilityValidator?: (value: unknown) => Promise<void>;
  /**
   * Workspace ID - required to drive the mobile-classification banner.
   * Passed through from the parent wizard / edit page.
   */
  workspaceId?: string;
  /**
   * When in edit mode, the member's own ID is excluded from the collision
   * check so the existing mobile doesn't falsely report as a conflict.
   */
  excludeId?: string;
  /**
   * Phase 1f verify-later (2026-05-21): the profile page exposes a Verify
   * mobile CTA on the unverified pill. When the OTP modal confirms, the
   * BE returns a refreshed member document; the parent uses this callback
   * to update its local state without a full page refetch.
   */
  onMemberChange?: (member: TeamMember) => void;
}

export default function PersonalTab({
  form,
  mode,
  editMode,
  member,
  employeeCodeSettings,
  employeeCodePreview,
  mobileAvailabilityValidator,
  emailAvailabilityValidator,
  workspaceId,
  excludeId,
  onMemberChange,
}: PersonalTabProps) {
  const t = useTranslations('team');
  const tMc = useTranslations('team.addMember.mobileClassification');
  const { maritalStatusOptions } = useMemberFormOptions();
  // Verify-mobile is gated BE-side on `team.member.create` (the OTP
  // start/confirm + verify-existing endpoints all require it). Mirror that
  // permission on the FE so a view-only member never sees a "Verify mobile"
  // action they cannot perform (clicking would 403). Owners short-circuit to
  // true via the hook. The "unverified" LABEL stays visible to everyone -
  // only the actionable button is gated.
  const { canPath, data: myPerms } = useMyPermissions();
  const canVerifyMobile = canPath('team.member.create');
  // §7 Part B (read side) - mirror the BE read-filter
  // (`crewroster-backend/src/modules/team/team-read-filter.ts`): the personal-
  // DETAIL fields (gender, DOB, marital, blood group, address, emergency
  // contact) are gated by `personal.view`. Identity (name / mobile / email /
  // avatar) stays always visible (directory-level). Add mode + owner see all.
  const isOwnRecord = !!myPerms?.teamMemberId && myPerms.teamMemberId === (member?.id ?? '');
  const canViewPersonalDetail =
    mode === 'add' ||
    !!myPerms?.isOwner ||
    canPath('team.profile.personal.view', isOwnRecord ? 'self' : 'all');

  // Watch the mobile field value to drive the classification banner.
  const mobileValue = Form.useWatch('mobile', form) as string | undefined;
  const { status: mobileStatus, loading: mobileStatusLoading } = useMobileClassification({
    workspaceId: workspaceId ?? '',
    mobile: mobileValue,
    excludeId,
  });

  // Phase 1f (2026-05-21) mobile-OTP verification state.
  //
  // `mobileVerifyToken` holds the short-lived proof JWT returned by the BE
  // confirm endpoint once the employee enters the SMS code. It's mirrored
  // into a hidden Form.Item below so the create-team-member submit picks
  // it up and forwards it as `mobileVerifyToken` on the payload, which BE
  // validates via `MobileOtpService.assertProofToken` before stamping
  // `mobileVerifiedAt`.
  //
  // Any subsequent edit of the mobile field invalidates the token because
  // the proof is bound to a (workspaceId, mobile) pair; we clear both the
  // modal state and the cached token on value change to avoid submitting
  // a stale proof.
  const [mobileVerifyToken, setMobileVerifyToken] = useState<string | null>(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  // Phase 1f UX polish (2026-05-21): owner pressed "Skip verification" on
  // the registered banner. We track it locally so the banner can flip to
  // an acknowledgement state (with an "Undo" link) and the click has visible
  // feedback. Reset on mobile field change because a new mobile triggers
  // a fresh classification.
  const [mobileSkipped, setMobileSkipped] = useState(false);

  // Phase 1f verify-later (2026-05-21): on the profile page, the unverified
  // mobile pill turns into a clickable Verify button that opens its own OTP
  // modal. Distinct from `otpModalOpen` because the add-mode and edit-mode
  // flows submit through different BE endpoints (createTeamMember accepts a
  // proof token in the create payload; verifyMemberMobileNow stamps an
  // existing member).
  const [profileVerifyModalOpen, setProfileVerifyModalOpen] = useState(false);
  const { message } = App.useApp();

  useEffect(() => {
    // Drop any held token + close the modal when the user edits the mobile.
    // Intentional set-state-in-effect: we synchronize OTP proof state with
    // the externally-controlled mobile-field value. A stale proof bound to a
    // previous mobile value MUST be cleared before submit; deferring this to
    // a render handler would let the form pass an invalidated token to BE.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: invalidates stale OTP proof + closes modal when mobile field changes externally
    setMobileVerifyToken((prev) => {
      if (prev !== null) form.setFieldValue('mobileVerifyToken', undefined);
      return null;
    });
    setOtpModalOpen(false);
    setMobileSkipped(false);
  }, [mobileValue, form]);

  // Phase 1f UX consolidation (2026-05-21): the classification message + any
  // inline CTA (deep-link / OTP buttons) ride AntD's native Form.Item `help`
  // slot instead of a standalone Alert card. That keeps the message visually
  // flush with the existing form-validator error styling and lets CTAs sit
  // on the same line as the message instead of stacking below.
  //
  // Add-mode only: in view / edit mode the mobile is already saved and the
  // OTP-verify flow does not apply (re-verify on edit is out of Phase 1f
  // scope per the plan). Rendering the banner there would surface CTAs that
  // appear disabled (the surrounding form is read-only) and confuse the
  // owner, so we suppress the help payload entirely outside add mode.
  const mobileClassHelp =
    mode === 'add'
      ? buildMobileClassificationHelp({
          status: mobileStatus,
          loading: mobileStatusLoading,
          t: tMc,
          onVerifyClick: () => {
            setMobileSkipped(false);
            setOtpModalOpen(true);
          },
          onSkipClick: () => {
            setMobileVerifyToken(null);
            form.setFieldValue('mobileVerifyToken', undefined);
            setMobileSkipped(true);
          },
          verifiedToken: mobileVerifyToken ?? undefined,
          skipped: mobileSkipped,
        })
      : {};

  // Phase 1f verify-later help payload (2026-05-21). In view / edit mode the
  // Mobile field is wrapped by AntD's <Form disabled={!editMode}> which
  // propagates `disabled=true` through DisabledContext to every Button
  // descendant (verified in node_modules/antd/es/button/Button.js where
  // `useContext(DisabledContext)` overrides the merged disabled state when
  // no explicit `disabled` prop is provided). That made the previous suffix
  // / label-slot CTA non-clickable regardless of positioning. We now render
  // the CTA in the Form.Item `help` slot (outside the input control) AND
  // pass an explicit `disabled={false}` on the Button so it ignores the
  // form-level context and stays interactive in view mode.
  // Show the unverified-state row in view / edit mode for any member whose
  // mobile is not yet verified. The actionable "Verify mobile" button is
  // additionally gated on `canVerifyMobile` so view-only members see the
  // status but not an action they can't perform.
  const showViewModeVerifyState = mode !== 'add' && !!member?.mobile && !member?.mobileVerifiedAt;
  const viewModeVerifyHelp = showViewModeVerifyState ? (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[var(--cr-text-3,#6b7280)]">{t('mobileBadge.unverifiedLabel')}.</span>
      {canVerifyMobile && (
        <Button
          size="small"
          type="link"
          disabled={false}
          onClick={() => setProfileVerifyModalOpen(true)}
          aria-label={t('mobileBadge.verifyAriaLabel')}
          className="h-auto p-0 font-semibold"
        >
          {t('mobileBadge.verifyCta')}
        </Button>
      )}
    </span>
  ) : undefined;

  // Phase 1f verified-state badge (2026-05-22). After OTP confirm BE returns
  // the refreshed member with mobileVerifiedAt populated; the help slot then
  // shows a green tick + "Verified" label + date tooltip so the owner has a
  // visible trust signal that the verification stuck and the field state
  // moved on from "unverified".
  const showVerifiedBadge = mode !== 'add' && !!member?.mobile && !!member?.mobileVerifiedAt;
  const verifiedAtDate = member?.mobileVerifiedAt ? new Date(member.mobileVerifiedAt) : null;
  const verifiedHelp = showVerifiedBadge ? (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <CheckCircleFilled aria-hidden="true" className="text-[var(--cr-success-600,#16a34a)]" />
      <span className="font-medium text-[var(--cr-success-700,#15803d)]">
        {t('mobileBadge.verifiedLabel')}
      </span>
      {verifiedAtDate && !Number.isNaN(verifiedAtDate.getTime()) && (
        <span className="text-[var(--cr-text-3,#6b7280)]" title={verifiedAtDate.toLocaleString()}>
          ({verifiedAtDate.toLocaleDateString()})
        </span>
      )}
    </span>
  ) : undefined;

  return (
    <>
      {/* Section Header - eyebrow pattern matches WorkTab "EMPLOYMENT DETAILS" idiom */}
      <div className="mb-5 border-b border-gray-100 pb-2.5">
        <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
          {t('personalSectionTitle')}
        </p>
        <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
          {t('personalSectionHelper')}
        </p>
      </div>

      {/* Core Fields */}
      <div className="mb-6 flex flex-col gap-4">
        <Form.Item
          name="avatar"
          label={
            <span className="mb-1.5 block text-sm font-medium text-gray-600">
              {t('personalLabelProfilePhoto')}
            </span>
          }
          getValueFromEvent={(url) => url}
        >
          <FileUpload
            category="avatars"
            accept="image/jpeg,image/png,image/webp"
            variant="compact"
            disabled={!editMode}
          />
        </Form.Item>

        {/* Full name + auto-generated employee-code note. Employee codes are
            ALWAYS system-generated, immutable, and non-replaceable: the backend
            ignores any client-supplied code and assigns one embedding the
            workspace {WS} token on save. So there is NO writable code input here -
            only a read-only note. The format/preview is configured on the
            workspace Employee Code settings page. */}
        {mode === 'add' && employeeCodeSettings?.enabled ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="name"
              label={
                <span className="mb-1.5 block text-sm font-medium text-gray-600">
                  {t('personalLabelFullName')}
                  <span className="ml-1 text-[var(--cr-text-3)]">*</span>
                </span>
              }
              className="mb-0"
              rules={[{ required: true, message: t('personalRequiredName') }]}
            >
              <Input placeholder={t('personalPlaceholderName')} className="h-10 rounded-lg" />
            </Form.Item>

            {/* Read-only employee-code note (no Form.Item / no writable field):
                the code is generated automatically on save and cannot be edited. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-600">
                {t('personalLabelEmployeeCode')}
              </span>
              <div className="flex h-10 items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3">
                <NumberOutlined className="text-sm text-faint" />
                <span className="flex-1 truncate font-mono text-sm text-gray-500">
                  {employeeCodePreview || t('personalPlaceholderEmpCodeAuto')}
                </span>
                <LockOutlined
                  className="text-sm text-faint"
                  title={t('personalEmpCodeLockTitle')}
                />
              </div>
              <span className="text-xs text-faint">{t('personalEmpCodeGeneratedNote')}</span>
            </div>
          </div>
        ) : (
          <Form.Item
            name="name"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('personalLabelFullName')}
                <span className="ml-1 text-[var(--cr-text-3)]">*</span>
              </span>
            }
            style={{ maxInlineSize: '480px' }}
            rules={[{ required: true, message: t('personalRequiredName') }]}
          >
            <Input placeholder={t('personalPlaceholderName')} className="h-10 rounded-lg" />
          </Form.Item>
        )}

        {mode !== 'add' && !!member?.employeeCode && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-600">
              {t('personalLabelEmployeeCode')}
            </span>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3">
              <NumberOutlined className="text-sm text-faint" />
              <span className="flex-1 font-mono text-sm text-gray-700">{member.employeeCode}</span>
              <LockOutlined className="text-sm text-faint" title={t('personalEmpCodeLockTitle')} />
            </div>
            <span className="text-xs text-faint">{t('personalEmpCodePermanent')}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="mobile"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('personalLabelMobile')}
                {mode === 'add' && <span className="ml-1 text-[var(--cr-text-3)]">*</span>}
              </span>
            }
            className="mb-0"
            hasFeedback={!!mobileAvailabilityValidator}
            validateFirst
            // Phase 1f: AntD `help` + explicit `validateStatus` are sourced
            // from the mobile-classification result so the message colour, the
            // feedback icon, and the inline CTA (deep-link / OTP buttons) all
            // share one row instead of stacking below the field. When the
            // classifier is still in flight (`help` undefined), AntD falls
            // back to the auto-rendered validator error so submit gating
            // continues to surface a message during the debounce window.
            help={mobileClassHelp.help ?? viewModeVerifyHelp ?? verifiedHelp}
            validateStatus={
              mobileClassHelp.validateStatus ??
              (showViewModeVerifyState ? 'warning' : showVerifiedBadge ? 'success' : undefined)
            }
            rules={[
              {
                validator: (_, value) => {
                  if (!value || value.trim() === '') {
                    if (mode === 'add') return Promise.reject(t('personalRequiredMobile'));
                    return Promise.resolve();
                  }
                  if (!isValidIndianMobile(value))
                    return Promise.reject(t('personalInvalidMobile'));
                  return Promise.resolve();
                },
              },
              ...(mobileAvailabilityValidator
                ? [
                    {
                      validator: (_: unknown, value: unknown) => mobileAvailabilityValidator(value),
                    },
                  ]
                : []),
            ]}
          >
            <Input
              prefix={<PhoneOutlined className="text-faint" />}
              placeholder={t('personalPlaceholderMobile')}
              className="h-10 rounded-lg tabular-nums"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('personalLabelEmail')}
              </span>
            }
            className="mb-0"
            hasFeedback={!!emailAvailabilityValidator}
            validateFirst
            rules={[
              {
                validator: (_, value) => {
                  if (!value || value.trim() === '') return Promise.resolve();
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
                    return Promise.reject(t('personalInvalidEmail'));
                  return Promise.resolve();
                },
              },
              ...(emailAvailabilityValidator
                ? [{ validator: (_: unknown, value: unknown) => emailAvailabilityValidator(value) }]
                : []),
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-faint" />}
              placeholder={t('personalPlaceholderEmail')}
              className="h-10 rounded-lg"
            />
          </Form.Item>
        </div>

        {/* Phase 1f UX consolidation (2026-05-21): the classification message
            + any inline CTA now ride the Mobile Form.Item's `help` slot above
            (driven by `mobileClassHelp`) instead of rendering as a separate
            full-width Alert card here. */}

        {/* Phase 1f: hidden form field that propagates the OTP proof token to
            the create payload. Kept invisible because the value is opaque to
            the owner; see MobileOtpModal's onVerified handler. */}
        <Form.Item name="mobileVerifyToken" hidden>
          <Input type="hidden" />
        </Form.Item>

        {/* Phase 1f: OTP verification modal. Mounted in 'add' mode only because
            the edit flow does not currently allow mobile changes from this tab.
            workspaceId is guaranteed non-empty by the surrounding `if` because
            mode==='add' implies the wizard always seeds currentWorkspaceId. */}
        {mode === 'add' && workspaceId && mobileValue && (
          <MobileOtpModal
            open={otpModalOpen}
            workspaceId={workspaceId}
            mobile={mobileValue}
            onClose={() => setOtpModalOpen(false)}
            onVerified={(token) => {
              setMobileVerifyToken(token);
              form.setFieldValue('mobileVerifyToken', token);
            }}
          />
        )}

        {/* Phase 1f verify-later modal. Profile-page surface: owner clicks the
            unverified pill on the Mobile field to confirm the saved number. On
            successful OTP confirm we POST the proof token to the dedicated
            verify-existing-mobile endpoint, which stamps mobileVerifiedAt and
            returns the refreshed member doc; the parent updates local state
            via onMemberChange so the pill flips off without a refetch. */}
        {mode !== 'add' && workspaceId && member?.id && member?.mobile && (
          <MobileOtpModal
            open={profileVerifyModalOpen}
            workspaceId={workspaceId}
            mobile={member.mobile}
            onClose={() => setProfileVerifyModalOpen(false)}
            onVerified={async (token) => {
              try {
                const updated = await verifyMemberMobileNow(workspaceId, member.id, token);
                onMemberChange?.(updated);
                message.success(t('mobileBadge.verifiedToast'));
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Verification failed';
                message.error(msg);
              }
            }}
          />
        )}
      </div>

      {/* Card-style Collapse - matches WorkTab CTC Breakdown / Statutory & Tax pattern */}
      {canViewPersonalDetail && (
        <div className="mt-6">
          <Collapse
            ghost
            className="cr-card-collapse"
            expandIconPlacement="end"
            expandIcon={({ isActive }) => (
              <RightOutlined
                style={{
                  fontSize: 11,
                  color: 'var(--cr-text-3)',
                  transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
            )}
            items={[
              {
                key: 'additional',
                label: (
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--cr-info-50,#eff6ff)] text-[var(--cr-info-700,#1d4ed8)]">
                      <UserOutlined style={{ fontSize: 13 }} />
                    </span>
                    <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
                      {t('personalAdditionalTitle')}
                    </span>
                    <span className="ml-2 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {t('personalOptionalBadge')}
                    </span>
                  </div>
                ),
                children: (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Form.Item
                        name="gender"
                        label={
                          <span className="mb-1.5 block text-sm font-medium text-gray-600">
                            {t('personalLabelGender')}
                          </span>
                        }
                        className="mb-0"
                      >
                        <Select placeholder={t('personalPlaceholderGender')} className="rounded-lg">
                          <Option value="male">{t('personalGenderMale')}</Option>
                          <Option value="female">{t('personalGenderFemale')}</Option>
                          <Option value="other">{t('personalGenderOther')}</Option>
                        </Select>
                      </Form.Item>

                      <Form.Item
                        name="dateOfBirth"
                        label={
                          <span className="mb-1.5 block text-sm font-medium text-gray-600">
                            {t('personalLabelDateOfBirth')}
                          </span>
                        }
                        className="mb-0"
                      >
                        <DatePicker
                          className="w-full rounded-lg"
                          format="YYYY-MM-DD"
                          placeholder={t('personalPlaceholderDob')}
                        />
                      </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Form.Item
                        name="maritalStatus"
                        label={
                          <span className="mb-1.5 block text-sm font-medium text-gray-600">
                            {t('personalLabelMaritalStatus')}
                          </span>
                        }
                        className="mb-0"
                      >
                        <Select
                          placeholder={t('personalPlaceholderMarital')}
                          allowClear
                          className="rounded-lg"
                        >
                          {maritalStatusOptions.map((o) => (
                            <Option key={o.value} value={o.value}>
                              {o.label}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>

                      <Form.Item
                        name="bloodGroup"
                        label={
                          <span className="mb-1.5 block text-sm font-medium text-gray-600">
                            {t('personalLabelBloodGroup')}
                          </span>
                        }
                        className="mb-0"
                      >
                        <Select
                          placeholder={t('personalPlaceholderBlood')}
                          allowClear
                          className="rounded-lg"
                        >
                          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => (
                            <Option key={b} value={b}>
                              {b}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </div>

                    <Form.Item
                      name="address"
                      label={
                        <span className="mb-1.5 block text-sm font-medium text-gray-600">
                          {t('personalLabelAddress')}
                        </span>
                      }
                    >
                      <Input.TextArea
                        rows={2}
                        placeholder={t('personalPlaceholderAddress')}
                        className="rounded-lg"
                      />
                    </Form.Item>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Form.Item
                        name="emergencyContactName"
                        label={
                          <span className="mb-1.5 block text-sm font-medium text-gray-600">
                            {t('personalLabelEmergencyName')}
                          </span>
                        }
                        className="mb-0"
                      >
                        <Input
                          placeholder={t('personalPlaceholderEmergencyName')}
                          className="h-10 rounded-lg"
                        />
                      </Form.Item>

                      <Form.Item
                        name="emergencyContactNumber"
                        label={
                          <span className="mb-1.5 block text-sm font-medium text-gray-600">
                            {t('personalLabelEmergencyNumber')}
                          </span>
                        }
                        className="mb-0"
                        rules={[
                          {
                            validator: (_, value) => {
                              if (!value || value.trim() === '') return Promise.resolve();
                              if (!isValidIndianMobile(value))
                                return Promise.reject(t('personalInvalidEmergencyMobile'));
                              return Promise.resolve();
                            },
                          },
                        ]}
                      >
                        <Input
                          placeholder={t('personalPlaceholderMobile')}
                          className="h-10 rounded-lg tabular-nums"
                        />
                      </Form.Item>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </>
  );
}
