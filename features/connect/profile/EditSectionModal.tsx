'use client';

/**
 * EditSectionModal - focused per-section profile editor.
 *
 * Replaces the previous all-in-one `ProfileEditForm` (a single giant form
 * editing every section together, with a global Save at the bottom of a
 * long-scroll page). The new pattern mirrors LinkedIn / Facebook: each
 * profile section carries a small pencil affordance, opening this modal
 * focused on just that section. Save patches only that section's fields
 * via `updateMyConnectProfile` - partial-update friendly thanks to the
 * existing `connectProfileUpdateSchema`.
 *
 * One modal, switched by the `section` prop, instead of seven sibling
 * modal files. The form fragments are local building blocks below.
 *
 * Sections:
 *  - `header`       - banner image + headline (+ open-to toggles via
 *                     `EditOpenToModal` flow live in this same modal -
 *                     see `header` body).
 *  - `about`        - bio textarea.
 *  - `skills`       - tag selector.
 *  - `rates`        - daily / piece / monthly rates.
 *  - `openTo`       - work / hiring / deals / customOrders toggles
 *                     (lives as its own section - the chip row reads
 *                     prominently enough on the profile that owners
 *                     find it easier to tweak in isolation).
 *  - `portfolio`    - work-samples list editor.
 *  - `experience`   - workshops / roles / dates list editor.
 *  - `visibility`   - single Select.
 */

import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AutoComplete,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  message,
} from 'antd';
import { DsModal } from '@/components/ui/DsModal';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { InfoTooltip } from '@/components/ui';
import DsButton from '@/components/ui/DsButton';
import { FileUpload } from '@/components/ui/FileUpload';
// Intro-video grid (video mode) + the policy-driven duration cap. Same proven
// pieces the marketplace ListingForm uses for the product clip; the only change
// is the upload category (`connect-profile-video`). Keep the cap read from the
// policy (never a second hardcoded number) so it stays in step with the grid's
// own client-side pre-check.
import MediaUploadGrid from '@/components/connect/MediaUploadGrid';
// State -> District picker over the shared india-geo dataset. Replaces the old
// free-text district Input so the saved `district` is a CANONICAL name that the
// boost region-targeting matcher (ads/lib/targeting-normalize) can match; it
// also writes geoStateSlug/geoDistrictSlug. Same dataset the boost composer's
// AudienceGeoTradeFields targets against, so a profile here matches a boost there.
import StateDistrictPicker, {
  EMPTY_STATE_DISTRICT,
  type StateDistrictValue,
} from '@/features/connect/geo/StateDistrictPicker';
import { getUploadPolicy } from '@/lib/upload-policies.helpers';
import { uploadService } from '@/lib/services/upload.service';
import { searchCompanyPages, updateMyConnectProfile } from '../profile.actions';
import type { CompanyPageRef } from '../feed.types';
import { updateProfile } from '@/lib/actions';
import { useAuthStore } from '@/lib/store';
import type {
  ConnectProfile,
  ConnectProfileVisibility,
  ConnectRateCard,
  ConnectPortfolioItem,
  ConnectExperienceItem,
  ConnectTrainingItemWrite,
  ConnectOpenTo,
} from '../profile.types';
import { connectProfileUpdateSchema, paiseToRupees, rupeesToPaise } from './profile-edit-schema';

/** The named profile sections that own their own edit modal. */
export type ProfileEditSection =
  | 'header'
  | 'about'
  | 'skills'
  | 'rates'
  | 'openTo'
  | 'portfolio'
  | 'experience'
  // Training / course credentials (self-declared). Clones the experience editor
  // pattern with an institute link picker (institute CompanyPage, company-pages
  // module); see TrainingFields below.
  | 'training'
  | 'services'
  // Intro video - one short clip. Reuses the marketplace listing video pattern
  // (MediaUploadGrid video mode + the `connect-profile-video` upload policy).
  | 'videos'
  | 'visibility';

/** Map a strength-checklist key to the section modal that owns that field. */
export function strengthKeyToSection(key: string): ProfileEditSection {
  switch (key) {
    case 'headline':
    case 'banner':
      return 'header';
    case 'bio':
      return 'about';
    case 'skills':
      return 'skills';
    case 'rateCard':
      return 'rates';
    case 'portfolio':
      return 'portfolio';
    case 'experience':
      return 'experience';
    case 'services':
      return 'services';
    default:
      return 'header';
  }
}

const SKILL_SUGGESTIONS = [
  'Zari',
  'Sequins',
  'Aari',
  'Thread work',
  'Hand embroidery',
  'Computerized embroidery',
  'Multi-head machine',
  'Mirror work',
  'Beadwork',
  'Cutwork',
  'Stone work',
  'Pattern making',
];

// The schema + backend carry all four openTo intents; the editor EXPOSES the
// subset below. `customOrders` is reframed as "Providing services" (freelancer /
// job-work layer, pairs with the profile Services section) and is INDEPENDENT -
// a person can be open to work AND providing services. `deals` stays paused
// (revive via `rg "PAUSED 2026-06-09 . Connect open-to"` + add to this list +
// IntentCards INTENT_ORDER + the ribbon).
// `work` and `hiring` remain mutually exclusive - opposite sides of the labour
// market. The form flips one off when the other turns on (SectionForm
// onValuesChange) and the zod schema rejects both-on as a backstop; customOrders
// is untouched by that exclusion.
const VISIBLE_OPEN_TO_KEYS = ['work', 'hiring', 'customOrders'] as const;
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

// Intro-video duration cap (seconds), read from the upload policy (not
// hardcoded) so the help copy matches the cap MediaUploadGrid enforces.
const profileVideoMaxSec = getUploadPolicy('connect-profile-video').duration?.max ?? 60;

interface EditSectionModalProps {
  /** Whether the modal is mounted. The parent owns the state. */
  open: boolean;
  /** Which section's form to render. */
  section: ProfileEditSection;
  /** Current profile - used as initial values + reference for unchanged fields. */
  profile: ConnectProfile;
  /** Called with the persisted profile after a successful save. */
  onSaved: (updated: ConnectProfile) => void;
  /** Called when the modal closes (Cancel / Esc / click-outside / after Save). */
  onClose: () => void;
}

