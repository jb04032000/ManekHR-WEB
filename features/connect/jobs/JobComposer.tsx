'use client';

/**
 * JobComposer - the "Post a job" modal. Reuses the listing category taxonomy so
 * a job speaks the same trade language as the catalogue, and captures the
 * board's real signals (role, skills, machine type, deadline) so the redesigned
 * board can render + filter them. The parent owns the action call + the
 * resulting navigation. An optional `companyPageId` posts the job AS that page.
 */

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Form, Input, InputNumber, Select, DatePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import DsButton from '@/components/ui/DsButton';
import MediaUploadGrid from '@/components/connect/MediaUploadGrid';
// Policy-driven job-video cap (seconds) for the section help copy - the same
// number MediaUploadGrid enforces in its pre-check, never a second hardcoded value.
import { getUploadPolicy } from '@/lib/upload-policies.helpers';
import { LISTING_CATEGORIES } from '../search.types';
import { searchTags } from '../marketplace/tag.actions';
import {
  JOB_ROLE_PRESETS,
  JOB_EMPLOYMENT_TYPES,
  JOB_SHIFTS,
  JOB_BENEFIT_PRESETS,
} from './jobs.types';
import type { CreateJobPayload, JobWageType, JobEmploymentType, JobShift, Job } from './jobs.types';

/** Job-video duration cap (seconds), read from the upload policy (not hardcoded). */
const videoMaxSec = getUploadPolicy('connect-job-video').duration?.max ?? 60;

// Pay-type options shown in the composer (order = display order). Mirrors BE
// JOB_WAGE_TYPES; labels via i18n connect.jobs.wageType.*.
const WAGE_TYPES: JobWageType[] = ['hourly', 'daily', 'piece', 'monthly'];

/**
 * A single-select combobox that offers the known presets AND lets the poster
 * type their own term, suggesting matches from the shared ConnectTag pool
 * (GET /connect/tags/search, the same source as a listing's custom category) so
 * two posters do not coin "tailor" vs "tailoring". The committed value is one
 * canonical string; the BE folds a custom term to a slug via TagService. Used
 * for both `category` and `role`. Bound to the wrapping Form.Item via value /
 * onChange. AntD maps a selected preset's value back to its localized label;
 * a freshly typed term renders as its own text.
 */
function TagComboField({
  value,
  onChange,
  placeholder,
  presets,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder: string;
  presets: { label: string; value: string }[];
}) {
  const [suggested, setSuggested] = useState<{ label: string; value: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = q.trim();
    if (!term) {
      setSuggested([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await searchTags(term);
      if (res.ok) {
        const presetValues = new Set(presets.map((p) => p.value));
        setSuggested(
          res.data
            .filter((s) => !presetValues.has(s.slug))
            .map((s) => ({ label: s.label, value: s.slug })),
        );
      }
    }, 250);
  };

  // AntD tags-mode models a single value as a one-element array (maxCount 1).
  const selected = value ? [value] : [];
  return (
    <Select
      mode="tags"
      maxCount={1}
      showSearch
      tokenSeparators={[',']}
      value={selected}
      placeholder={placeholder}
      onSearch={handleSearch}
      onChange={(vals: string[]) => onChange?.(vals[vals.length - 1] ?? '')}
      options={[...presets, ...suggested]}
      style={{ width: '100%' }}
    />
  );
}

interface FormValues {
  title: string;
  category: string;
  role?: string;
  description?: string;
  /** "What you'll do" -- one responsibility per line in the textarea; split to
   *  an array on submit (avoids comma-in-sentence issues a tags field would hit). */
  responsibilities?: string;
  skills?: string[];
  machineType?: string;
  employmentType?: JobEmploymentType;
  experienceMin?: number;
  shift?: JobShift;
  workingDays?: string;
  languages?: string[];
  benefits?: string[];
  wageType?: JobWageType;
  wageMin?: number;
  wageMax?: number;
  openings?: number;
  closesAt?: Dayjs;
  district?: string;
  city?: string;
  state?: string;
}

interface Props {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateJobPayload) => void;
  /** When set, the job is posted AS this company page. */
  companyPageId?: string;
  /** Prefill the form from this job. With `mode='edit'` the composer edits it
   *  ("Save" CTA, updateJob, companyPageId ignored). With `mode='create'` (the
   *  default) it is a TEMPLATE: the fields are copied but a NEW job is posted
   *  (createJob), `closesAt` is dropped (likely a past date), and a hint banner
   *  shows. */
  initial?: Job;
  /** 'edit' = update `initial`; 'create' (default) = post a new job (blank, or
   *  prefilled from `initial` as a template). */
  mode?: 'create' | 'edit';
  /** The poster's past jobs, offered as fill-from templates by a "Start from a
   *  past job" picker at the top of the CREATE form. Picking one copies its fields
   *  into a NEW post (same prefill as the company-page row "Use as template").
   *  Hidden in edit mode and when empty. Pass the list already on hand (JobBoard
   *  `mine`, a company page's owner jobs) - no extra fetch. */
  templates?: Job[];
}

