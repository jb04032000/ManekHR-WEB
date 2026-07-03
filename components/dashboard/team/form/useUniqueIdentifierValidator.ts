'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { checkTeamIdentifier } from '@/lib/actions';
import { isValidIndianMobile } from '@/lib/common/indian-mobile';

interface UseUniqueIdentifierValidatorArgs {
  workspaceId: string | null;
  excludeId?: string;
  debounceMs?: number;
}

interface UseUniqueIdentifierValidatorResult {
  validateMobile: (value: unknown) => Promise<void>;
  validateEmail: (value: unknown) => Promise<void>;
}

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns Ant Design async validators that hit
 * `GET /workspaces/:wsId/team/check-identifier` to flag duplicate mobile /
 * email within the workspace. Debounces per-field so the request fires only
 * after the user pauses typing; cancels superseded calls so stale results
 * don't overwrite a fresh value.
 *
 * Skips network when the value is empty or format-invalid - leaves those
 * cases to the field's existing format/required rule.
 */
export function useUniqueIdentifierValidator(
  args: UseUniqueIdentifierValidatorArgs,
): UseUniqueIdentifierValidatorResult {
  const { workspaceId, excludeId, debounceMs = 450 } = args;
  const t = useTranslations('team');
  const mobileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileTokenRef = useRef(0);
  const emailTokenRef = useRef(0);

  useEffect(
    () => () => {
      if (mobileTimerRef.current) clearTimeout(mobileTimerRef.current);
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    },
    [],
  );

  const validateMobile = useCallback(
    async (value: unknown): Promise<void> => {
      if (!workspaceId) return;
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (!trimmed) return;
      if (!isValidIndianMobile(trimmed)) return;

      if (mobileTimerRef.current) clearTimeout(mobileTimerRef.current);
      const myToken = ++mobileTokenRef.current;

      await new Promise<void>((resolve) => {
        mobileTimerRef.current = setTimeout(resolve, debounceMs);
      });
      if (myToken !== mobileTokenRef.current) return;

      const result = await checkTeamIdentifier(workspaceId, {
        mobile: trimmed,
        excludeId,
      });
      if (myToken !== mobileTokenRef.current) return;

      if (result.mobile && !result.mobile.available) {
        const who = result.mobile.conflictMemberName;
        return Promise.reject(
          who ? t('newMobileConflictNamed', { name: who }) : t('newMobileConflictAnon'),
        );
      }
    },
    [workspaceId, excludeId, debounceMs, t],
  );

  const validateEmail = useCallback(
    async (value: unknown): Promise<void> => {
      if (!workspaceId) return;
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (!trimmed) return;
      if (!EMAIL_FORMAT_RE.test(trimmed)) return;

      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
      const myToken = ++emailTokenRef.current;

      await new Promise<void>((resolve) => {
        emailTimerRef.current = setTimeout(resolve, debounceMs);
      });
      if (myToken !== emailTokenRef.current) return;

      const result = await checkTeamIdentifier(workspaceId, {
        email: trimmed,
        excludeId,
      });
      if (myToken !== emailTokenRef.current) return;

      if (result.email && !result.email.available) {
        const who = result.email.conflictMemberName;
        return Promise.reject(
          who ? t('newEmailConflictNamed', { name: who }) : t('newEmailConflictAnon'),
        );
      }
    },
    [workspaceId, excludeId, debounceMs, t],
  );

  return { validateMobile, validateEmail };
}