export default function EditSectionModal({
  open,
  section,
  profile,
  onSaved,
  onClose,
}: EditSectionModalProps) {
  const t = useTranslations('connect.profile');
  const tRate = useTranslations('connect.rateRow');
  const [messageApi, messageCtx] = message.useMessage();
  const [saving, setSaving] = useState(false);
  // The avatar lives on `User`, not on `ConnectProfile` (identity model -
  // canonical identity stays on the user record; Connect adds its own
  // banner + headline alongside). Read the current avatar URL + writer
  // from the auth store so the header modal can edit the profile photo
  // inline without forcing the owner to `/account/profile`.
  const currentAvatar = useAuthStore((s) => s.user?.profilePicture ?? '');
  const updateUserStore = useAuthStore((s) => s.updateUser);

  const title = sectionTitle(section, t, tRate);

  /**
   * Resolve any `FileUpload` value (URL string or pending `File`) into a
   * stored URL - uploads pending files first. Shared by header (banner)
   * and portfolio (per-item image).
   */
  async function resolveUpload(
    value: string | File | undefined,
    category: 'connect-banners' | 'connect-portfolio' | 'avatars',
  ): Promise<string> {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const res = await uploadService.uploadSingle(value, { category });
    return res.url;
  }

  /**
   * Section-specific submit. Builds a partial payload from the form values
   * and patches the profile via `updateMyConnectProfile`. The action
   * validates against the existing zod schema, so each section's payload
   * is checked in the same way the all-in-one form's was.
   */
  async function handleSubmit(values: Record<string, unknown>): Promise<void> {
    setSaving(true);
    try {
      // Header section spans two stores: avatar lives on `User`
      // (canonical identity), banner + headline live on `ConnectProfile`.
      // We update User first (so a downstream `<DsAvatar>` sees the new
      // avatar via `updateUser`), then patch the Connect profile.
      // Sequential - if avatar save fails we surface the error and skip
      // the second PATCH so the two stores never half-persist.
      if (section === 'header') {
        const rawAvatar = values.avatar as string | File | undefined;
        const nextAvatar = await resolveUpload(rawAvatar, 'avatars');
        if (nextAvatar !== currentAvatar) {
          try {
            const updated = await updateProfile({ profilePicture: nextAvatar });
            if (updated?.profilePicture !== undefined) {
              updateUserStore({ profilePicture: updated.profilePicture });
            }
          } catch {
            messageApi.error(t('edit.uploadFailed'));
            return;
          }
        }
      }

      const payload = await buildSectionPayload(section, values, profile, resolveUpload);
      const parsed = connectProfileUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        messageApi.error(t('edit.invalid'));
        return;
      }
      const res = await updateMyConnectProfile(parsed.data);
      if (res.ok) {
        messageApi.success(t('edit.saved'));
        onSaved(res.data);
        onClose();
      } else {
        messageApi.error(res.error);
      }
    } catch {
      messageApi.error(t('edit.uploadFailed'));
    } finally {
      setSaving(false);
    }
  }

  // Use the shared `DsModal` (defaults `scrollable: true` with
  // `maxHeight: calc(100vh - 200px)` on the body) so long sections
  // (portfolio / experience list editors) scroll INSIDE the modal while
  // the title bar + Save/Cancel footer stay pinned. Earlier shipped with
  // a bare AntD `<Modal>`, which let the modal grow taller than the
  // viewport and the whole page scrolled instead.
  return (
    <DsModal
      open={open}
      title={title}
      onCancel={() => (saving ? undefined : onClose())}
      footer={null}
      destroyOnHidden
      width={
        section === 'portfolio' || section === 'experience' || section === 'training' ? 720 : 560
      }
      mask={{ closable: !saving }}
      keyboard={!saving}
    >
      {messageCtx}
      <SectionForm
        section={section}
        profile={profile}
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={onClose}
      />
    </DsModal>
  );
}

/* ── Internal: per-section form ────────────────────────────────────────── */