/** Map an existing job onto the form fields. `dropClosesAt` (template mode)
 *  omits the deadline, which is usually in the past on a re-used job. */
function toFormValues(job: Job, dropClosesAt = false): FormValues {
  return {
    title: job.title,
    category: job.category,
    role: job.role ?? undefined,
    description: job.description || undefined,
    responsibilities: job.responsibilities?.length ? job.responsibilities.join('\n') : undefined,
    skills: job.skills?.length ? job.skills : undefined,
    machineType: job.machineType || undefined,
    employmentType: job.employmentType ?? undefined,
    experienceMin: job.experienceMin ?? undefined,
    shift: job.shift ?? undefined,
    workingDays: job.workingDays || undefined,
    languages: job.languages?.length ? job.languages : undefined,
    benefits: job.benefits?.length ? job.benefits : undefined,
    wageType: job.wageType ?? undefined,
    wageMin: job.wageMin ?? undefined,
    wageMax: job.wageMax ?? undefined,
    openings: job.openings,
    closesAt: dropClosesAt || !job.closesAt ? undefined : dayjs(job.closesAt),
    district: job.location?.district || undefined,
    city: job.location?.city || undefined,
    state: job.location?.state || undefined,
  };
}

/** Every form field cleared - applied when the template picker is set back to
 *  blank so a previously copied template does not linger in the fields. The two
 *  required fields reset to "" (their validators re-fire on submit). */
const BLANK_FORM: FormValues = {
  title: '',
  category: '',
  role: undefined,
  description: undefined,
  responsibilities: undefined,
  skills: undefined,
  machineType: undefined,
  employmentType: undefined,
  experienceMin: undefined,
  shift: undefined,
  workingDays: undefined,
  languages: undefined,
  benefits: undefined,
  wageType: undefined,
  wageMin: undefined,
  wageMax: undefined,
  openings: undefined,
  closesAt: undefined,
  district: undefined,
  city: undefined,
  state: undefined,
};

