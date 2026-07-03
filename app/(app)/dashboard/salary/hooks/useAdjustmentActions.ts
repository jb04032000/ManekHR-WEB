import { useState, useCallback } from 'react';
import { useWorkspaceStore } from '@/lib/store';
import {
  getSalaryAdjustments,
  createSalaryAdjustment,
  reverseSalaryAdjustment,
  ensureSalaryRecord,
} from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { useSalaryPageStore } from '../store/useSalaryPageStore';
import { ADDITION_CATEGORY_OPTIONS } from '../constants/salary-page.constants';
import type {
  SalaryRecord,
  SalaryAdjustment,
  CreateSalaryAdjustmentPayload,
  ReverseSalaryAdjustmentPayload,
  TeamMember,
} from '../types/salary-page.types';
import type { MessageInstance } from 'antd/es/message/interface';
import type { FormInstance } from 'antd';

interface UseAdjustmentActionsDeps {
  load: () => Promise<{ records: SalaryRecord[]; teamMembers: TeamMember[] }>;
  msgApi: MessageInstance;
  adjustmentForm: FormInstance;
  reverseAdjustmentForm: FormInstance;
  teamMembers: TeamMember[];
  canViewAdjustments: boolean;
  hydrateRecordWithMember: (record: SalaryRecord, members: TeamMember[]) => SalaryRecord;
  getRecordMemberId: (record: SalaryRecord) => string;
}