interface SectionFormProps {
  section: ProfileEditSection;
  profile: ConnectProfile;
  saving: boolean;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

function SectionForm({ section, profile, saving, onSubmit, onCancel }: SectionFormProps) {
  const t = useTranslations('connect.profile');
  const tRate = useTranslations('connect.rateRow');
  const [form] = Form.useForm();
  // Read current avatar for the header form's `avatar` field seed. The
  // header modal edits both the User avatar and the ConnectProfile
  // banner/headline - `extractInitialValues` reads this from the auth
  // store so the FileUpload starts pre-populated.
  const currentAvatar = useAuthStore((s) => s.user?.profilePicture ?? '');

  // Section-specific initial values - only the fields that section edits.
  // Keeps the form state focused so AntD's `disabled={saving}` etc. behave
  // and the submit handler receives clean, scoped values.
  const initialValues = useMemo(
    () => extractInitialValues(section, profile, currentAvatar),
    [section, profile, currentAvatar],
  );

  // ── Intro video state (video section only) ─────────────────────────────────
  // The MediaUploadGrid (video mode) lives OUTSIDE the AntD Form value model:
  // it owns the uploaded clip URL(s) + the {videoUrl -> posterUrl} map it
  // captures, so we hold them in React state here (mirrors ListingForm). The
  // existing clip both seeds the grid AND lets us fall back to its already-
  // stored poster on save, so an unrelated edit never strips a poster. On submit
  // we splice the built `videos` array into the form values before they reach
  // `onSubmit` (the AntD Form has no field for them).
  const initialVideos = useMemo(
    () => (section === 'videos' ? (profile.videos ?? []) : []),
    [section, profile.videos],
  );
  const initialVideoUrls = useMemo(() => initialVideos.map((v) => v.url), [initialVideos]);
  const initialPosterByUrl = useMemo(
    () =>
      Object.fromEntries(
        initialVideos.filter((v) => v.posterUrl).map((v) => [v.url, v.posterUrl!]),
      ),
    [initialVideos],
  );
  const [videoUrls, setVideoUrls] = useState<string[]>(initialVideoUrls);
  // Newly captured posters only (the grid emits a {videoUrl -> posterUrl} map of
  // freshly captured frames). At save these are merged over `initialPosterByUrl`
  // so an untouched existing clip keeps its poster.
  const [capturedPosterByUrl, setCapturedPosterByUrl] = useState<Record<string, string>>({});

  // Build the partial payload, then for the video section attach the `videos`
  // array (always sent, like portfolio/services, so removing the clip actually
  // clears it under the PATCH-omits-stay semantics). Each clip's poster is the
  // freshly captured one, else the existing stored poster.
  const handleFinish = (values: Record<string, unknown>) => {
    if (section === 'videos') {
      values.videos = videoUrls.map((url) => {
        const posterUrl = capturedPosterByUrl[url] ?? initialPosterByUrl[url];
        return posterUrl ? { url, posterUrl } : { url };
      });
    }
    return onSubmit(values);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={initialValues}
      onFinish={handleFinish}
      disabled={saving}
      onValuesChange={(changed) => {
        // Open-to: `work` and `hiring` are mutually exclusive. Turning one on
        // flips the other off so the profile never advertises both at once.
        if (section !== 'openTo') return;
        const ot = changed.openTo as { work?: boolean; hiring?: boolean } | undefined;
        if (!ot) return;
        if (ot.work === true) form.setFieldValue(['openTo', 'hiring'], false);
        else if (ot.hiring === true) form.setFieldValue(['openTo', 'work'], false);
      }}
    >
      {section === 'header' && <HeaderFields t={t} />}
      {section === 'about' && <AboutFields t={t} />}
      {section === 'skills' && <SkillsFields t={t} />}
      {section === 'rates' && <RatesFields t={t} tRate={tRate} />}
      {section === 'openTo' && <OpenToFields t={t} />}
      {section === 'portfolio' && <PortfolioFields t={t} />}
      {section === 'experience' && <ExperienceFields t={t} />}
      {section === 'training' && <TrainingFields t={t} />}
      {section === 'services' && <ServicesFields t={t} />}
      {section === 'videos' && (
        <VideoFields
          t={t}
          initialUrls={initialVideoUrls}
          onChange={setVideoUrls}
          onPosters={setCapturedPosterByUrl}
        />
      )}
      {section === 'visibility' && <VisibilityFields t={t} />}

      <div
        className="mt-4 flex justify-end gap-2 border-t pt-4"
        style={{ borderColor: 'var(--cr-border-light)' }}
      >
        <DsButton dsVariant="ghost" onClick={onCancel} disabled={saving}>
          {t('edit.cancel')}
        </DsButton>
        <DsButton dsVariant="primary" htmlType="submit" loading={saving}>
          {t('edit.save')}
        </DsButton>
      </div>
    </Form>
  );
}

/* ── Section field groups ─────────────────────────────────────────────── */

function HeaderFields({ t }: { t: ReturnType<typeof useTranslations> }) {
  // Broker / dalal toggle copy lives under its own `connect.broker` namespace
  // (Slice 1) so the label/help are reusable outside the edit modal too.
  const tBroker = useTranslations('connect.broker');
  return (
    <>
      {/* Profile photo (avatar) - lives on `User`, not `ConnectProfile`.
          Lifted into this modal so owners can update it without routing
          to `/account/profile`. Persisted via `updateProfile` in the
          parent submit handler; the existing `avatars` upload category +
          PATCH `/users/profile` path are reused. */}
      <Form.Item name="avatar" label={t('edit.avatar')} extra={t('edit.avatarHint')}>
        <FileUpload category="avatars" accept={IMAGE_ACCEPT} />
      </Form.Item>
      <Form.Item name="banner" label={t('edit.banner')} extra={t('edit.bannerHint')}>
        <FileUpload category="connect-banners" accept={IMAGE_ACCEPT} />
      </Form.Item>
      <Form.Item
        name="headline"
        label={
          <LabelWithHelp
            text={t('edit.headline')}
            helpTitle={t('edit.headlineHelpTitle')}
            help={t('edit.headlineHelp')}
          />
        }
        rules={[{ max: 160, message: t('edit.headlineMax') }]}
      >
        <Input placeholder={t('edit.headlinePlaceholder')} maxLength={160} showCount />
      </Form.Item>
      {/* Location: State -> District over india-geo. The Form.Item value is the
          canonical triple { district (NAME), geoStateSlug, geoDistrictSlug };
          buildSectionPayload spreads it into the PATCH so the saved `district`
          is a name the boost matcher matches + the slugs are stored alongside. */}
      <Form.Item name="location" label={t('edit.district')} extra={t('edit.districtHint')}>
        <StateDistrictPicker
          value={EMPTY_STATE_DISTRICT}
          onChange={() => {}}
          stateLabel={t('edit.locationState')}
          districtLabel={t('edit.locationDistrict')}
          statePlaceholder={t('edit.locationStatePlaceholder')}
          districtPlaceholder={t('edit.locationDistrictPlaceholder')}
        />
      </Form.Item>
      {/* Broker / dalal self-declaration (Broker badge, Slice 1). A single
          on/off Switch; when on, the public profile + entity cards show a
          "Broker" trust badge (TrustBadgeRow 'broker'). The BE stamps
          `brokerSince` on the first enable. Mirrors the OpenToFields Switch
          (valuePropName="checked"); persisted via buildSectionPayload -> isBroker. */}
      <div
        className="flex flex-col gap-2 p-3"
        style={{ border: '1px solid var(--cr-border)', borderRadius: 'var(--cr-radius-md)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--cr-text-2)' }}>
            {tBroker('toggleLabel')}
          </span>
          <Form.Item name="isBroker" valuePropName="checked" noStyle>
            <Switch aria-label={tBroker('toggleLabel')} />
          </Form.Item>
        </div>
        <p className="m-0 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
          {tBroker('toggleHelp')}
        </p>
      </div>
    </>
  );
}

function AboutFields({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Form.Item name="bio" label={t('edit.bio')} rules={[{ max: 2000, message: t('edit.bioMax') }]}>
      <Input.TextArea rows={6} maxLength={2000} showCount placeholder={t('edit.bioPlaceholder')} />
    </Form.Item>
  );
}

function SkillsFields({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Form.Item
      name="skills"
      label={
        <LabelWithHelp
          text={t('edit.skills')}
          helpTitle={t('edit.skillsHelpTitle')}
          help={t('edit.skillsHelp')}
        />
      }
    >
      <Select
        mode="tags"
        placeholder={t('edit.skillsPlaceholder')}
        tokenSeparators={[',']}
        options={SKILL_SUGGESTIONS.map((s) => ({ value: s, label: s }))}
      />
    </Form.Item>
  );
}

function RatesFields({
  t,
  tRate,
}: {
  t: ReturnType<typeof useTranslations>;
  tRate: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      <div className="mb-3 flex items-center gap-1.5">
        <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {tRate('help')}
        </p>
        <InfoTooltip text={tRate('helpTitle')} body={tRate('help')} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Form.Item name={['rateCard', 'dailyWage']} label={tRate('dailyWage')}>
          <InputNumber min={0} prefix="₹" className="w-full" placeholder="0" />
        </Form.Item>
        <Form.Item name={['rateCard', 'pieceRate']} label={tRate('pieceRate')}>
          <InputNumber min={0} prefix="₹" className="w-full" placeholder="0" />
        </Form.Item>
        <Form.Item name={['rateCard', 'monthly']} label={tRate('monthly')}>
          <InputNumber min={0} prefix="₹" className="w-full" placeholder="0" />
        </Form.Item>
      </div>
      <p className="m-0 mt-1 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
        {t('edit.invalid')}
      </p>
    </>
  );
}

// Each "open to" intent now carries its on/off Switch PLUS an optional
// detail line (max 160 chars) and an audience selector (Everyone / My
// network). Detail + audience persist into the additive `openToDetails`
// field (backed by `connectProfileUpdateSchema.openToDetails`); the
// boolean toggle still lives at `openTo.<key>`. Keep the two in sync -
// the public profile chip row reads `openTo` for the on/off state and
// `openToDetails` for the caption + who-can-see scope.
function OpenToFields({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
        {t('openTo.help')}
      </p>
      <p className="m-0 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
        {t('openTo.exclusiveHint')}
      </p>
      {VISIBLE_OPEN_TO_KEYS.map((key) => (
        <div
          key={key}
          className="flex flex-col gap-2 p-3"
          style={{
            border: '1px solid var(--cr-border)',
            borderRadius: 'var(--cr-radius-md)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--cr-text-2)' }}>
              {t(`openTo.${key}`)}
            </span>
            <Form.Item name={['openTo', key]} valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </div>
          <Form.Item name={['openToDetails', key, 'detail']} noStyle>
            <Input maxLength={160} showCount placeholder={t(`intents.${key}.detailPlaceholder`)} />
          </Form.Item>
          {/* No field-level initialValue: the form-level initialValues
              (extractInitialValues) already seeds audience to 'all' for every
              key. Setting both makes AntD warn "Form already set initialValues
              ... can not overwrite it". Keep the seed in one place. */}
          <Form.Item name={['openToDetails', key, 'audience']} noStyle>
            <Select
              options={[
                { value: 'all', label: t('intents.audience.all') },
                { value: 'network', label: t('intents.audience.network') },
              ]}
            />
          </Form.Item>
        </div>
      ))}
    </div>
  );
}

function PortfolioFields({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Form.List name="portfolio">
      {(fields, { add, remove }) => (
        <div className="flex flex-col gap-3">
          {fields.length === 0 && (
            <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('empty.portfolio')}
            </p>
          )}
          {fields.map((field) => (
            <div
              key={field.key}
              className="flex flex-col gap-2 p-3"
              style={{
                background: 'var(--cr-surface-2)',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-md)',
              }}
            >
              <Form.Item name={[field.name, 'image']} label={t('edit.portfolioImage')}>
                <FileUpload category="connect-portfolio" accept={IMAGE_ACCEPT} />
              </Form.Item>
              <Form.Item name={[field.name, 'caption']} label={t('edit.portfolioCaption')}>
                <Input maxLength={280} placeholder={t('edit.portfolioCaptionPlaceholder')} />
              </Form.Item>
              <div className="grid gap-3 sm:grid-cols-2">
                <Form.Item name={[field.name, 'machineType']} label={t('edit.machineType')}>
                  <Input maxLength={80} placeholder={t('edit.machineTypePlaceholder')} />
                </Form.Item>
                <Form.Item name={[field.name, 'workType']} label={t('edit.workType')}>
                  <Input maxLength={80} placeholder={t('edit.workTypePlaceholder')} />
                </Form.Item>
              </div>
              <div>
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  onClick={() => remove(field.name)}
                  icon={<Trash2 size={14} aria-hidden />}
                >
                  {t('edit.remove')}
                </DsButton>
              </div>
            </div>
          ))}
          <div>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              onClick={() => add({})}
              icon={<Plus size={14} aria-hidden />}
            >
              {t('edit.addPortfolio')}
            </DsButton>
          </div>
        </div>
      )}
    </Form.List>
  );
}

