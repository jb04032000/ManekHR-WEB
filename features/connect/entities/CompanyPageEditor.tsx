'use client';

/**
 * CompanyPageEditor - the dedicated create/edit surface for a Company Page.
 * Two columns inside ConnectPage: the numbered, sectioned CompanyPageForm on the
 * left and a sticky CompanyPagePreview on the right that updates live from the
 * form values. Used by both `/connect/pages/new` (create) and
 * `/connect/pages/[id]/edit` (edit, seeded with `initial`).
 *
 * It owns the AntD Form instance + the logo/banner upload state so it can
 * `Form.useWatch` the values that feed the preview, and renders its own footer
 * actions (the form's footer is suppressed) so it can offer a "Save as draft"
 * secondary that publishes the page hidden - our honest draft equivalent, since
 * the schema has no separate draft status. On success it routes to the manage
 * console at `/connect/pages/[id]`.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Form, message } from 'antd';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { ConnectPage, useAnnouncer } from '@/components/connect';
import { useLimitReachedDialog } from '@/components/connect/useLimitReachedDialog';
import DsButton from '@/components/ui/DsButton';
import { parseApiError } from '@/lib/utils';
import CompanyPageForm, {
  buildCompanyPagePayload,
  companyPageInitialValues,
  type CompanyPageFormValues,
} from './CompanyPageForm';
import CompanyPagePreview from './CompanyPagePreview';
import { createCompanyPage, updateCompanyPage } from './company-page.actions';
import type { CompanyPage, CreateCompanyPagePayload } from './entities.types';

interface Props {
  /** Present in edit mode (seeds the form + preview). Absent = create. */
  initial?: CompanyPage;
}