export function useAdjustmentActions(deps: UseAdjustmentActionsDeps) {
  const {
    load,
    msgApi,
    adjustmentForm,
    reverseAdjustmentForm,
    teamMembers,
    canViewAdjustments,
    hydrateRecordWithMember,
    getRecordMemberId,
  } = deps;
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const isHydrated = useWorkspaceStore((state) => state.isHydrated);
  const setAdjustmentDrawerRecord = useSalaryPageStore((state) => state.setAdjustmentDrawerRecord);
  const setAdjustmentHistory = useSalaryPageStore((state) => state.setAdjustmentHistory);
  const setAdjustmentsLoading = useSalaryPageStore((state) => state.setAdjustmentsLoading);

  const [adjustmentSaving, setAdjustmentSaving] = useState(false);
  const [reverseSaving, setReverseSaving] = useState(false);
  const [adjustmentProof, setAdjustmentProof] = useState<string | File | null>(null);
  const [adjustmentCorrectionSource, setAdjustmentCorrectionSource] =
    useState<SalaryAdjustment | null>(null);
  const [reverseAdjustmentTarget, setReverseAdjustmentTarget] = useState<SalaryAdjustment | null>(
    null,
  );
  const [reverseAdjustmentIntent, setReverseAdjustmentIntent] = useState<
    'reverse' | 'reverse_and_correct'
  >('reverse');

  const resetAdjustmentComposer = useCallback(() => {
    adjustmentForm.setFieldsValue({
      type: 'addition',
      category: ADDITION_CATEGORY_OPTIONS[0],
      amount: undefined,
      reasonTitle: '',
      note: '',
    });
    setAdjustmentProof(null);
    setAdjustmentCorrectionSource(null);
  }, [adjustmentForm]);

  const prepareAdjustmentCorrectionDraft = useCallback(
    (adjustment: SalaryAdjustment) => {
      adjustmentForm.setFieldsValue({
        type: adjustment.type,
        category: adjustment.category,
        amount: adjustment.amount,
        reasonTitle: adjustment.reasonTitle,
        note: adjustment.note ?? '',
      });
      setAdjustmentProof(null);
      setAdjustmentCorrectionSource(adjustment);
    },
    [adjustmentForm],
  );

  const openReverseAdjustmentModal = useCallback(
    (adjustment: SalaryAdjustment, intent: 'reverse' | 'reverse_and_correct' = 'reverse') => {
      setReverseAdjustmentIntent(intent);
      setReverseAdjustmentTarget(adjustment);
      reverseAdjustmentForm.setFieldsValue({
        reversalReason: '',
      });
    },
    [reverseAdjustmentForm],
  );

  const openAdjustments = useCallback(
    async (record: SalaryRecord) => {
      if (!canViewAdjustments) {
        msgApi.error('Your plan does not include salary adjustment access.');
        return;
      }

      const hydratedRecord = hydrateRecordWithMember(record, teamMembers);
      setAdjustmentDrawerRecord(hydratedRecord);
      setAdjustmentHistory([]);
      setReverseAdjustmentIntent('reverse');
      resetAdjustmentComposer();

      if (!currentWorkspaceId || !record._id) {
        return;
      }

      setAdjustmentsLoading(true);
      try {
        const history = await getSalaryAdjustments(currentWorkspaceId, record._id);
        setAdjustmentHistory(history);
      } catch (e) {
        msgApi.error(parseApiError(e));
      } finally {
        setAdjustmentsLoading(false);
      }
    },
    [
      canViewAdjustments,
      currentWorkspaceId,
      hydrateRecordWithMember,
      teamMembers,
      setAdjustmentDrawerRecord,
      setAdjustmentHistory,
      setAdjustmentsLoading,
      resetAdjustmentComposer,
      msgApi,
    ],
  );

  const refreshAdjustmentContext = useCallback(
    async (record: SalaryRecord) => {
      if (!currentWorkspaceId) return record;

      const { records: freshRecords, teamMembers: freshMembers } = await load();
      const memberId = getRecordMemberId(record);
      const freshRecord = freshRecords.find(
        (candidate: SalaryRecord) => getRecordMemberId(candidate) === memberId,
      );
      const nextRecord = hydrateRecordWithMember(freshRecord ?? record, freshMembers);

      setAdjustmentDrawerRecord(nextRecord);

      if (nextRecord._id) {
        const history = await getSalaryAdjustments(currentWorkspaceId, nextRecord._id);
        setAdjustmentHistory(history);
      } else {
        setAdjustmentHistory([]);
      }

      return nextRecord;
    },
    [
      currentWorkspaceId,
      getRecordMemberId,
      hydrateRecordWithMember,
      load,
      setAdjustmentDrawerRecord,
      setAdjustmentHistory,
    ],
  );

  const handleCreateAdjustment = useCallback(
    async (vals: CreateSalaryAdjustmentPayload) => {
      if (!currentWorkspaceId || !isHydrated) return;
      const adjustmentDrawerRecord = useSalaryPageStore.getState().adjustmentDrawerRecord;
      if (!adjustmentDrawerRecord) return;

      setAdjustmentSaving(true);
      try {
        const correctionSourceId = adjustmentCorrectionSource?._id;
        let targetRecord = adjustmentDrawerRecord;
        if (!targetRecord._id) {
          const memberId =
            typeof targetRecord.teamMemberId === 'string'
              ? targetRecord.teamMemberId
              : targetRecord.teamMemberId?._id || targetRecord.teamMember?.id;

          if (!memberId) {
            throw new Error('Cannot determine team member ID for this record.');
          }

          await ensureSalaryRecord(
            currentWorkspaceId,
            memberId,
            targetRecord.month,
            targetRecord.year,
          );
          const refreshedRecord = await refreshAdjustmentContext(targetRecord);
          if (!refreshedRecord._id) {
            throw new Error('Payroll record could not be generated for this employee.');
          }
          targetRecord = refreshedRecord;
        }

        let attachments: string[] | undefined;
        if (adjustmentProof instanceof File) {
          const { uploadService } = await import('@/lib/services/upload.service');
          const uploaded = await uploadService.uploadSingle(adjustmentProof, {
            category: 'proofs',
          });
          attachments = [uploaded.url];
        } else if (typeof adjustmentProof === 'string') {
          attachments = [adjustmentProof];
        }

        const payload: CreateSalaryAdjustmentPayload = {
          ...vals,
          amount: Number(vals.amount),
          correctionOfAdjustmentId: correctionSourceId,
          reasonTitle: vals.reasonTitle.trim(),
          note: vals.note?.trim() || undefined,
          attachments,
        };

        if (!targetRecord._id) {
          throw new Error('Payroll record could not be generated for this employee.');
        }

        await createSalaryAdjustment(currentWorkspaceId, targetRecord._id, payload);
        msgApi.success(
          correctionSourceId
            ? 'Corrected entry recorded'
            : payload.type === 'addition'
              ? 'Addition recorded'
              : 'Deduction recorded',
        );
        await refreshAdjustmentContext(targetRecord);
        resetAdjustmentComposer();
        setAdjustmentDrawerRecord(null);
      } catch (e) {
        msgApi.error(parseApiError(e));
      } finally {
        setAdjustmentSaving(false);
      }
    },
    [
      currentWorkspaceId,
      isHydrated,
      adjustmentCorrectionSource,
      adjustmentProof,
      refreshAdjustmentContext,
      resetAdjustmentComposer,
      setAdjustmentDrawerRecord,
      msgApi,
    ],
  );

  const handleReverseAdjustment = useCallback(
    async (vals: ReverseSalaryAdjustmentPayload) => {
      if (!currentWorkspaceId || !reverseAdjustmentTarget) return;

      setReverseSaving(true);
      try {
        const reverseTarget = reverseAdjustmentTarget;
        const reverseIntent = reverseAdjustmentIntent;
        const reversedAdjustment = await reverseSalaryAdjustment(
          currentWorkspaceId,
          reverseTarget._id,
          {
            reversalReason: vals.reversalReason.trim(),
          },
        );

        if (reverseIntent === 'reverse_and_correct') {
          prepareAdjustmentCorrectionDraft(reversedAdjustment);
          msgApi.success('Adjustment reversed. Review the corrected re-entry before saving.');
        } else {
          if (adjustmentCorrectionSource?._id === reverseTarget._id) {
            setAdjustmentCorrectionSource(reversedAdjustment);
          }
          msgApi.success('Adjustment reversed');
        }

        setReverseAdjustmentTarget(null);
        setReverseAdjustmentIntent('reverse');
        reverseAdjustmentForm.resetFields();
        const adjustmentDrawerRecord = useSalaryPageStore.getState().adjustmentDrawerRecord;
        if (adjustmentDrawerRecord) {
          await refreshAdjustmentContext(adjustmentDrawerRecord);
        } else {
          // Pillar-3 cache sync: a reversal changes netSalary/status and the
          // summary cards. When the adjustment drawer is NOT open (e.g. reversed
          // from the transactions modal), refreshAdjustmentContext never runs, so
          // refresh the salary list explicitly so the row + summary cards update.
          await load();
        }
      } catch (e) {
        msgApi.error(parseApiError(e));
      } finally {
        setReverseSaving(false);
      }
    },
    [
      currentWorkspaceId,
      reverseAdjustmentTarget,
      reverseAdjustmentIntent,
      adjustmentCorrectionSource,
      refreshAdjustmentContext,
      prepareAdjustmentCorrectionDraft,
      msgApi,
      reverseAdjustmentForm,
      load,
    ],
  );

  return {
    openAdjustments,
    handleCreateAdjustment,
    handleReverseAdjustment,
    refreshAdjustmentContext,
    resetAdjustmentComposer,
    prepareAdjustmentCorrectionDraft,
    openReverseAdjustmentModal,
    adjustmentSaving,
    reverseSaving,
    adjustmentProof,
    setAdjustmentProof,
    adjustmentCorrectionSource,
    setAdjustmentCorrectionSource,
    reverseAdjustmentTarget,
    setReverseAdjustmentTarget,
    reverseAdjustmentIntent,
    setReverseAdjustmentIntent,
  };
}
