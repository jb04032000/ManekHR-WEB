'use client';
/* eslint-disable react-hooks/exhaustive-deps -- Pre-existing lazy-loader effect (loadLookups) sets state inside useEffect; intentional manual deps for one-shot form-defaults effect; documented Phase 5 W4 carry-forward for separate refactor approval. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { App, Button, Form, Result, Steps } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import {
  createTeamMember,
  listShifts,
  listRoles,
  listTeam,
  listLocations,
  createMemberDocument,
} from '@/lib/actions';
import { getEmployeeCodeSettings } from '@/lib/actions/workspaces.actions';
import { parseApiError } from '@/lib/utils';
import { uploadService } from '@/lib/services/upload.service';
import type {
  Shift,
  Role,
  Location,
  TeamMember,
  PendingDocument,
  TeamMemberDocumentType,
  EmployeeComponentOverride,
  CreateTeamMemberPayload,
  CreateTeamMemberResult,
  EmployeeCodeSettings,
} from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

import PersonalTab from '@/components/dashboard/team/form/PersonalTab';
import { useUniqueIdentifierValidator } from '@/components/dashboard/team/form/useUniqueIdentifierValidator';
import WorkTab from '@/components/dashboard/team/form/WorkTab';
import BankTab from '@/components/dashboard/team/form/BankTab';
import DocumentsTab from '@/components/dashboard/team/form/DocumentsTab';
import CreateShiftDrawer from '@/components/dashboard/team/form/CreateShiftDrawer';
import CreateDesignationModal from '@/components/dashboard/team/form/CreateDesignationModal';
import { DocumentUploadModal } from '@/components/dashboard/team/DocumentUploadModal';
import { DocumentPreviewModal } from '@/components/dashboard/team/DocumentPreviewModal';
import {
  DEFAULT_KARIGAR_FORM_VALUES,
  DEFAULT_SALARY_CALC_FORM_VALUES,
  DEFAULT_STATUTORY_FORM_VALUES,
  renderEmployeeCode,
} from '@/components/dashboard/team/form/memberFormDefaults';
import { buildMemberPayload } from '@/components/dashboard/team/form/memberFormPayload';

import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

type StepKey = 'personal' | 'employment' | 'bank' | 'documents' | 'review';

const STEP_FIELDS: Record<StepKey, string[]> = {
  personal: [
    'name',
    'mobile',
    'email',
    'gender',
    'dateOfBirth',
    'bloodGroup',
    'address',
    'emergencyContactName',
    'emergencyContactNumber',
    // employeeCode removed: it is system-generated on save, never a form field.
    'maritalStatus',
    'avatar',
  ],
  employment: [
    'designation',
    'locationId',
    'location',
    'dateOfJoining',
    'salaryType',
    'salaryAmount',
    'salaryDayBasis',
    'fixedMonthDays',
    'attendancePayMode',
    'dailyHours',
    'finalMonthlyOverride',
    'pan',
    'uan',
    'taxRegime',
    'stateOfEmployment',
    'employmentType',
    'pfApplicable',
    'pfOptedOut',
    'esiApplicable',
    'esiIpNumber',
    'isNonItrFiler',
    'scheduleType',
    'shiftId',
    'weeklyOff',
    'customScheduleStart',
    'customScheduleEnd',
    'rbacRoleId',
    'reportsTo',
    'ctcAmount',
    'componentTemplateId',
    'isActive',
    'isKarigar',
    'karigarSkillType',
    'karigarDailyRateRupees',
  ],
  bank: [
    'bankName',
    'accountHolderName',
    'isSameAsEmployeeName',
    'accountNumber',
    'confirmAccountNumber',
    'ifscCode',
    'upiId',
    'qrCodeUrl',
    'preferredMethod',
  ],
  documents: [],
  review: [],
};

const STEP_ORDER: StepKey[] = ['personal', 'employment', 'bank', 'documents', 'review'];

export default function AddMemberPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('team');
  const { currentWorkspaceId, currentWorkspace } = useWorkspaceStore();
  // Plan/subscription state for the defense-in-depth module guard below.
  const { entitlements } = useSubscriptionStore();
  const { message: msgApi, modal } = App.useApp();
  const [form] = Form.useForm();

  const { validateMobile, validateEmail } = useUniqueIdentifierValidator({
    workspaceId: currentWorkspaceId ?? null,
  });

  // Initial step seeded from ?step= so refreshes / shared links restore wizard
  // position. Subsequent step changes sync back via the state→URL effect below.
  const urlStep = (searchParams?.get('step') as StepKey | null) ?? null;
  const initialStep: StepKey = urlStep && STEP_ORDER.includes(urlStep) ? urlStep : 'personal';
  const [currentStep, setCurrentStep] = useState<StepKey>(initialStep);
  // Tracks the furthest step the user has reached via Next / Skip (or the
  // initial URL seed). Drives forward-jump permissions from the Steps header
  // so completed steps remain navigable while unvisited ones stay gated.
  const [maxReachedIndex, setMaxReachedIndex] = useState<number>(STEP_ORDER.indexOf(initialStep));
  // Optional steps (Bank, Documents) the user chose to Skip. A skipped step is
  // NOT validated at final submit, so partially touching it (e.g. picking a
  // preferred payment method, then skipping) never blocks submission. Advancing
  // a step via Next clears it from this set so a completed step is still
  // validated at submit.
  const [skippedSteps, setSkippedSteps] = useState<Set<StepKey>>(new Set());
  const [roles, setRoles] = useState<Role[]>([]);
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [localShifts, setLocalShifts] = useState<Shift[]>([]);
  // Workspace Locations master list (shared with Machines) → WorkTab radio.
  const [localLocations, setLocalLocations] = useState<Location[]>([]);
  // F2: workspace.designations is a union (string | DesignationRecord)[] for
  // back-compat. The wizard dropdown needs canonical strings - flatten here.
  const [localDesignations, setLocalDesignations] = useState<string[]>(
    (currentWorkspace?.designations ?? []).map((d) => (typeof d === 'string' ? d : d.canonical)),
  );
  useEffect(() => {
    setLocalDesignations(
      (currentWorkspace?.designations ?? []).map((d) => (typeof d === 'string' ? d : d.canonical)),
    );
  }, [currentWorkspace?.designations]);

  const [componentOverrides, setComponentOverrides] = useState<EmployeeComponentOverride[]>([]);
  const [editingOverride, setEditingOverride] = useState<string | null>(null);

  const [employeeCodeSettings, setEmployeeCodeSettings] = useState<EmployeeCodeSettings | null>(
    null,
  );
  const [nextEmpCodeSeq, setNextEmpCodeSeq] = useState(1);
  // Workspace code ({WS} token) for the live preview — fixed, server-derived.
  const [empCodeWorkspaceCode, setEmpCodeWorkspaceCode] = useState('');

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // Submitted flag: cleared right before router.push on success so the
  // unsaved-changes guard doesn't prompt as we navigate to the new member's page.
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Wrapped setter for WorkTab so user-driven override edits trip the
  // unsaved-changes guard. Mirrors edit page's trackedSetComponentOverrides.
  // Declared after setIsDirty so the closure resolves the latest binding.
  const trackedSetComponentOverrides = useCallback<
    React.Dispatch<React.SetStateAction<EmployeeComponentOverride[]>>
  >((updater) => {
    setComponentOverrides(updater);
    setIsDirty(true);
  }, []);

  const [createShiftOpen, setCreateShiftOpen] = useState(false);
  const [createDesignationOpen, setCreateDesignationOpen] = useState(false);

  // ── App access note (review step) ───────────────────────────────────────────
  // The full grant flow (warm/cold invitee context, channel picker, permission
  // overrides) lives on the member detail page's App access tab
  // (AppAccessSection.tsx) and needs the member record to exist - it cannot be
  // replicated pre-create. The review step only shows an informational note
  // pointing there. Hidden when the subscription lacks the `grant_app_access`
  // sub-feature so we don't advertise a surface the owner can't use.
  const grantAccessFeature = useFeatureAccess('team', 'grant_app_access');

  // Pending docs queue (upload after save)
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalType, setUploadModalType] = useState<TeamMemberDocumentType | null>(null);
  const [previewSource, setPreviewSource] = useState<{
    fileUrl: string;
    fileName?: string;
    mimeType?: string;
    type: TeamMemberDocumentType;
    label?: string;
  } | null>(null);

  // ── Initial lookups ────────────────────────────────────────────────────────
  const loadLookups = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoadingLookups(true);
    setLookupError(null);
    try {
      const [shiftsRes, rolesRes, teamRes, codeRes, locationsRes] = await Promise.allSettled([
        listShifts(currentWorkspaceId),
        listRoles(currentWorkspaceId),
        listTeam(currentWorkspaceId, { limit: 500 }),
        getEmployeeCodeSettings(currentWorkspaceId),
        listLocations(currentWorkspaceId),
      ]);

      if (shiftsRes.status === 'fulfilled') setLocalShifts(shiftsRes.value ?? []);
      if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value ?? []);
      if (locationsRes.status === 'fulfilled') setLocalLocations(locationsRes.value ?? []);
      if (teamRes.status === 'fulfilled') {
        const teamArr = Array.isArray(teamRes.value)
          ? teamRes.value
          : ((teamRes.value as { members?: TeamMember[] }).members ?? []);
        setAllMembers(teamArr);
      }
      if (codeRes.status === 'fulfilled' && codeRes.value?.ok) {
        setEmployeeCodeSettings(codeRes.value.data.settings ?? null);
        setNextEmpCodeSeq(codeRes.value.data.nextSequence ?? 1);
        setEmpCodeWorkspaceCode(codeRes.value.data.workspaceCode ?? '');
      }
    } finally {
      setLoadingLookups(false);
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  // ── Form defaults ──────────────────────────────────────────────────────────
  useEffect(() => {
    form.setFieldsValue({
      salaryType: 'monthly',
      scheduleType: 'shift',
      isSameAsEmployeeName: false,
      isActive: true,
      ...DEFAULT_STATUTORY_FORM_VALUES,
      ...DEFAULT_SALARY_CALC_FORM_VALUES,
      ...DEFAULT_KARIGAR_FORM_VALUES,
    });
    // setFieldsValue triggers onValuesChange → flips isDirty=true.
    // Clear it on the same tick so the unsaved-changes guard only kicks in
    // after a real user edit, not from the initial defaults seed.
    setIsDirty(false);
  }, []);

  // ── Cross-tab watchers ─────────────────────────────────────────────────────
  const watchedName = Form.useWatch('name', form);
  const isSameAsEmployeeName = Form.useWatch('isSameAsEmployeeName', form);
  const pfApplicable = Form.useWatch('pfApplicable', form);
  const salaryAmountWatch = Form.useWatch('salaryAmount', form);
  const esiApplicable = Form.useWatch('esiApplicable', form);

  useEffect(() => {
    if (isSameAsEmployeeName) {
      form.setFieldValue('accountHolderName', watchedName || '');
    }
  }, [isSameAsEmployeeName, watchedName, form]);

  useEffect(() => {
    const isPfOptOutAllowed = pfApplicable === true && Number(salaryAmountWatch ?? 0) > 15000;
    if (!isPfOptOutAllowed && form.getFieldValue('pfOptedOut')) {
      form.setFieldValue('pfOptedOut', false);
    }
  }, [pfApplicable, salaryAmountWatch, form]);

  useEffect(() => {
    if (!esiApplicable && form.getFieldValue('esiIpNumber')) {
      form.setFieldValue('esiIpNumber', undefined);
    }
  }, [esiApplicable, form]);

  // ── URL ↔ step sync ───────────────────────────────────────────────────────
  // Mirrors the edit page's ?tab= sync: refreshing or sharing a wizard URL
  // restores wizard position. Initial step is seeded from the URL above; this
  // effect keeps the URL in step (pun intended) as the user advances/backs.
  useEffect(() => {
    const current = searchParams?.get('step');
    if (current === currentStep || (currentStep === 'personal' && !current)) return;
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    if (currentStep === 'personal') sp.delete('step');
    else sp.set('step', currentStep);
    const qs = sp.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [currentStep]);

  // ── Browser-level guard when leaving page with unsaved edits ──────────────
  // Mirrors edit page pattern. justSubmitted short-circuits the prompt right
  // before the post-submit redirect to /dashboard/team/:id.
  useEffect(() => {
    if (!isDirty || justSubmitted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, justSubmitted]);

  // ── In-app navigation guard (sidebar, top header, breadcrumbs, back btn) ──
  // Mirrors edit page: intercepts anchor clicks + browser back/forward while
  // dirty and surfaces the same Modal.confirm UX as handleCancel for parity
  // across every exit surface.
  useEffect(() => {
    if (!isDirty || justSubmitted) return;

    const confirmLeave = (onConfirm: () => void) => {
      modal.confirm({
        title: t('detailLeaveTitle'),
        icon: <ExclamationCircleOutlined />,
        content: t('detailLeaveContent'),
        okText: t('detailLeavePage'),
        okButtonProps: { danger: true },
        cancelText: t('detailStay'),
        onOk: onConfirm,
      });
    };

    const onAnchorClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      let dest: URL;
      try {
        dest = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (dest.origin !== window.location.origin) return;
      if (dest.pathname === window.location.pathname && dest.search === window.location.search)
        return;

      e.preventDefault();
      e.stopPropagation();
      confirmLeave(() => router.push(dest.pathname + dest.search + dest.hash));
    };

    const sentinel = { __unsavedGuard: true };
    window.history.pushState(sentinel, '', window.location.href);
    const onPopState = () => {
      window.history.pushState(sentinel, '', window.location.href);
      confirmLeave(() => {
        window.history.go(-2);
      });
    };

    // Keyboard-shortcut nav (g>h, g>d, g>t, etc.) calls router.push directly
    // from KeyboardShortcutProvider, bypassing the anchor-click + popstate
    // surfaces above. The provider now dispatches a cancellable 'cr:beforenav'
    // event before navigating; we intercept it here and route through the
    // same confirm-leave UX as every other exit surface.
    const onShortcutNav = (e: Event) => {
      const ce = e as CustomEvent<{ href: string }>;
      if (!ce.detail?.href) return;
      e.preventDefault();
      const target = ce.detail.href;
      confirmLeave(() => router.push(target));
    };

    document.addEventListener('click', onAnchorClick, true);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('cr:beforenav', onShortcutNav);
    return () => {
      document.removeEventListener('click', onAnchorClick, true);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('cr:beforenav', onShortcutNav);
    };
  }, [isDirty, justSubmitted, router, modal, t]);

  const employeeCodePreview = useMemo(() => {
    if (!employeeCodeSettings?.enabled || !employeeCodeSettings.format) return '';
    return renderEmployeeCode(
      employeeCodeSettings.format,
      employeeCodeSettings.prefix ?? '',
      nextEmpCodeSeq,
      empCodeWorkspaceCode,
    );
  }, [employeeCodeSettings, nextEmpCodeSeq, empCodeWorkspaceCode]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goNext = async () => {
    const fields = STEP_FIELDS[currentStep];
    try {
      if (fields.length > 0) {
        await form.validateFields(fields);
      }
      // Reaching here means this step passed validation (or has no fields), so
      // it counts as completed: clear any prior Skip so it is validated again
      // at final submit.
      setSkippedSteps((prev) => {
        if (!prev.has(currentStep)) return prev;
        const next = new Set(prev);
        next.delete(currentStep);
        return next;
      });
      const idx = STEP_ORDER.indexOf(currentStep);
      if (idx < STEP_ORDER.length - 1) {
        const nextIdx = idx + 1;
        setCurrentStep(STEP_ORDER[nextIdx]);
        setMaxReachedIndex((prev) => Math.max(prev, nextIdx));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      msgApi.error(t('newStepError'));
    }
  };

  const goBack = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(STEP_ORDER[idx - 1]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const skipStep = () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx < STEP_ORDER.length - 1) {
      // Mark this optional step skipped so its fields are excluded from the
      // final-submit validation. The user explicitly chose not to fill it.
      setSkippedSteps((prev) => new Set(prev).add(currentStep));
      const nextIdx = idx + 1;
      setCurrentStep(STEP_ORDER[nextIdx]);
      setMaxReachedIndex((prev) => Math.max(prev, nextIdx));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const doCancel = () => {
    pendingDocs.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setIsDirty(false);
    router.push('/dashboard/team');
  };

  const handleCancel = () => {
    if (!isDirty) {
      doCancel();
      return;
    }
    modal.confirm({
      title: t('detailDiscardTitle'),
      icon: <ExclamationCircleOutlined />,
      content: t('detailDiscardContent'),
      okText: t('detailDiscard'),
      okButtonProps: { danger: true },
      cancelText: t('detailKeepEditing'),
      onOk: doCancel,
    });
  };

  // ── Document queue ─────────────────────────────────────────────────────────
  const handleOpenUpload = (type: TeamMemberDocumentType) => {
    setUploadModalType(type);
    setUploadModalOpen(true);
  };

  const handleCloseUpload = () => {
    setUploadModalOpen(false);
    setUploadModalType(null);
  };

  const handleConfirmUpload = async (file: File, label?: string) => {
    if (!uploadModalType) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingDocs((prev) => [
      ...prev,
      {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: uploadModalType,
        label,
        file,
        previewUrl,
        fileName: file.name,
      },
    ]);
    setIsDirty(true);
    handleCloseUpload();
    msgApi.success(t('newDocQueued'));
  };

  const handleRemovePending = (localId: string) => {
    setPendingDocs((prev) => {
      const target = prev.find((p) => p.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
    setIsDirty(true);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!currentWorkspaceId) return;
    setSubmitting(true);
    try {
      // Validate only the steps the user did NOT skip. A skipped optional step
      // (Bank / Documents) must never block submission, even if the user
      // touched a field in it (e.g. picked a preferred payment method) before
      // skipping. Required steps (Personal, Employment) are never skippable, so
      // they are always validated. Payload is still built from the full form
      // values so any data the user did enter in a skipped step is preserved.
      const fieldsToValidate = STEP_ORDER.filter((s) => !skippedSteps.has(s)).flatMap(
        (s) => STEP_FIELDS[s],
      );
      await form.validateFields(fieldsToValidate);
      const vals = form.getFieldsValue(true) as Record<string, unknown>;

      let avatarUrl = vals.avatar as string | undefined;
      if (vals.avatar instanceof File) {
        const response = await uploadService.uploadSingle(vals.avatar, {
          category: 'avatars',
        });
        avatarUrl = response.url;
      }

      let qrCodeUrl = vals.qrCodeUrl as string | undefined;
      if (vals.qrCodeUrl instanceof File) {
        const response = await uploadService.uploadSingle(vals.qrCodeUrl, {
          category: 'qrcodes',
        });
        qrCodeUrl = response.url;
      }

      const payload = buildMemberPayload({
        vals,
        mode: 'add',
        avatarUrl,
        qrCodeUrl,
        componentOverrides,
      }) as CreateTeamMemberPayload;

      // Employee code is ALWAYS system-generated server-side (embeds the {WS}
      // workspace token) and immutable. The client never sends a code - the
      // backend ignores any client-supplied value - so nothing is copied here.

      const result: CreateTeamMemberResult = await createTeamMember(currentWorkspaceId, payload);

      if (result.employeeCodeNotice?.code === 'EMP_CODE_BUMPED') {
        msgApi.info(t('newEmpCodeBumped', { code: result.employeeCodeNotice.assigned }));
      }

      // Flush pending documents
      if (pendingDocs.length > 0) {
        const newMemberId = result.member.id;
        let failed = 0;
        for (const pending of pendingDocs) {
          try {
            const uploaded = await uploadService.uploadSingle(pending.file, {
              category: 'proofs',
            });
            await createMemberDocument(currentWorkspaceId, newMemberId, {
              type: pending.type,
              label: pending.label,
              fileUrl: uploaded.url,
              fileName: pending.fileName,
              fileSize: pending.file.size,
              mimeType: pending.file.type,
            });
          } catch (uploadErr) {
            console.error('[AddMember] pending doc upload failed', uploadErr);
            failed += 1;
          }
        }
        if (failed === 0) {
          msgApi.success(t('newDocsUploaded', { count: pendingDocs.length }));
        } else if (failed < pendingDocs.length) {
          msgApi.warning(
            t('newDocsPartial', {
              ok: pendingDocs.length - failed,
              failed,
            }),
          );
        } else {
          msgApi.error(t('newDocsAllFailed'));
        }
        pendingDocs.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        setPendingDocs([]);
      }

      msgApi.success(t('newMemberAdded'));

      // Clear guards before navigation so beforeunload + in-app nav-intercept
      // don't prompt as we redirect to the new member's page.
      setIsDirty(false);
      setJustSubmitted(true);

      // Land on the new member's profile; the App access tab there owns the
      // full grant flow (AppAccessSection.tsx).
      router.push(`/dashboard/team/${result.member.id}`);
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        msgApi.error(t('detailFillRequired'));
      } else {
        const raw = e instanceof Error ? e.message : parseApiError(e);
        // No EMP_CODE_CONFLICT branch: employee codes are system-generated and
        // the client never submits one, so a client-driven code conflict is
        // impossible here. The backend resolves any collision by bumping the
        // sequence and signals it via result.employeeCodeNotice (handled above).
        if (raw.startsWith('MEMBER_MOBILE_CONFLICT:')) {
          const msg = raw.slice('MEMBER_MOBILE_CONFLICT:'.length);
          form.setFields([{ name: 'mobile', errors: [msg] }]);
          setCurrentStep('personal');
          msgApi.error(msg);
        } else if (raw.startsWith('MEMBER_EMAIL_CONFLICT:')) {
          const msg = raw.slice('MEMBER_EMAIL_CONFLICT:'.length);
          form.setFields([{ name: 'email', errors: [msg] }]);
          setCurrentStep('personal');
          msgApi.error(msg);
        } else {
          msgApi.error(raw);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Review step summary ────────────────────────────────────────────────────
  // Renders every field captured across the 4 prior steps, grouped by step so
  // the owner can scan-confirm before submit. Empty optional rows are filtered
  // out to keep the review tight; lookup IDs (role, reports-to, shift) resolve
  // to human labels via the in-memory lists.
  const renderReview = () => {
    const vals = form.getFieldsValue(true) as Record<string, unknown>;
    type DayjsLike = { format?: (s: string) => string };
    const fmtDate = (d: unknown): string | undefined =>
      d && typeof (d as DayjsLike).format === 'function'
        ? (d as DayjsLike).format!('DD MMM YYYY')
        : undefined;
    const fmtCurrency = (v: unknown): string | undefined =>
      typeof v === 'number' && Number.isFinite(v) ? `₹${v.toLocaleString('en-IN')}` : undefined;
    const fmtBool = (v: unknown): string | undefined =>
      v === true ? t('newReviewYes') : v === false ? t('newReviewNo') : undefined;
    const titleCase = (s: unknown): string | undefined =>
      typeof s === 'string' && s.length > 0
        ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : undefined;

    const avatarUrl =
      typeof vals.avatar === 'string' && vals.avatar.length > 0
        ? (vals.avatar as string)
        : undefined;
    const fullName = typeof vals.name === 'string' ? vals.name : '';
    const initials =
      fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || '·';

    const salaryDisplay =
      typeof vals.salaryAmount === 'number'
        ? `₹${vals.salaryAmount.toLocaleString('en-IN')} ${vals.salaryType === 'hourly' ? t('newReviewPerHour') : t('newReviewPerMonth')}`
        : undefined;
    const finalOverrideDisplay =
      typeof vals.finalMonthlyOverride === 'number'
        ? `₹${vals.finalMonthlyOverride.toLocaleString('en-IN')} ${t('newReviewPerMonth')}`
        : undefined;
    const roleLabel = roles.find((r) => r._id === vals.rbacRoleId)?.name;
    const reportsToLabel = allMembers.find((m) => m.id === vals.reportsTo)?.name;
    const shiftLabel = localShifts.find((s) => s._id === vals.shiftId)?.name;
    const preferredMethodLabel = ((): string | undefined => {
      switch (vals.preferredMethod) {
        case 'BANK':
          return t('newReviewMethodBank');
        case 'UPI':
          return t('newReviewMethodUpi');
        case 'CASH':
          return t('newReviewMethodCash');
        default:
          return undefined;
      }
    })();

    type Row = { label: string; value: string | number | undefined; fullWidth?: boolean };

    const personalRows: Row[] = [
      {
        label: t('newReviewLabelFullName'),
        value: typeof vals.name === 'string' ? vals.name : undefined,
      },
      {
        label: t('newReviewLabelEmployeeCode'),
        value:
          (typeof vals.employeeCode === 'string' && vals.employeeCode.length > 0
            ? vals.employeeCode
            : employeeCodePreview) || undefined,
      },
      {
        label: t('newReviewMobile'),
        value: typeof vals.mobile === 'string' ? vals.mobile : undefined,
      },
      {
        label: t('newReviewEmail'),
        value: typeof vals.email === 'string' ? vals.email : undefined,
      },
      { label: t('newReviewLabelGender'), value: titleCase(vals.gender) },
      { label: t('newReviewLabelDateOfBirth'), value: fmtDate(vals.dateOfBirth) },
      { label: t('newReviewLabelMaritalStatus'), value: titleCase(vals.maritalStatus) },
      {
        label: t('newReviewLabelBloodGroup'),
        value: typeof vals.bloodGroup === 'string' ? vals.bloodGroup : undefined,
      },
      {
        label: t('newReviewLabelAddress'),
        value: typeof vals.address === 'string' ? vals.address : undefined,
        fullWidth: true,
      },
      {
        label: t('newReviewLabelEmergencyName'),
        value:
          typeof vals.emergencyContactName === 'string' ? vals.emergencyContactName : undefined,
      },
      {
        label: t('newReviewLabelEmergencyNumber'),
        value:
          typeof vals.emergencyContactNumber === 'string' ? vals.emergencyContactNumber : undefined,
      },
    ];

    const employmentRows: Row[] = [
      {
        label: t('newReviewDesignation'),
        value: typeof vals.designation === 'string' ? vals.designation : undefined,
      },
      { label: t('newReviewJoining'), value: fmtDate(vals.dateOfJoining) },
      { label: t('newReviewLabelRole'), value: roleLabel },
      { label: t('newReviewLabelReportsTo'), value: reportsToLabel },
      { label: t('newReviewLabelEmploymentType'), value: titleCase(vals.employmentType) },
      { label: t('newReviewLabelSchedule'), value: titleCase(vals.scheduleType) },
      { label: t('newReviewLabelShift'), value: shiftLabel },
      {
        label: t('newReviewLabelDailyHours'),
        value:
          typeof vals.dailyHours === 'number'
            ? t('newReviewHoursSuffix', { hours: vals.dailyHours })
            : undefined,
      },
      { label: t('newReviewSalary'), value: salaryDisplay },
      { label: t('newReviewLabelOverrideMonthly'), value: finalOverrideDisplay },
      { label: t('newReviewLabelCtc'), value: fmtCurrency(vals.ctcAmount) },
      { label: t('newReviewLabelSalaryDayBasis'), value: titleCase(vals.salaryDayBasis) },
      {
        label: t('newReviewLabelFixedMonthDays'),
        value:
          vals.salaryDayBasis === 'fixed_month_days' && typeof vals.fixedMonthDays === 'number'
            ? vals.fixedMonthDays
            : undefined,
      },
      { label: t('newReviewLabelAttendancePayMode'), value: titleCase(vals.attendancePayMode) },
      { label: t('newReviewLabelPfApplicable'), value: fmtBool(vals.pfApplicable) },
      {
        label: t('newReviewLabelPfOptedOut'),
        value:
          vals.pfApplicable === true && vals.pfOptedOut === true ? t('newReviewYes') : undefined,
      },
      { label: t('newReviewLabelEsiApplicable'), value: fmtBool(vals.esiApplicable) },
      {
        label: t('newReviewLabelEsiIpNumber'),
        value: typeof vals.esiIpNumber === 'string' ? vals.esiIpNumber : undefined,
      },
      { label: t('newReviewLabelPan'), value: typeof vals.pan === 'string' ? vals.pan : undefined },
      { label: t('newReviewLabelUan'), value: typeof vals.uan === 'string' ? vals.uan : undefined },
      { label: t('newReviewLabelTaxRegime'), value: titleCase(vals.taxRegime) },
      {
        label: t('newReviewLabelStateOfEmployment'),
        value: typeof vals.stateOfEmployment === 'string' ? vals.stateOfEmployment : undefined,
      },
      { label: t('newReviewLabelNonItrFiler'), value: fmtBool(vals.isNonItrFiler) },
    ];

    const bankRows: Row[] = [
      { label: t('newReviewLabelPreferredMethod'), value: preferredMethodLabel },
      {
        label: t('newReviewLabelBankName'),
        value: typeof vals.bankName === 'string' ? vals.bankName : undefined,
      },
      {
        label: t('newReviewLabelAccountHolder'),
        value: typeof vals.accountHolderName === 'string' ? vals.accountHolderName : undefined,
      },
      {
        label: t('newReviewLabelAccountNumber'),
        value: typeof vals.accountNumber === 'string' ? vals.accountNumber : undefined,
      },
      {
        label: t('newReviewLabelIfsc'),
        value: typeof vals.ifscCode === 'string' ? vals.ifscCode : undefined,
      },
      {
        label: t('newReviewUpi'),
        value: typeof vals.upiId === 'string' ? vals.upiId : undefined,
      },
      {
        label: t('newReviewLabelQrUploaded'),
        value:
          typeof vals.qrCodeUrl === 'string' && vals.qrCodeUrl.length > 0
            ? t('newReviewYes')
            : undefined,
      },
    ];

    const filterRows = (arr: Row[]): Row[] =>
      arr.filter((r) => r.value !== undefined && r.value !== null && r.value !== '');

    const sections: { title: string; helper: string; rows: Row[] }[] = [
      {
        title: t('newReviewSectionPersonal'),
        helper: t('newReviewSectionPersonalHelper'),
        rows: filterRows(personalRows),
      },
      {
        title: t('newReviewSectionEmployment'),
        helper: t('newReviewSectionEmploymentHelper'),
        rows: filterRows(employmentRows),
      },
      {
        title: t('newReviewSectionBank'),
        helper: t('newReviewSectionBankHelper'),
        rows: filterRows(bankRows),
      },
    ];

    return (
      <div className="flex flex-col gap-5">
        {/* Review intro */}
        <div className="border-b border-gray-100 pb-2.5">
          <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
            {t('newReviewTitle')}
          </p>
          <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
            {t('newReviewSubtitle')}
          </p>
        </div>

        {/* Identity header - avatar + name + designation */}
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
          {avatarUrl ? (
            /* FileUpload returns arbitrary cloud URLs; Next/Image domain
               allowlist would force config churn per customer-uploaded asset.
               Plain img is correct here. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={fullName || t('newReviewAvatarAlt')}
              className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-gray-100"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--cr-primary-light,#E7F2EE)] text-base font-semibold tracking-wider text-[var(--cr-primary,#0B6E4F)] uppercase"
            >
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="m-0 truncate text-base font-semibold text-gray-900">
              {fullName || (
                <span className="font-normal text-[var(--cr-text-4)]">
                  {t('newReviewNameMissing')}
                </span>
              )}
            </p>
            {typeof vals.designation === 'string' && vals.designation.length > 0 && (
              <p className="m-0 mt-0.5 truncate text-sm text-[var(--cr-text-3)]">
                {vals.designation}
              </p>
            )}
          </div>
        </div>

        {/* Step-grouped detail sections */}
        {sections.map((section) => (
          <div key={section.title}>
            <div className="mb-2.5 border-b border-gray-100 pb-2.5">
              <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
                {section.title}
              </p>
              <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
                {section.helper}
              </p>
            </div>
            {section.rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 p-4 text-xs text-[var(--cr-text-4)]">
                {t('newReviewSectionEmpty')}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                  {section.rows.map((r) => (
                    <div
                      key={r.label}
                      className={`flex flex-col ${r.fullWidth ? 'md:col-span-2' : ''}`}
                    >
                      <dt className="text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
                        {r.label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-medium text-gray-800 tabular-nums">
                        {String(r.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        ))}

        {/* Documents section - pending uploads queued after submit */}
        <div>
          <div className="mb-2.5 border-b border-gray-100 pb-2.5">
            <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
              {t('newReviewSectionDocuments')}
            </p>
            <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
              {t('newReviewSectionDocumentsHelper')}
            </p>
          </div>
          {pendingDocs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 p-4 text-xs text-[var(--cr-text-4)]">
              {t('newReviewDocsEmpty')}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {pendingDocs.map((p) => (
                  <li
                    key={p.localId}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-gray-100"
                  >
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-medium text-gray-800">
                        {p.label || p.type}
                      </p>
                      <p className="m-0 mt-0.5 truncate text-xs text-[var(--cr-text-4)]">
                        {p.fileName}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-700 uppercase ring-1 ring-amber-200 ring-inset">
                      {t('newReviewPending')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* App access note - the full grant flow (invitee context, channel
            picker, permission overrides) lives on the member detail page's App
            access tab and needs the saved record, so the review step only
            points there. Keep in sync with AppAccessSection.tsx. */}
        {!grantAccessFeature.isLocked && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
              {t('newAccessHandoffTitle')}
            </p>
            <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
              {t('newAccessHandoffSubtitle')}
            </p>
          </div>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  // Plan/subscription defense-in-depth. The central plan-gate in
  // DashboardLayout already blocks /dashboard/team/* when the Team module is
  // not in the workspace plan, but mirror the ~60-page <ModuleLockedPage>
  // convention here too so the screen self-guards if the central route map ever
  // drops this entry. Mirrors Sidebar's useModuleEnabled('team').
  const teamModuleEnabled =
    entitlements?.moduleAccess?.some((m) => m.module === 'team' && m.enabled) ?? false;
  if (!teamModuleEnabled) {
    return <ModuleLockedPage module="team" />;
  }

  if (lookupError) {
    return (
      <Result
        status="error"
        title={t('newLookupErrorTitle')}
        subTitle={lookupError}
        extra={<Button onClick={handleCancel}>{t('newLookupErrorBack')}</Button>}
      />
    );
  }

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEP_ORDER.length - 1;
  const isOptionalStep = currentStep === 'bank' || currentStep === 'documents';

  // Compose "Next: <step name>" so the primary CTA previews the upcoming step
  // (Stripe Checkout / Typeform / AntD ProForm idiom). Reduces guesswork on
  // multi-step wizards. Falls back to plain "Next" if the next-step label is
  // missing for any reason.
  const stepLabelByKey: Record<StepKey, string> = {
    personal: t('newStepPersonal'),
    employment: t('newStepEmployment'),
    bank: t('newStepBank'),
    documents: t('newStepDocuments'),
    review: t('newStepReview'),
  };
  const nextStepLabel = !isLast ? stepLabelByKey[STEP_ORDER[stepIndex + 1]] : '';
  const nextButtonLabel = nextStepLabel ? `${t('newNext')}: ${nextStepLabel}` : t('newNext');

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleCancel}
              aria-label={t('newBackAria')}
            />
            <div>
              <h1 className="m-0 font-display text-[20px] font-bold text-gray-900">
                {t('newTitle')}
              </h1>
              <p className="m-0 text-sm text-gray-600">{t('newSubtitle')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          {/* Mobile (<768px): compact step indicator. AntD <Steps> auto-switches
              to a tall vertical rail below 532px (its `responsive` default), which
              ate the entire first screen on phones. Replace it with a one-line
              label + progress bar; the full horizontal rail still renders from
              tablet up. (mobile-responsive fix) */}
          <div className="mb-6 md:hidden">
            <div className="flex items-center justify-between gap-2">
              <p className="m-0 truncate text-[15px] font-semibold text-gray-900">
                {stepLabelByKey[currentStep]}
              </p>
              <span className="shrink-0 text-[13px] font-medium text-gray-500 tabular-nums">
                {stepIndex + 1} / {STEP_ORDER.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[var(--cr-primary)] transition-all duration-300"
                style={{ width: `${((stepIndex + 1) / STEP_ORDER.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Tablet/desktop: full step rail (wrapped so toggling visibility does
              not fight AntD Steps' own flex layout). */}
          <div className="hidden md:block">
            <Steps
              current={stepIndex}
              onChange={(next) => {
                if (next <= maxReachedIndex) {
                  setCurrentStep(STEP_ORDER[next]);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              items={[
                { title: t('newStepPersonal') },
                { title: t('newStepEmployment'), disabled: maxReachedIndex < 1 },
                { title: t('newStepBank'), disabled: maxReachedIndex < 2 },
                { title: t('newStepDocuments'), disabled: maxReachedIndex < 3 },
                { title: t('newStepReview'), disabled: maxReachedIndex < 4 },
              ]}
              responsive={false}
              className="mb-10 px-1 pt-2"
            />
            <div className="mb-6" />
          </div>

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onValuesChange={() => setIsDirty(true)}
          >
            <div className="min-h-[400px]">
              <div style={{ display: currentStep === 'personal' ? 'block' : 'none' }}>
                <PersonalTab
                  form={form}
                  mode="add"
                  editMode
                  member={null}
                  workspaceId={currentWorkspaceId ?? ''}
                  employeeCodeSettings={employeeCodeSettings}
                  employeeCodePreview={employeeCodePreview}
                  mobileAvailabilityValidator={validateMobile}
                  emailAvailabilityValidator={validateEmail}
                />
              </div>

              <div style={{ display: currentStep === 'employment' ? 'block' : 'none' }}>
                <WorkTab
                  form={form}
                  mode="add"
                  editMode
                  member={null}
                  workspaceId={currentWorkspaceId ?? ''}
                  roles={roles}
                  localShifts={localShifts}
                  localDesignations={localDesignations}
                  locations={localLocations}
                  allMembers={allMembers}
                  onOpenCreateShift={() => setCreateShiftOpen(true)}
                  onOpenCreateDesignation={() => setCreateDesignationOpen(true)}
                  componentOverrides={componentOverrides}
                  setComponentOverrides={trackedSetComponentOverrides}
                  editingOverride={editingOverride}
                  setEditingOverride={setEditingOverride}
                />
              </div>

              <div style={{ display: currentStep === 'bank' ? 'block' : 'none' }}>
                <BankTab form={form} mode="add" editMode />
              </div>

              <div style={{ display: currentStep === 'documents' ? 'block' : 'none' }}>
                <DocumentsTab
                  mode="add"
                  editMode
                  documents={[]}
                  pendingDocs={pendingDocs}
                  loading={false}
                  payrollEnabled={false}
                  onUploadClick={handleOpenUpload}
                  onPreview={setPreviewSource}
                  onDeleteServer={() => {}}
                  onRemovePending={handleRemovePending}
                />
              </div>

              {currentStep === 'review' && renderReview()}
            </div>
          </Form>

          {/* Desktop footer (sm+) - Cancel left, [Back / Skip / Next] right. */}
          <div className="mt-6 hidden items-center justify-between gap-2 border-t border-gray-200 pt-5 sm:flex">
            <Button onClick={handleCancel} disabled={submitting}>
              {t('newCancel')}
            </Button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button onClick={goBack} disabled={submitting}>
                  {t('newBack')}
                </Button>
              )}
              {isOptionalStep && !isLast && (
                <Button onClick={skipStep} disabled={submitting} type="dashed">
                  {t('newSkip')}
                </Button>
              )}
              {!isLast && (
                <Button
                  type="primary"
                  onClick={goNext}
                  disabled={loadingLookups || submitting}
                  data-shortcut="save"
                >
                  {nextButtonLabel}
                </Button>
              )}
              {isLast && (
                <Button
                  type="primary"
                  onClick={handleSubmit}
                  loading={submitting}
                  icon={<CheckOutlined />}
                  data-shortcut="save"
                >
                  {t('newSubmit')}
                </Button>
              )}
            </div>
          </div>

          {/* Mobile footer (< sm) - stacked so 4 actions never overflow off the
              right edge (which clipped "Next"). Primary CTA full-width on top,
              Back + Skip as an even secondary row, Cancel as a subtle text
              action at the bottom (the abort, least prominent). */}
          <div className="mt-6 flex flex-col gap-2 border-t border-gray-200 pt-5 sm:hidden">
            {!isLast ? (
              <Button type="primary" block onClick={goNext} disabled={loadingLookups || submitting}>
                {nextButtonLabel}
              </Button>
            ) : (
              <Button
                type="primary"
                block
                onClick={handleSubmit}
                loading={submitting}
                icon={<CheckOutlined />}
              >
                {t('newSubmit')}
              </Button>
            )}
            {(!isFirst || (isOptionalStep && !isLast)) && (
              <div className="flex gap-2">
                {!isFirst && (
                  <Button className="flex-1" onClick={goBack} disabled={submitting}>
                    {t('newBack')}
                  </Button>
                )}
                {isOptionalStep && !isLast && (
                  <Button className="flex-1" type="dashed" onClick={skipStep} disabled={submitting}>
                    {t('newSkip')}
                  </Button>
                )}
              </div>
            )}
            <Button type="text" block onClick={handleCancel} disabled={submitting}>
              {t('newCancel')}
            </Button>
          </div>
        </div>
      </div>

      <DocumentUploadModal
        open={uploadModalOpen}
        type={uploadModalType}
        uploading={false}
        progress={0}
        onClose={handleCloseUpload}
        onConfirm={handleConfirmUpload}
      />

      <DocumentPreviewModal
        open={!!previewSource}
        fileUrl={previewSource?.fileUrl ?? null}
        fileName={previewSource?.fileName}
        mimeType={previewSource?.mimeType}
        title={previewSource?.label ?? previewSource?.fileName ?? t('detailDocPreview')}
        onClose={() => setPreviewSource(null)}
      />

      <CreateShiftDrawer
        open={createShiftOpen}
        onClose={() => setCreateShiftOpen(false)}
        onCreated={(newShift) => {
          setLocalShifts((prev) => [...prev, newShift]);
          form.setFieldValue('shiftId', newShift._id ?? newShift.id);
          setCreateShiftOpen(false);
        }}
        workspaceId={currentWorkspaceId ?? ''}
      />

      <CreateDesignationModal
        open={createDesignationOpen}
        onClose={() => setCreateDesignationOpen(false)}
        onCreated={(newDesignation) => {
          setLocalDesignations((prev) => [...prev, newDesignation]);
          form.setFieldValue('designation', newDesignation);
          setCreateDesignationOpen(false);
        }}
        workspaceId={currentWorkspaceId ?? ''}
        existingDesignations={localDesignations}
      />
    </>
  );
}