function ExperienceFields({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Form.List name="experience">
      {(fields, { add, remove }) => (
        <div className="flex flex-col gap-3">
          {fields.length === 0 && (
            <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('empty.experience')}
            </p>
          )}
          {fields.map((field) => (
            <div
              key={field.key}
              className="flex flex-col gap-2 p-3"
              style={{
                background: 'var(--cr-surface-2)',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-md)',
              }}
            >
              {/* Company link: AutoComplete lets the owner pick a platform
                  CompanyPage (suggestions from searchCompanyPages -> sets the
                  hidden companyPageId) OR free-type a company name not on the
                  platform (companyPageId stays null). `workshop` remains the
                  required display name either way. */}
              <CompanyLinkField fieldName={field.name} t={t} />
              {/* Hidden id holder, kept in sync by CompanyLinkField. */}
              <Form.Item name={[field.name, 'companyPageId']} noStyle hidden>
                <Input type="hidden" />
              </Form.Item>
              {/* Role is required (owner's choice): a work-history entry must
                  say what the person did, not just where. */}
              <Form.Item
                name={[field.name, 'role']}
                label={t('edit.role')}
                rules={[
                  { required: true, message: t('edit.roleRequired') },
                  { max: 120, message: t('edit.roleMax') },
                ]}
              >
                <Input maxLength={120} placeholder={t('edit.rolePlaceholder')} />
              </Form.Item>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Start date is required so the timeline always has an anchor. */}
                <Form.Item
                  name={[field.name, 'from']}
                  label={t('edit.from')}
                  rules={[{ required: true, message: t('edit.fromRequired') }]}
                >
                  <DatePicker picker="month" format="MMM YYYY" className="w-full" />
                </Form.Item>
                {/* End date is hidden when "I currently work here" is checked -
                    an ongoing job has no end (buildSectionPayload strips `to`).
                    `shouldUpdate` re-renders this cell when `current` flips. */}
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) =>
                    prev.experience?.[field.name]?.current !== cur.experience?.[field.name]?.current
                  }
                >
                  {({ getFieldValue }) =>
                    getFieldValue(['experience', field.name, 'current']) ? null : (
                      <Form.Item
                        name={[field.name, 'to']}
                        label={t('edit.to')}
                        extra={t('edit.toHint')}
                      >
                        <DatePicker picker="month" format="MMM YYYY" className="w-full" />
                      </Form.Item>
                    )
                  }
                </Form.Item>
              </div>
              {/* Non-persisted helper: when checked, the job is ongoing and the
                  end date is hidden + dropped on save. Not sent to the API. */}
              <Form.Item name={[field.name, 'current']} valuePropName="checked" noStyle>
                <Checkbox>{t('edit.currentlyHere')}</Checkbox>
              </Form.Item>
              <Form.Item name={[field.name, 'description']} label={t('edit.description')}>
                <Input.TextArea
                  rows={2}
                  maxLength={1000}
                  placeholder={t('edit.descriptionPlaceholder')}
                />
              </Form.Item>
              <div>
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  onClick={() => remove(field.name)}
                  icon={<Trash2 size={14} aria-hidden />}
                >
                  {t('edit.remove')}
                </DsButton>
              </div>
            </div>
          ))}
          <div>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              onClick={() => add({})}
              icon={<Plus size={14} aria-hidden />}
            >
              {t('edit.addExperience')}
            </DsButton>
          </div>
        </div>
      )}
    </Form.List>
  );
}