export default function JobComposer({
  open,
  submitting,
  onClose,
  onSubmit,
  companyPageId,
  initial,
  mode = 'create',
  templates,
}: Props) {
  const t = useTranslations('connect.jobs');
  const tCat = useTranslations('connect.search.listing.category');
  const [form] = Form.useForm<FormValues>();
  const isEdit = mode === 'edit';

  // "Start from a past job" picker (create mode only): `pickedId` is the chosen
  // template, seeded from `initial` so a caller that opens the composer with a
  // preselected template (the company-page row "Use as template") shows it picked.
  // destroyOnHidden remounts the modal per open, so this re-seeds fresh each time.
  // Hidden in edit mode and when no templates were passed.
  const showTemplatePicker = !isEdit && (templates?.length ?? 0) > 0;
  const [pickedId, setPickedId] = useState<string | undefined>(isEdit ? undefined : initial?._id);
  // The job currently seeding the CREATE form: the picked template, else the
  // caller's `initial` when its id is the selection (covers a caller that passes
  // `initial` without a matching `templates` list). undefined = blank form.
  const pickedJob = useMemo<Job | undefined>(() => {
    if (isEdit || !pickedId) return undefined;
    return (
      templates?.find((j) => j._id === pickedId) ??
      (initial?._id === pickedId ? initial : undefined)
    );
  }, [isEdit, pickedId, templates, initial]);
  // Edit seeds from `initial` (the job being edited); create seeds from the picked
  // template. One `seed` drives the hint, initialValues, and the video seeds below.
  const seed = isEdit ? initial : pickedJob;
  // Prefilled-but-not-editing = a template (Use as template): copy the fields,
  // post a new job. Drives the hint banner + dropping the (likely past) deadline.
  const isTemplate = !isEdit && !!seed;

  // ── Job video (at most one) ────────────────────────────────────────────────
  // The uploaded clip URL(s) from the video grid + the {videoUrl -> posterUrl}
  // map the grid captures. `seed.videos` seeds the grid AND lets us fall back
  // to a clip's already-stored poster on save, so editing other fields never
  // strips an existing poster. A template (re-post) carries the source job's clip
  // forward too (seed = the picked template). The whole pipeline (60s duration
  // pre-check, poster capture, server duration) is reused from the feed via
  // MediaUploadGrid + the `connect-job-video` policy - the SAME pattern as the
  // marketplace ListingForm.
  const initialVideoUrls = useMemo(() => (seed?.videos ?? []).map((vid) => vid.url), [seed]);
  const initialPosterByUrl = useMemo(
    () =>
      Object.fromEntries(
        (seed?.videos ?? []).filter((vid) => vid.posterUrl).map((vid) => [vid.url, vid.posterUrl!]),
      ),
    [seed],
  );
  const [videoUrls, setVideoUrls] = useState<string[]>(initialVideoUrls);
  // Captured posters only (the grid emits a {videoUrl -> posterUrl} map of NEWLY
  // captured frames; an initial/edit clip has no fresh capture). At save we merge
  // these over `initialPosterByUrl` so an untouched existing clip keeps its poster.
  const [capturedPosterByUrl, setCapturedPosterByUrl] = useState<Record<string, string>>({});

  // Switch the form to a chosen template (or blank when cleared). Text/select
  // fields re-seed imperatively here; the video grid re-seeds via its `key` remount
  // (it only reads initialUrls at mount). closesAt is dropped (a template = re-post,
  // whose deadline is usually past).
  const applyTemplate = (id?: string) => {
    setPickedId(id);
    const job = id
      ? (templates?.find((j) => j._id === id) ?? (initial?._id === id ? initial : undefined))
      : undefined;
    form.setFieldsValue(job ? toFormValues(job, true) : BLANK_FORM);
    setVideoUrls((job?.videos ?? []).map((vid) => vid.url));
    setCapturedPosterByUrl({});
  };

  const handleFinish = (v: FormValues) => {
    const payload: CreateJobPayload = { title: v.title.trim(), category: v.category };
    if (v.role) payload.role = v.role;
    if (v.description?.trim()) payload.description = v.description.trim();
    // One responsibility per line -> array (trim, drop blanks, cap 20 / 200 chars
    // to match the BE DTO). Mirrors Job.responsibilities.
    const responsibilities = (v.responsibilities ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((s) => s.slice(0, 200));
    if (responsibilities.length) payload.responsibilities = responsibilities;
    const skills = (v.skills ?? []).map((s) => s.trim()).filter(Boolean);
    if (skills.length) payload.skills = skills;
    if (v.machineType?.trim()) payload.machineType = v.machineType.trim();
    if (v.employmentType) payload.employmentType = v.employmentType;
    if (v.experienceMin != null) payload.experienceMin = v.experienceMin;
    if (v.shift) payload.shift = v.shift;
    if (v.workingDays?.trim()) payload.workingDays = v.workingDays.trim();
    const languages = (v.languages ?? []).map((s) => s.trim()).filter(Boolean);
    if (languages.length) payload.languages = languages;
    const benefits = (v.benefits ?? []).map((s) => s.trim()).filter(Boolean);
    if (benefits.length) payload.benefits = benefits;
    if (v.wageType) payload.wageType = v.wageType;
    if (v.wageMin != null) payload.wageMin = v.wageMin;
    if (v.wageMax != null) payload.wageMax = v.wageMax;
    if (v.openings != null) payload.openings = v.openings;
    // Job video(s) are ALWAYS sent (like the listing form's videos) so an edit
    // that removes the clip actually clears it (PATCH: an omitted field stays).
    // Each clip's poster is the freshly captured one, else the existing stored
    // poster (an untouched edit clip keeps its poster).
    payload.videos = videoUrls.map((url) => {
      const posterUrl = capturedPosterByUrl[url] ?? initialPosterByUrl[url];
      return posterUrl ? { url, posterUrl } : { url };
    });
    if (v.closesAt) payload.closesAt = v.closesAt.toISOString();
    const district = v.district?.trim();
    const city = v.city?.trim();
    const state = v.state?.trim();
    if (district || city || state) payload.location = { district, city, state };
    // Edit never moves a job between pages, so companyPageId is create-only.
    if (companyPageId && !isEdit) payload.companyPageId = companyPageId;
    onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={isEdit ? t('editTitle') : t('composerTitle')}
      footer={null}
      destroyOnHidden
      // Closes only via the Cancel button or the top close (X) icon - never on an
      // outside/mask click or Esc, so a half-filled job post is not lost by accident.
      // AntD v6: mask.closable replaces the deprecated maskClosable prop.
      mask={{ closable: false }}
      keyboard={false}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <Form
        form={form}
        layout="vertical"
        colon={false}
        onFinish={handleFinish}
        preserve={false}
        initialValues={seed ? toFormValues(seed, isTemplate) : undefined}
      >
        {/* "Start from a past job" picker (create mode, when templates exist):
            copy an earlier job's details into this NEW post. Not a form field
            (never submitted) - it drives the form via applyTemplate. */}
        {showTemplatePicker && (
          <div className="mb-4">
            <label
              htmlFor="job-template-picker"
              className="mb-1 block text-[12.5px] font-semibold"
              style={{ color: 'var(--cr-text-2)' }}
            >
              {t('templatePickerLabel')}
            </label>
            <Select
              id="job-template-picker"
              showSearch
              allowClear
              value={pickedId}
              placeholder={t('templatePickerPlaceholder')}
              optionFilterProp="label"
              onChange={(id?: string) => applyTemplate(id)}
              // Title + posted date so near-identical titles stay distinguishable.
              options={(templates ?? []).map((j) => ({
                value: j._id,
                label: j.createdAt
                  ? `${j.title} (${dayjs(j.createdAt).format('D MMM YYYY')})`
                  : j.title,
              }))}
              style={{ width: '100%' }}
            />
          </div>
        )}
        {isTemplate && (
          <div
            className="mb-4 rounded-[var(--cr-radius-md)] px-3 py-2 text-[12.5px]"
            style={{
              background: 'var(--cr-wash-indigo)',
              border: '1px solid var(--cr-primary-border)',
              color: 'var(--cr-text-3)',
            }}
          >
            {t('templateHint')}
          </div>
        )}
        <Form.Item
          label={t('titleLabel')}
          name="title"
          rules={[
            { required: true, message: t('titleRequired') },
            { max: 160, message: t('titleTooLong') },
          ]}
        >
          <Input maxLength={160} placeholder={t('titlePlaceholder')} />
        </Form.Item>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
          <Form.Item
            style={{ flex: '1 1 200px' }}
            label={t('categoryLabel')}
            name="category"
            rules={[{ required: true, message: t('categoryRequired') }]}
          >
            <TagComboField
              placeholder={t('categoryPlaceholder')}
              presets={LISTING_CATEGORIES.map((c) => ({ label: tCat(c), value: c }))}
            />
          </Form.Item>
          {/* Role is REQUIRED at the form level so every posted job carries a role
              that maps to the board's role facet/chips (an unmapped job would never
              surface under a role filter). A preset OR a non-empty custom term is
              accepted - TagComboField emits "" when cleared, which the required rule
              rejects. Gotcha: the BE DTO keeps role OPTIONAL for back-compat with
              older jobs; this is a client-side requirement only. */}
          <Form.Item
            style={{ flex: '1 1 200px' }}
            label={t('roleLabel')}
            name="role"
            rules={[{ required: true, message: t('roleRequired') }]}
          >
            <TagComboField
              placeholder={t('rolePlaceholder')}
              presets={JOB_ROLE_PRESETS.map((r) => ({ label: t(`roleName.${r}`), value: r }))}
            />
          </Form.Item>
        </div>

        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cr-text-2)' }}>
            {t('requirementsLegend')}
          </legend>
          <Form.Item label={t('skillsLabel')} name="skills">
            <Select
              mode="tags"
              tokenSeparators={[',']}
              notFoundContent={null}
              placeholder={t('skillsPlaceholder')}
            />
          </Form.Item>
          <Form.Item label={t('machineTypeLabel')} name="machineType">
            <Input maxLength={80} placeholder={t('machineTypePlaceholder')} />
          </Form.Item>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
            <Form.Item
              style={{ flex: '1 1 160px' }}
              label={t('employmentTypeLabel')}
              name="employmentType"
            >
              <Select
                allowClear
                placeholder={t('employmentTypePlaceholder')}
                options={JOB_EMPLOYMENT_TYPES.map((e) => ({
                  label: t(`employmentTypeOpt.${e}`),
                  value: e,
                }))}
              />
            </Form.Item>
            <Form.Item
              style={{ flex: '1 1 140px' }}
              label={t('experienceLabel')}
              name="experienceMin"
            >
              <InputNumber
                min={0}
                max={50}
                style={{ width: '100%' }}
                suffix={t('experienceSuffix')}
                placeholder="0"
              />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
            <Form.Item style={{ flex: '1 1 140px' }} label={t('shiftLabel')} name="shift">
              <Select
                allowClear
                placeholder={t('shiftPlaceholder')}
                options={JOB_SHIFTS.map((s) => ({ label: t(`shiftOpt.${s}`), value: s }))}
              />
            </Form.Item>
            <Form.Item
              style={{ flex: '1 1 160px' }}
              label={t('workingDaysLabel')}
              name="workingDays"
            >
              <Input maxLength={80} placeholder={t('workingDaysPlaceholder')} />
            </Form.Item>
          </div>
          <Form.Item label={t('languagesLabel')} name="languages">
            <Select
              mode="tags"
              tokenSeparators={[',']}
              notFoundContent={null}
              placeholder={t('languagesPlaceholder')}
            />
          </Form.Item>
        </fieldset>

        <Form.Item label={t('descriptionLabel')} name="description" rules={[{ max: 5000 }]}>
          <Input.TextArea
            rows={4}
            maxLength={5000}
            showCount
            placeholder={t('descriptionPlaceholder')}
          />
        </Form.Item>

        {/* "What you'll do" -- one responsibility per line; rendered as a
            checklist on the job detail. Helper text explains the one-per-line. */}
        <Form.Item
          label={t('responsibilitiesLabel')}
          name="responsibilities"
          extra={t('responsibilitiesHelp')}
        >
          <Input.TextArea rows={4} placeholder={t('responsibilitiesPlaceholder')} />
        </Form.Item>

        {/* Job video: one short clip (<= the connect-job-video policy cap).
            Reuses the feed video pipeline via MediaUploadGrid's video mode -
            client duration pre-check + poster-frame capture + the server-side
            duration probe. The captured poster (an image) goes to the
            image-capable connect-posts bucket. Rendered poster-first on the job
            detail page. The SAME pattern as the marketplace ListingForm video. */}
        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cr-text-2)' }}>
            {t('video.section')}
          </legend>
          <p
            style={{
              margin: '0 0 var(--cr-space-sm)',
              fontSize: 12.5,
              lineHeight: 1.5,
              color: 'var(--cr-text-4)',
            }}
          >
            {t('video.help', { seconds: videoMaxSec })}
          </p>
          {/* key re-mounts the grid when the picked template changes so its clip
              re-seeds from the new job (the grid reads initialUrls only at mount). */}
          <MediaUploadGrid
            key={pickedId ?? 'blank'}
            mediaKind="video"
            max={1}
            category="connect-job-video"
            posterCategory="connect-posts"
            initialUrls={initialVideoUrls}
            onChange={setVideoUrls}
            onPosters={setCapturedPosterByUrl}
          />
        </fieldset>

        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cr-text-2)' }}>
            {t('wageLegend')}
          </legend>
          <Form.Item label={t('wageTypeLabel')} name="wageType">
            <Select
              allowClear
              placeholder={t('wageTypePlaceholder')}
              options={WAGE_TYPES.map((w) => ({ label: t(`wageType.${w}`), value: w }))}
            />
          </Form.Item>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
            <Form.Item style={{ flex: '1 1 140px' }} label={t('wageMinLabel')} name="wageMin">
              <InputNumber min={0} style={{ width: '100%' }} prefix="₹" placeholder="0" />
            </Form.Item>
            <Form.Item style={{ flex: '1 1 140px' }} label={t('wageMaxLabel')} name="wageMax">
              <InputNumber min={0} style={{ width: '100%' }} prefix="₹" placeholder="0" />
            </Form.Item>
          </div>
          <Form.Item label={t('benefitsLabel')} name="benefits">
            {/* Presets seed the dropdown; mode=tags also lets the poster add a
                custom perk. Stored as preset slugs or custom strings. */}
            <Select
              mode="tags"
              tokenSeparators={[',']}
              placeholder={t('benefitsPlaceholder')}
              options={JOB_BENEFIT_PRESETS.map((b) => ({ label: t(`benefitOpt.${b}`), value: b }))}
            />
          </Form.Item>
        </fieldset>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
          <Form.Item style={{ flex: '1 1 140px' }} label={t('openingsLabel')} name="openings">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="1" />
          </Form.Item>
          <Form.Item style={{ flex: '1 1 180px' }} label={t('closesAtLabel')} name="closesAt">
            <DatePicker
              style={{ width: '100%' }}
              placeholder={t('closesAtPlaceholder')}
              disabledDate={(d) => !!d && d.isBefore(dayjs().startOf('day'))}
            />
          </Form.Item>
        </div>

        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cr-text-2)' }}>
            {t('locationLegend')}
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cr-space-md)' }}>
            <Form.Item style={{ flex: '1 1 140px' }} label={t('districtLabel')} name="district">
              <Input maxLength={120} placeholder={t('districtPlaceholder')} />
            </Form.Item>
            <Form.Item style={{ flex: '1 1 140px' }} label={t('cityLabel')} name="city">
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item style={{ flex: '1 1 140px' }} label={t('stateLabel')} name="state">
              <Input maxLength={120} />
            </Form.Item>
          </div>
        </fieldset>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <DsButton dsVariant="ghost" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </DsButton>
          <DsButton dsVariant="primary" htmlType="submit" loading={submitting}>
            {isEdit ? t('save') : t('post')}
          </DsButton>
        </div>
      </Form>
    </Modal>
  );
}