export default function CompanyPageEditor({ initial }: Props) {
  const t = useTranslations('connect.companyPageAdmin');
  const router = useRouter();
  const [msgApi, ctx] = message.useMessage();
  const { announce, announcer } = useAnnouncer();
  const [form] = Form.useForm<CompanyPageFormValues>();
  const isEdit = !!initial;

  const [logo, setLogo] = useState<string[]>(initial?.logo ? [initial.logo] : []);
  const [bannerImg, setBannerImg] = useState<string[]>(initial?.banner ? [initial.banner] : []);
  // Company video (at most one) - lifted here (like logo/banner) because this
  // editor builds the payload itself from its own state, not the form's. The
  // grid seeds from `initial.videos`; captured posters (new clips) ride in
  // `videoPosters`, with a fallback to the existing stored poster on save so an
  // unchanged edit never strips it. Same shape as the marketplace listing video.
  const [video, setVideo] = useState<string[]>((initial?.videos ?? []).map((v) => v.url));
  const [videoPosters, setVideoPosters] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  // Plan-limit upgrade prompt for a blocked company-page create (create only).
  const { dialog: limitDialog, handleLimited } = useLimitReachedDialog();

  /** Build the at-most-one company video payload: prefer the freshly-captured
   *  poster, else the existing stored poster from the prefill. */
  const buildVideos = (): { url: string; posterUrl?: string }[] => {
    const initialPosterByUrl = Object.fromEntries(
      (initial?.videos ?? []).filter((v) => v.posterUrl).map((v) => [v.url, v.posterUrl!]),
    );
    return video.map((url) => {
      const posterUrl = videoPosters[url] ?? initialPosterByUrl[url];
      return posterUrl ? { url, posterUrl } : { url };
    });
  };

  // Live values for the preview. `Form.useWatch` re-renders this component as the
  // user types; logo/banner come from the upload state above.
  const watchedName = Form.useWatch('name', form);
  const watchedAbout = Form.useWatch('about', form);
  // Kind + the two institute fields feed the preview's capabilities swap. Plain
  // Form fields (like specialization), so no lifted state is needed here.
  const watchedKind = Form.useWatch('kind', form);
  const watchedSpecialization = Form.useWatch('specialization', form);
  const watchedMachineCapacity = Form.useWatch('machineCapacity', form);
  const watchedProduction = Form.useWatch('production', form);
  const watchedCoursesOffered = Form.useWatch('coursesOffered', form);
  const watchedModes = Form.useWatch('modes', form);
  const watchedLanguages = Form.useWatch('languages', form);
  const watchedDistrict = Form.useWatch('district', form);
  const watchedCity = Form.useWatch('city', form);
  const watchedState = Form.useWatch('state', form);
  const watchedVisibility = Form.useWatch('visibility', form);

  /** Run the action for a built payload, then route to the manage console. */
  const submitPayload = async (
    payload: CreateCompanyPagePayload,
    setBusy: (b: boolean) => void,
    successMsg: string,
  ) => {
    setBusy(true);
    try {
      const res = isEdit
        ? await updateCompanyPage(initial._id, payload)
        : await createCompanyPage(payload);
      if (!res.ok) {
        // Plan-limit block (create only) shows the shared upgrade dialog, not a toast.
        if (handleLimited(res)) return;
        msgApi.error(res.error);
        announce(res.error, { assertive: true });
        return;
      }
      void msgApi.success(successMsg);
      announce(successMsg);
      router.push(`/connect/pages/${res.data._id}`);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  // Primary submit (Create / Save changes): CompanyPageForm has ALREADY built the
  // payload from the form values + the lifted logo/banner/video state and hands it
  // to this onSubmit (its documented contract). Submit it as-is - do NOT re-run
  // buildCompanyPagePayload on it: the built payload nests specialization/machines/
  // location under industryPanel/institutePanel/location, so a second pass (which
  // reads top-level v.specialization/v.district/...) would silently drop every one
  // of those sections. Keep in sync with CompanyPageForm.onSubmit's contract.
  const handleFinish = (payload: CreateCompanyPagePayload) => {
    void submitPayload(payload, setSaving, isEdit ? t('updateSuccess') : t('createSuccess'));
  };

  // "Save as draft": validate (name is the only rule), then force the page
  // hidden. There is no separate draft status, so hidden IS the honest draft.
  const handleSaveDraft = async () => {
    let v: CompanyPageFormValues;
    try {
      v = await form.validateFields();
    } catch {
      // Validation surfaces the field errors; nothing else to do.
      return;
    }
    const payload = buildCompanyPagePayload(v, logo[0], bannerImg[0], buildVideos());
    payload.visibility = 'hidden';
    await submitPayload(payload, setSavingDraft, t('draftSaved'));
  };

  const busy = saving || savingDraft;
  const backHref = isEdit ? `/connect/pages/${initial._id}` : '/connect/pages';

  return (
    <ConnectPage>
      {ctx}
      {announcer}
      {limitDialog}

      {/* Breadcrumb */}
      <nav
        aria-label={t('breadcrumbAria')}
        className="mb-3 flex items-center gap-1.5 text-[12.5px]"
        style={{ color: 'var(--cr-text-4)' }}
      >
        <Link href="/connect/pages" className="no-underline" style={{ color: 'var(--cr-text-3)' }}>
          {t('breadcrumbHub')}
        </Link>
        <ChevronRight size={13} aria-hidden />
        <span style={{ color: 'var(--cr-text-2)' }}>
          {isEdit ? t('breadcrumbEdit') : t('breadcrumbCreate')}
        </span>
      </nav>

      {/* Page header */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 text-[22px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {isEdit ? t('editTitle') : t('createTitle')}
          </h1>
          <p className="m-0 mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
            {isEdit ? t('editSubtitle') : t('createSubtitle')}
          </p>
        </div>
        <DsButton dsVariant="ghost" href={backHref}>
          <ArrowLeft size={15} aria-hidden /> {t('back')}
        </DsButton>
      </header>

      {/* Two-column layout: form (flexible) + sticky preview (376px). Stacks to
          a single column under lg with the preview on top (order-first). At lg+
          it becomes a real two-track grid. */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_376px] lg:items-start">
        <div className="order-last min-w-0 lg:order-none">
          <CompanyPageForm
            submitLabel={isEdit ? t('save') : t('create')}
            submitting={saving}
            onSubmit={handleFinish}
            initial={initial}
            form={form}
            logo={logo}
            onLogoChange={setLogo}
            banner2={bannerImg}
            onBannerChange={setBannerImg}
            video={video}
            onVideoChange={setVideo}
            videoPosters={videoPosters}
            onVideoPostersChange={setVideoPosters}
            hideFooter
          />

          {/* Footer actions live here so we can offer "Save as draft" alongside
              the primary. The primary fires the lifted form's onFinish. */}
          {/* Mobile: stack the hint above a button block where Cancel + Save as
              draft share a row and the primary spans full width below it (clear
              prominence + a big tap target). sm+ restores the single inline,
              right-aligned action row. */}
          <div
            className="mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5 sm:px-5"
            style={{
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border-light)',
              borderRadius: 'var(--cr-radius-lg)',
            }}
          >
            <span className="text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('footerHint')}
            </span>
            <div className="grid w-full grid-cols-2 gap-2.5 sm:ms-auto sm:flex sm:w-auto sm:flex-wrap">
              {/* Cancel = leave without saving; returns to the manage console
                  (edit) or the pages hub (create). Mirrors the header Back so the
                  exit is reachable from the action row too. */}
              <DsButton
                dsVariant="ghost"
                href={backHref}
                disabled={busy}
                className="w-full justify-center sm:w-auto"
              >
                {t('cancel')}
              </DsButton>
              <DsButton
                dsVariant="ghost"
                onClick={() => void handleSaveDraft()}
                loading={savingDraft}
                disabled={busy}
                className="w-full justify-center sm:w-auto"
              >
                {t('saveDraft')}
              </DsButton>
              <DsButton
                dsVariant="primary"
                onClick={() => form.submit()}
                loading={saving}
                disabled={busy}
                className="col-span-2 w-full justify-center sm:w-auto"
              >
                {isEdit ? t('save') : t('create')}
              </DsButton>
            </div>
          </div>
        </div>

        {/* Sticky live preview. On lg+ it sticks beside the form; when stacked
            (under lg) it sits above the form (order-first) and scrolls normally. */}
        <aside className="order-first lg:sticky lg:top-[74px] lg:order-none">
          <CompanyPagePreview
            name={watchedName ?? initial?.name}
            logoUrl={logo[0]}
            bannerUrl={bannerImg[0]}
            about={watchedAbout ?? initial?.about}
            kind={watchedKind ?? initial?.kind ?? 'business'}
            specialization={watchedSpecialization ?? initial?.industryPanel?.specialization}
            machineCapacity={watchedMachineCapacity ?? initial?.industryPanel?.machineCapacity}
            production={watchedProduction ?? initial?.industryPanel?.production}
            coursesOffered={watchedCoursesOffered ?? initial?.institutePanel?.coursesOffered}
            modes={watchedModes ?? initial?.institutePanel?.modes}
            languages={watchedLanguages ?? initial?.industryPanel?.languages}
            district={watchedDistrict ?? initial?.location?.district}
            city={watchedCity ?? initial?.location?.city}
            state={watchedState ?? initial?.location?.state}
            visibility={
              watchedVisibility ?? companyPageInitialValues(initial).visibility ?? 'public'
            }
            erpLinked={!!initial?.erpWorkspaceId}
          />
        </aside>
      </div>
    </ConnectPage>
  );
}