// Training / course credentials - a Form.List editor cloned from ExperienceFields
// (self-declared, no verification). Each row: an institute link picker
// (InstituteLinkField -> writes the hidden companyPageId for a platform institute
// CompanyPage, company-pages module, OR leaves it null for a free-typed name), an
// optional course name, a single month DatePicker for the completion month, and
// an optional https certificate URL. Persists to the additive `training` field
// (backed by connectProfileUpdateSchema.training). Shown in ProfileView's
// Training section. NB: dropped experience's from/to + "currently here" machinery
// - a credential has a single completion month, not an open-ended range.
function TrainingFields({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Form.List name="training">
      {(fields, { add, remove }) => (
        <div className="flex flex-col gap-3">
          {fields.length === 0 && (
            <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('empty.training')}
            </p>
          )}
          {fields.map((field) => (
            <div
              key={field.key}
              className="flex flex-col gap-2 p-3"
              style={{
                background: 'var(--cr-surface-2)',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-md)',
              }}
            >
              {/* Institute link: AutoComplete lets the owner pick a platform
                  institute CompanyPage (suggestions from searchCompanyPages ->
                  sets the hidden companyPageId) OR free-type a name not on the
                  platform (companyPageId stays null). `instituteName` is the
                  required display name either way. */}
              <InstituteLinkField fieldName={field.name} t={t} />
              {/* Hidden companyPageId holder, kept in sync by InstituteLinkField. */}
              <Form.Item name={[field.name, 'companyPageId']} noStyle hidden>
                <Input type="hidden" />
              </Form.Item>
              {/* Hidden stable id holder (Phase 2): round-tripped from the seed so
                  saving an existing credential preserves its server id. New rows
                  carry no id; the server assigns one. The confirm flow keys off
                  this id (company-pages module credential-requests). */}
              <Form.Item name={[field.name, 'id']} noStyle hidden>
                <Input type="hidden" />
              </Form.Item>
              <Form.Item
                name={[field.name, 'course']}
                label={t('edit.course')}
                rules={[{ max: 120, message: t('edit.courseMax') }]}
              >
                <Input maxLength={120} placeholder={t('edit.coursePlaceholder')} />
              </Form.Item>
              {/* Single completion month - a credential is earned once, so there
                  is no from/to range or "currently here" toggle (unlike
                  experience). Month granularity matches the experience pickers. */}
              <Form.Item name={[field.name, 'completedAt']} label={t('edit.completedAt')}>
                <DatePicker picker="month" format="MMM YYYY" className="w-full" />
              </Form.Item>
              {/* Optional self-supplied certificate link (https). Surfaced in
                  ProfileView as a "View certificate" link. */}
              <Form.Item
                name={[field.name, 'certificateUrl']}
                label={t('edit.certificateUrl')}
                rules={[{ type: 'url', message: t('edit.certificateUrlInvalid') }]}
              >
                <Input placeholder={t('edit.certificateUrlPlaceholder')} />
              </Form.Item>
              {/* Institute-linked controls (Phase 2). Both Switches are shown
                  ONLY when this row links an on-platform institute CompanyPage
                  (companyPageId set by InstituteLinkField): asking a free-typed
                  institute to confirm, or showing yourself on its page, makes no
                  sense. `shouldUpdate` re-renders this block when the hidden
                  companyPageId flips (pick/clear in the AutoComplete above).
                  - requestConfirm -> mapped to confirmStatus on submit (pending
                    when on, else self); modeled on the OpenToFields Switch.
                  - shareWithInstitute -> per-credential DPDP opt-in (default OFF)
                    to the institute's public alumni/placements page. */}
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) =>
                  prev.training?.[field.name]?.companyPageId !==
                  cur.training?.[field.name]?.companyPageId
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue(['training', field.name, 'companyPageId']) ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px]" style={{ color: 'var(--cr-text-2)' }}>
                          {t('edit.askConfirmLabel')}
                        </span>
                        <Form.Item
                          name={[field.name, 'requestConfirm']}
                          valuePropName="checked"
                          noStyle
                        >
                          {/* AntD Switch renders role="switch" with no inherent
                              accessible name; the visible <span> beside it is not
                              programmatically linked, so name the control
                              explicitly for screen readers (WCAG 4.1.2). */}
                          <Switch aria-label={t('edit.askConfirmLabel')} />
                        </Form.Item>
                      </div>
                      <p className="m-0 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
                        {t('edit.askConfirmHint')}
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px]" style={{ color: 'var(--cr-text-2)' }}>
                          {t('edit.shareWithInstituteLabel')}
                        </span>
                        <Form.Item
                          name={[field.name, 'shareWithInstitute']}
                          valuePropName="checked"
                          noStyle
                        >
                          {/* Name the per-credential opt-in Switch for screen
                              readers (the visible <span> is not linked). */}
                          <Switch aria-label={t('edit.shareWithInstituteLabel')} />
                        </Form.Item>
                      </div>
                      <p className="m-0 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
                        {t('edit.shareWithInstituteHint')}
                      </p>
                    </div>
                  ) : null
                }
              </Form.Item>
              <div>
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  onClick={() => remove(field.name)}
                  icon={<Trash2 size={14} aria-hidden />}
                >
                  {t('edit.remove')}
                </DsButton>
              </div>
            </div>
          ))}
          <div>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              onClick={() => add({})}
              icon={<Plus size={14} aria-hidden />}
            >
              {t('edit.addTraining')}
            </DsButton>
          </div>
        </div>
      )}
    </Form.List>
  );
}

// Services I provide - a Form.List editor mirroring PortfolioFields. Each row
// is a required service title + an optional one-line note, plus Remove; an Add
// button appends a blank row. Persists to the additive `services` field
// (backed by connectProfileUpdateSchema.services). Shown in ProfileView's
// Services section.
function ServicesFields({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Form.List name="services">
      {(fields, { add, remove }) => (
        <div className="flex flex-col gap-3">
          {fields.length === 0 && (
            <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('empty.services')}
            </p>
          )}
          {fields.map((field) => (
            <div
              key={field.key}
              className="flex flex-col gap-2 p-3"
              style={{
                background: 'var(--cr-surface-2)',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-md)',
              }}
            >
              <Form.Item
                name={[field.name, 'title']}
                label={t('sections.services')}
                rules={[{ required: true, message: t('edit.serviceTitleRequired') }, { max: 120 }]}
              >
                <Input maxLength={120} placeholder={t('edit.serviceTitlePlaceholder')} />
              </Form.Item>
              <Form.Item name={[field.name, 'note']} label={t('edit.serviceNotePlaceholder')}>
                <Input maxLength={160} placeholder={t('edit.serviceNotePlaceholder')} />
              </Form.Item>
              <div>
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  onClick={() => remove(field.name)}
                  icon={<Trash2 size={14} aria-hidden />}
                >
                  {t('edit.remove')}
                </DsButton>
              </div>
            </div>
          ))}
          <div>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              onClick={() => add({})}
              icon={<Plus size={14} aria-hidden />}
            >
              {t('edit.addService')}
            </DsButton>
          </div>
        </div>
      )}
    </Form.List>
  );
}

