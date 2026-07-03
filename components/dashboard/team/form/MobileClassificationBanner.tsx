'use client';
import type React from 'react';
import { Button } from 'antd';
import Link from 'next/link';
import type { MobileClassification } from '@/types';

type AntdValidateStatus = 'success' | 'warning' | 'error' | 'validating' | '';

export interface MobileClassificationHelp {
  /**
   * ReactNode passed straight into the Mobile Form.Item's `help` prop. When
   * present, AntD renders this in place of the auto-generated validator error
   * text so the classification message and any inline CTA (deep-link to the
   * existing record, OTP-verify buttons) display as a single inline help
   * row directly below the field, matching the visual rhythm of AntD's
   * built-in form-validator messages.
   */
  help?: React.ReactNode;
  /**
   * Drives the AntD form-explain colour (red / amber / green) AND the
   * right-side feedback icon (cross / exclamation / tick). Left undefined
   * for the loading + invalid-format kinds so AntD's auto-validation
   * colouring takes over.
   */
  validateStatus?: AntdValidateStatus;
}

interface BuildArgs {
  status: MobileClassification | null;
  loading?: boolean;
  t: (key: string, vars?: Record<string, string | number | Date>) => string;
  /** Phase 1f: opens the OTP modal from the `registered` kind. */
  onVerifyClick?: () => void;
  /** Phase 1f: clears any stashed OTP proof token (skip-for-now path). */
  onSkipClick?: () => void;
  /**
   * Phase 1f: when set, the `registered` kind switches to its
   * post-verify success state and the verify / skip CTAs are hidden.
   */
  verifiedToken?: string;
  /**
   * Phase 1f UX polish: owner clicked "Skip verification" on the registered
   * banner. Banner switches to an acknowledgement message explaining where
   * verification can be done later, so the click has visible feedback and
   * the owner is not left wondering whether the button worked.
   */
  skipped?: boolean;
}

/**
 * Builds the inline help payload for the Add-Member Mobile field based on the
 * latest classification status from `useMobileClassification`. Replaces the
 * earlier big-Alert banner with a single-line message that lives in AntD's
 * native `help` slot, so colour + spacing + icon stay consistent with every
 * other form-validator error in the product. Inline CTAs (deep-link / OTP
 * buttons) sit on the same line as the message rather than on a separate row.
 *
 * Phase 1f (2026-05-21) collapsed the 3 cross-tenant kinds
 * (platform_user_other_ws / team_member_other_ws / pending_invite_other_ws)
 * into a single neutral `registered` branch that exposes an OTP-verify CTA
 * instead of leaking workspace counts.
 */
export function buildMobileClassificationHelp(args: BuildArgs): MobileClassificationHelp {
  const { status, loading, t, onVerifyClick, onSkipClick, verifiedToken, skipped } = args;

  // While the classifier is in-flight or the user is still typing, let AntD's
  // own auto-validation drive the help / status (returns empty object).
  if (loading || !status) return {};

  switch (status.kind) {
    case 'unregistered':
      return {
        help: t('unregistered'),
        validateStatus: 'success',
      };

    case 'invalid_format':
      // Field-level format error is already covered by the sync rule's
      // `isValidIndianMobile` check; let AntD render that message in red.
      return {};

    case 'workspace_owner_self':
      return {
        help: `${t('workspaceOwnerSelf.title')}. ${t('workspaceOwnerSelf.body', { name: status.ownerName })}`,
        validateStatus: 'error',
      };

    case 'active_member_this_ws':
      return {
        help: (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>{t('activeMemberThisWs.title', { name: status.memberName })}.</span>
            <Link
              href={`/dashboard/team/${status.memberId}`}
              className="font-medium underline underline-offset-2"
            >
              {t('activeMemberThisWs.openRecord')}
            </Link>
          </span>
        ),
        validateStatus: 'error',
      };

    case 'archived_member_this_ws':
      return {
        help: `${t('archivedMemberThisWs.title', { name: status.memberName })}. ${t('archivedMemberThisWs.body')}`,
        validateStatus: 'warning',
      };

    case 'pending_invite_this_ws':
      return {
        help: `${t('pendingInviteThisWs.title', { name: status.memberName })}. ${t(
          'pendingInviteThisWs.body',
          { date: status.inviteExpiresAt.slice(0, 10) },
        )}`,
        validateStatus: 'warning',
      };

    case 'registered':
      if (verifiedToken) {
        return {
          help: t('registered.verifiedTitle'),
          validateStatus: 'success',
        };
      }
      if (skipped) {
        return {
          help: (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>{t('registered.skipped')}</span>
              <button
                type="button"
                onClick={onVerifyClick}
                className="font-medium underline underline-offset-2"
              >
                {t('registered.undo')}
              </button>
            </span>
          ),
          validateStatus: 'warning',
        };
      }
      return {
        help: (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>
              {t('registered.title')}. {t('registered.body')}
            </span>
            <span className="inline-flex items-center gap-2">
              <Button size="small" type="primary" onClick={onVerifyClick}>
                {t('registered.verifyCta')}
              </Button>
              <Button size="small" onClick={onSkipClick}>
                {t('registered.skipCta')}
              </Button>
            </span>
          </span>
        ),
        validateStatus: 'warning',
      };

    default: {
      // Compile-time exhaustiveness guard.
      const _exhaustive: never = status;
      void _exhaustive;
      return {};
    }
  }
}