// Intro-video field group. One short clip (<= the connect-profile-video policy
// cap). Reuses the feed video pipeline via MediaUploadGrid's video mode -
// client duration pre-check + poster-frame capture + the server-side duration
// probe - exactly like the marketplace ListingForm product clip. The grid sits
// OUTSIDE the AntD Form (it owns its own URL + poster state); the parent
// SectionForm lifts that state and splices the built `videos` array into the
// submit values. The captured poster (an image) goes to the image-capable
// connect-posts bucket (same place profile photos live), which has the
// compression preset the poster is encoded with.
function VideoFields({
  t,
  initialUrls,
  onChange,
  onPosters,
}: {
  t: ReturnType<typeof useTranslations>;
  initialUrls: string[];
  onChange: (urls: string[]) => void;
  onPosters: (map: Record<string, string>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
        {t('video.help', { seconds: profileVideoMaxSec })}
      </p>
      <MediaUploadGrid
        mediaKind="video"
        max={1}
        category="connect-profile-video"
        posterCategory="connect-posts"
        initialUrls={initialUrls}
        onChange={onChange}
        onPosters={onPosters}
      />
    </div>
  );
}

/**
 * Per-experience-item company picker. An AntD `AutoComplete` bound to the
 * item's `workshop` field: it natively allows a free typed value PLUS
 * server-driven suggestions, which is exactly "pick a platform CompanyPage OR
 * type a name not on the platform". Selecting a suggestion writes the hidden
 * `companyPageId` (so the profile read can show that company's logo + link);
 * free-typing a value that no longer matches the selected company clears it,
 * leaving an unlinked free-text company. Links to: profile.actions
 * `searchCompanyPages` (company-pages module) + the hidden `companyPageId`
 * Form.Item rendered alongside it in `ExperienceFields`.
 */
function CompanyLinkField({
  fieldName,
  t,
}: {
  fieldName: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const form = Form.useFormInstance();
  const [options, setOptions] = useState<
    { value: string; label: ReactNode; ref: CompanyPageRef }[]
  >([]);
  // The currently-linked company for this item. Workshop text that exactly
  // matches `selectedName` keeps the link; any other text clears it.
  const selectedRef = useRef<CompanyPageRef | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = q.trim();
    if (term.length < 2) {
      setOptions([]);
      return;
    }
    // Debounce ~300ms so a fast typist does not fire a request per keystroke.
    debounceRef.current = setTimeout(async () => {
      const res = await searchCompanyPages(term);
      if (!res.ok) {
        setOptions([]);
        return;
      }
      setOptions(
        res.data.map((ref) => ({
          value: ref.name,
          ref,
          label: (
            <span className="inline-flex items-center gap-2">
              {ref.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-uploaded R2 logo of unknown dimensions; the Connect pattern uses <img> + object-cover
                <img
                  src={ref.logo}
                  alt=""
                  width={18}
                  height={18}
                  className="rounded object-cover"
                  style={{ flexShrink: 0 }}
                />
              ) : null}
              <span className="truncate">{ref.name}</span>
            </span>
          ),
        })),
      );
    }, 300);
  };

  return (
    <Form.Item
      name={[fieldName, 'workshop']}
      label={t('edit.companyLink')}
      extra={t('edit.companyLinkHint')}
      rules={[
        { required: true, message: t('edit.workshopRequired') },
        { max: 160, message: t('edit.workshopMax') },
      ]}
    >
      <AutoComplete
        options={options}
        maxLength={160}
        placeholder={t('edit.workshopPlaceholder')}
        onSearch={runSearch}
        onSelect={(value, option) => {
          // option carries the picked ref (we attach it above). Link the entry.
          const ref = (option as { ref?: CompanyPageRef }).ref ?? null;
          selectedRef.current = ref;
          form.setFieldValue(['experience', fieldName, 'companyPageId'], ref?.id ?? null);
        }}
        onChange={(value) => {
          // Free typing: drop the link the moment the text diverges from the
          // selected company's name, so a free-typed company is unlinked.
          if (!selectedRef.current || value !== selectedRef.current.name) {
            selectedRef.current = null;
            form.setFieldValue(['experience', fieldName, 'companyPageId'], null);
          }
        }}
      />
    </Form.Item>
  );
}

/**
 * Per-training-item institute picker. A clone of `CompanyLinkField` above,
 * differing only in (a) it binds the AutoComplete to the item's `instituteName`
 * field and (b) every `companyPageId` write targets the `training` Form.List
 * path - the original hardcodes `experience` in two places, which is the gotcha
 * the clone exists to avoid. Selecting a suggestion links an institute
 * CompanyPage (the read shows its logo + /company/<slug> link via
 * `trainingCompanies`); free-typing a divergent name clears the link, leaving an
 * unlinked free-text institute. Reuses the SAME profile.actions `searchCompanyPages`
 * endpoint (company-pages module). Kept verbatim with CompanyLinkField - keep
 * the two in sync if the search/link contract changes.
 */
function InstituteLinkField({
  fieldName,
  t,
}: {
  fieldName: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const form = Form.useFormInstance();
  const [options, setOptions] = useState<
    { value: string; label: ReactNode; ref: CompanyPageRef }[]
  >([]);
  // The currently-linked institute for this item. Text that exactly matches
  // `selectedRef.name` keeps the link; any other text clears it.
  const selectedRef = useRef<CompanyPageRef | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = q.trim();
    if (term.length < 2) {
      setOptions([]);
      return;
    }
    // Debounce ~300ms so a fast typist does not fire a request per keystroke.
    debounceRef.current = setTimeout(async () => {
      const res = await searchCompanyPages(term);
      if (!res.ok) {
        setOptions([]);
        return;
      }
      setOptions(
        res.data.map((ref) => ({
          value: ref.name,
          ref,
          label: (
            <span className="inline-flex items-center gap-2">
              {ref.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-uploaded R2 logo of unknown dimensions; the Connect pattern uses <img> + object-cover
                <img
                  src={ref.logo}
                  alt=""
                  width={18}
                  height={18}
                  className="rounded object-cover"
                  style={{ flexShrink: 0 }}
                />
              ) : null}
              <span className="truncate">{ref.name}</span>
            </span>
          ),
        })),
      );
    }, 300);
  };

  return (
    <Form.Item
      name={[fieldName, 'instituteName']}
      label={t('edit.instituteLink')}
      extra={t('edit.instituteLinkHint')}
      rules={[
        { required: true, message: t('edit.instituteRequired') },
        { max: 160, message: t('edit.instituteMax') },
      ]}
    >
      <AutoComplete
        options={options}
        maxLength={160}
        placeholder={t('edit.institutePlaceholder')}
        onSearch={runSearch}
        onSelect={(value, option) => {
          // option carries the picked ref (we attach it above). Link the entry.
          const ref = (option as { ref?: CompanyPageRef }).ref ?? null;
          selectedRef.current = ref;
          form.setFieldValue(['training', fieldName, 'companyPageId'], ref?.id ?? null);
        }}
        onChange={(value) => {
          // Free typing: drop the link the moment the text diverges from the
          // selected institute's name, so a free-typed institute is unlinked.
          if (!selectedRef.current || value !== selectedRef.current.name) {
            selectedRef.current = null;
            form.setFieldValue(['training', fieldName, 'companyPageId'], null);
          }
        }}
      />
    </Form.Item>
  );
}

function VisibilityFields({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Form.Item
      name="visibility"
      label={
        <LabelWithHelp
          text={t('edit.visibility')}
          helpTitle={t('edit.visibilityHelpTitle')}
          help={t('edit.visibilityHelp')}
        />
      }
    >
      <Select
        options={[
          { value: 'public', label: t('visibility.public') },
          { value: 'connections', label: t('visibility.connections') },
          { value: 'hidden', label: t('visibility.hidden') },
        ]}
      />
    </Form.Item>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function LabelWithHelp({
  text,
  helpTitle,
  help,
}: {
  text: string;
  helpTitle: string;
  help: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {text}
      <InfoTooltip text={helpTitle} body={help} />
    </span>
  );
}

function sectionTitle(
  section: ProfileEditSection,
  t: ReturnType<typeof useTranslations>,
  tRate: ReturnType<typeof useTranslations>,
): string {
  switch (section) {
    case 'header':
      return t('edit.coverSection');
    case 'about':
      return t('sections.about');
    case 'skills':
      return t('sections.skills');
    case 'rates':
      return tRate('title');
    case 'openTo':
      return t('openTo.label');
    case 'portfolio':
      return t('sections.portfolio');
    case 'experience':
      return t('sections.experience');
    case 'training':
      return t('sections.training');
    case 'services':
      return t('sections.services');
    case 'videos':
      return t('video.section');
    case 'visibility':
      return t('edit.visibilitySection');
  }
}

/** Form initial values scoped to a single section. */
function extractInitialValues(
  section: ProfileEditSection,
  profile: ConnectProfile,
  currentAvatar: string,
): Record<string, unknown> {
  switch (section) {
    case 'header':
      return {
        avatar: currentAvatar || '',
        banner: profile.banner || '',
        headline: profile.headline || '',
        // Broker / dalal self-declaration (Broker badge, Slice 1) - seed the
        // Switch from the stored flag (false for legacy docs).
        isBroker: !!profile.isBroker,
        // Seed the location picker's canonical triple from the stored profile.
        // Slugs are preferred; the picker recovers the state from a legacy
        // free-text `district` name when the slugs are absent (seedStateDistrict).
        location: {
          district: profile.district || '',
          geoStateSlug: profile.geoStateSlug || '',
          geoDistrictSlug: profile.geoDistrictSlug || '',
        } satisfies StateDistrictValue,
      };
    case 'about':
      return { bio: profile.bio || '' };
    case 'skills':
      return { skills: profile.skills ?? [] };
    case 'rates':
      return {
        rateCard: {
          dailyWage: paiseToRupees(profile.rateCard?.dailyWage),
          pieceRate: paiseToRupees(profile.rateCard?.pieceRate),
          monthly: paiseToRupees(profile.rateCard?.monthly),
        },
      };
    case 'openTo':
      return {
        openTo: {
          work: !!profile.openTo?.work,
          hiring: !!profile.openTo?.hiring,
          deals: !!profile.openTo?.deals,
          customOrders: !!profile.openTo?.customOrders,
        },
        // Seed the per-intent detail + audience inputs so they start
        // populated from the additive `openToDetails` field; audience
        // defaults to 'all' (Everyone) when never set.
        openToDetails: {
          work: {
            detail: profile.openToDetails?.work?.detail ?? '',
            audience: profile.openToDetails?.work?.audience ?? 'all',
          },
          hiring: {
            detail: profile.openToDetails?.hiring?.detail ?? '',
            audience: profile.openToDetails?.hiring?.audience ?? 'all',
          },
          deals: {
            detail: profile.openToDetails?.deals?.detail ?? '',
            audience: profile.openToDetails?.deals?.audience ?? 'all',
          },
          customOrders: {
            detail: profile.openToDetails?.customOrders?.detail ?? '',
            audience: profile.openToDetails?.customOrders?.audience ?? 'all',
          },
        },
      };
    case 'portfolio':
      return {
        portfolio: (profile.portfolio ?? []).map((p) => ({
          image: p.image,
          caption: p.caption,
          machineType: p.machineType,
          workType: p.workType,
        })),
      };
    case 'services':
      return {
        services: (profile.services ?? []).map((s) => ({ title: s.title, note: s.note })),
      };
    // The intro-video clip + poster live in React state seeded from the grid's
    // `initialUrls`, not in the AntD Form, so this section seeds no form field.
    case 'videos':
      return {};
    case 'experience':
      return {
        experience: (profile.experience ?? []).map((e) => ({
          workshop: e.workshop,
          // Seed the hidden company link so an unchanged save keeps the
          // existing platform-company association (company-pages module).
          companyPageId: e.companyPageId ?? null,
          role: e.role,
          from: e.from ? dayjs(e.from) : null,
          to: e.to ? dayjs(e.to) : null,
          // Non-persisted: no end date means the job is ongoing, so pre-check
          // "I currently work here" and hide the end-date field.
          current: !e.to,
          description: e.description,
        })),
      };
    case 'training':
      return {
        training: (profile.training ?? []).map((tr) => ({
          // Seed the hidden stable id (Phase 2) so saving an unchanged credential
          // preserves its server id; new rows the owner adds have none.
          id: tr.id,
          instituteName: tr.instituteName,
          // Seed the hidden institute link so an unchanged save keeps the
          // existing platform-institute association (company-pages module).
          companyPageId: tr.companyPageId ?? null,
          course: tr.course,
          // The month picker wants a dayjs value, not the stored ISO string.
          completedAt: tr.completedAt ? dayjs(tr.completedAt) : null,
          certificateUrl: tr.certificateUrl,
          // UI-only helper: the "Ask institute to confirm" Switch starts ON only
          // when a request is already in flight (confirmStatus 'pending'). A
          // 'confirmed'/'declined'/'self' entry starts OFF (the student is not
          // re-requesting). Mapped back to confirmStatus on submit.
          requestConfirm: tr.confirmStatus === 'pending',
          // Per-credential institute-page opt-in; default OFF for legacy rows.
          shareWithInstitute: tr.shareWithInstitute ?? false,
        })),
      };
    case 'visibility':
      return { visibility: profile.visibility };
  }
}

/**
 * One raw training row as the AntD Form.List emits it (TrainingFields). The
 * date is a `Dayjs` (the month picker) and `requestConfirm` / `current`-style
 * flags are UI-only helpers. Exported for the shaper unit test.
 */
export interface TrainingFormRow {
  id?: string;
  instituteName?: string;
  companyPageId?: string | null;
  course?: string;
  completedAt?: Dayjs | null;
  certificateUrl?: string;
  /** UI-only "Ask institute to confirm" Switch; mapped to confirmStatus, never sent. */
  requestConfirm?: boolean;
  shareWithInstitute?: boolean;
}

/**
 * Pure shaper: form rows -> the `training` PATCH write items (Phase 2). Factored
 * out of `buildSectionPayload` so it is unit-testable without rendering the
 * modal. Rules (mirror the BE contract):
 *  - Round-trip `id` (edited entry keeps its server id; new rows omit it).
 *  - `requestConfirm` maps to `confirmStatus`: ONLY a linked, on-platform
 *    institute (companyPageId set) can be asked -> 'pending' when the Switch is
 *    on, else 'self'. Unlinked rows omit confirmStatus (server defaults 'self').
 *    We NEVER emit 'confirmed'/'declined' (institute-owner states the BE rejects).
 *  - `shareWithInstitute` (per-credential DPDP opt-in) only travels when linked.
 *  - Blank-instituteName rows are dropped.
 * Cross-module: feeds the company-pages credential-requests flow via the BE
 * (a 'pending' entry shows up in that institute's PendingCredentialRequest[]).
 */
export function mapTrainingFormRows(rows: TrainingFormRow[]): ConnectTrainingItemWrite[] {
  return rows
    .map((tr) => {
      // The hidden institute link (set by InstituteLinkField); undefined when
      // the institute was free-typed / unlinked.
      const companyPageId = tr?.companyPageId || undefined;
      const confirmStatus: 'self' | 'pending' | undefined = companyPageId
        ? tr?.requestConfirm
          ? 'pending'
          : 'self'
        : undefined;
      return {
        // Round-trip the stable id (Phase 2) so an edited entry keeps its server
        // id; new rows omit it (undefined) and the server assigns one.
        id: tr?.id || undefined,
        instituteName: (tr?.instituteName ?? '').trim(),
        companyPageId,
        course: tr?.course?.trim() || undefined,
        // Single completion month -> ISO string (no range, unlike experience).
        completedAt: tr?.completedAt ? tr.completedAt.toISOString() : undefined,
        certificateUrl: tr?.certificateUrl?.trim() || undefined,
        confirmStatus,
        // Per-credential institute-page opt-in (DPDP). Only meaningful when
        // linked; omit it for unlinked rows so we never set it spuriously.
        shareWithInstitute: companyPageId ? !!tr?.shareWithInstitute : undefined,
      };
    })
    .filter((tr) => tr.instituteName.length > 0);
}

/**
 * Pure shaper: the header form's location value (the StateDistrictPicker triple)
 * -> the location keys of the profile PATCH. Factored out of `buildSectionPayload`
 * so the forward-to-backend contract is unit-testable without rendering the modal.
 * Emits the canonical district NAME (the boost-matched value, see
 * StateDistrictPicker) plus both india-geo slugs; a cleared picker yields empty
 * strings (clears the stored location). Exported for the vitest.
 */
export function mapLocationPayload(value: StateDistrictValue | undefined): {
  district: string;
  geoStateSlug: string;
  geoDistrictSlug: string;
} {
  const loc = value ?? EMPTY_STATE_DISTRICT;
  return {
    district: loc.district.trim(),
    geoStateSlug: loc.geoStateSlug,
    geoDistrictSlug: loc.geoDistrictSlug,
  };
}

/**
 * Build the partial profile-update payload for a single section. Only the
 * section's fields are included; everything else stays unchanged on the
 * server (the schema is partial-friendly).
 */
async function buildSectionPayload(
  section: ProfileEditSection,
  values: Record<string, unknown>,
  profile: ConnectProfile,
  resolveUpload: (
    value: string | File | undefined,
    category: 'connect-banners' | 'connect-portfolio',
  ) => Promise<string>,
): Promise<Record<string, unknown>> {
  switch (section) {
    case 'header': {
      const banner = await resolveUpload(
        values.banner as string | File | undefined,
        'connect-banners',
      );
      // The location picker emits the canonical triple { district (NAME),
      // geoStateSlug, geoDistrictSlug }. mapLocationPayload forwards all three so
      // the boost matcher has a canonical district NAME to match and the
      // structured slugs persist. A cleared picker yields empty strings.
      return {
        banner,
        headline: ((values.headline as string | undefined) ?? '').trim(),
        // Broker / dalal self-declaration (Broker badge, Slice 1). Sent through
        // the existing updateMyConnectProfile action (schema carries `isBroker`);
        // the BE stamps `brokerSince` on the first enable.
        isBroker: !!values.isBroker,
        ...mapLocationPayload(values.location as StateDistrictValue | undefined),
      };
    }
    case 'about':
      return { bio: ((values.bio as string | undefined) ?? '').trim() };
    case 'skills':
      return {
        skills: ((values.skills as string[] | undefined) ?? [])
          .map((s) => s.trim())
          .filter(Boolean),
      };
    case 'rates': {
      const rate = (values.rateCard as Partial<ConnectRateCard> | undefined) ?? {};
      return {
        rateCard: {
          dailyWage: rupeesToPaise(rate.dailyWage as number | undefined),
          pieceRate: rupeesToPaise(rate.pieceRate as number | undefined),
          monthly: rupeesToPaise(rate.monthly as number | undefined),
        },
      };
    }
    case 'openTo': {
      const open = (values.openTo as Partial<ConnectOpenTo> | undefined) ?? {};
      // Detail + audience persist into the additive `openToDetails` field.
      // Trim an empty detail down to undefined (so we don't store blank
      // strings) but always keep a concrete audience (defaults to 'all').
      const det =
        (values.openToDetails as
          | Record<string, { detail?: string; audience?: string }>
          | undefined) ?? {};
      const pickDetail = (k: string) => ({
        detail: det[k]?.detail?.trim() || undefined,
        audience: (det[k]?.audience as 'all' | 'network') ?? 'all',
      });
      return {
        openTo: {
          work: !!open.work,
          hiring: !!open.hiring,
          // `customOrders` ("Providing services") is editable again - read it
          // from the form. `deals` stays PAUSED (not in the UI), so carry its
          // existing stored value through rather than zeroing it on every save.
          deals: !!profile.openTo?.deals,
          customOrders: !!open.customOrders,
        },
        openToDetails: {
          work: pickDetail('work'),
          hiring: pickDetail('hiring'),
          deals: profile.openToDetails?.deals,
          customOrders: pickDetail('customOrders'),
        },
      };
    }
    case 'portfolio': {
      const raw =
        (values.portfolio as
          | Partial<ConnectPortfolioItem & { image?: string | File }>[]
          | undefined) ?? [];
      const resolved = await Promise.all(
        raw.map(async (p) => ({
          image: await resolveUpload(p?.image as string | File | undefined, 'connect-portfolio'),
          caption: p?.caption?.trim() || undefined,
          machineType: p?.machineType?.trim() || undefined,
          workType: p?.workType?.trim() || undefined,
        })),
      );
      return { portfolio: resolved.filter((p) => p.image.length > 0) };
    }
    case 'experience': {
      const raw =
        (values.experience as
          | Array<{
              workshop?: string;
              companyPageId?: string | null;
              role?: string;
              from?: Dayjs | null;
              to?: Dayjs | null;
              current?: boolean;
              description?: string;
            }>
          | undefined) ?? [];
      return {
        experience: raw
          .map((e) => ({
            workshop: (e?.workshop ?? '').trim(),
            // The hidden company link (set by CompanyLinkField); undefined when
            // the company was free-typed / unlinked.
            companyPageId: e?.companyPageId || undefined,
            role: e?.role?.trim() || undefined,
            from: e?.from ? e.from.toISOString() : undefined,
            // "I currently work here" wins: an ongoing job has no end date, so
            // drop any stale `to`. `current` itself is a UI-only helper and is
            // never sent to the API (no key emitted here).
            to: e?.current ? undefined : e?.to ? e.to.toISOString() : undefined,
            description: e?.description?.trim() || undefined,
          }))
          .filter((e: ConnectExperienceItem) => e.workshop.length > 0),
      };
    }
    case 'training': {
      // Delegate the row shaping to the pure, unit-tested mapTrainingFormRows
      // (above): it round-trips id, derives confirmStatus from requestConfirm +
      // companyPageId, and threads the shareWithInstitute opt-in.
      const raw = (values.training as TrainingFormRow[] | undefined) ?? [];
      return { training: mapTrainingFormRows(raw) };
    }
    case 'services': {
      const raw = (values.services as Array<{ title?: string; note?: string }> | undefined) ?? [];
      return {
        services: raw
          .map((s) => ({ title: (s?.title ?? '').trim(), note: s?.note?.trim() || undefined }))
          .filter((s) => s.title.length > 0),
      };
    }
    // The `videos` array was already built (clip url + resolved poster) and
    // spliced into `values` by SectionForm.handleFinish, since the grid lives
    // outside the AntD Form. Always send it (PATCH-omits-stay) so removing the
    // clip clears it. Empty array = no video.
    case 'videos':
      return {
        videos: (values.videos as { url: string; posterUrl?: string }[] | undefined) ?? [],
      };
    case 'visibility':
      return {
        visibility: (values.visibility as ConnectProfileVisibility) ?? profile.visibility,
      };
  }
}
