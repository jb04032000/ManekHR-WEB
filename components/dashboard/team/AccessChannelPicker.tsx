'use client';

import { Checkbox } from 'antd';
import { useTranslations } from 'next-intl';

export type AccessChannel = 'in_app' | 'email' | 'sms' | 'whatsapp';

export interface AccessChannelSelection {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  /** Resend-only escape hatch - rotate the link with no dispatch. Grant
   *  context omits this (set `showJustRotate=false`). */
  justRotate: boolean;
}

interface Props {
  value: AccessChannelSelection;
  onChange: (next: AccessChannelSelection) => void;
  /** True when invitee already has a manekhr account → in-app channel
   *  available. False (cold) → in-app disabled. */
  isWarm: boolean;
  /** Stored email on the member directory record. Empty → email row
   *  disabled with explanatory hint. */
  memberEmail?: string;
  /** Stored mobile on the member directory record. Empty → SMS +
   *  WhatsApp rows disabled. */
  memberMobile?: string;
  /** Resend mode shows the "Just rotate the link" escape row + per-row
   *  disabled state when it's checked. Grant mode hides it (always a
   *  dispatching action - even "all unchecked" means generate-only). */
  showJustRotate?: boolean;
}

interface RowProps {
  id: AccessChannel | 'just_rotate';
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  dashed?: boolean;
}

function ChannelRow({ id, label, hint, checked, disabled, onToggle, dashed }: RowProps) {
  return (
    <label
      htmlFor={`access-channel-${id}`}
      className={`flex items-start gap-3 rounded-lg px-4 py-3 transition-colors ${
        dashed ? 'border border-dashed' : 'border'
      } ${
        disabled
          ? 'cursor-not-allowed border-gray-200 bg-gray-50'
          : checked
            ? 'cursor-pointer border-blue-300 bg-blue-50 hover:bg-blue-100'
            : 'cursor-pointer border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <Checkbox
        id={`access-channel-${id}`}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div
          className={`text-[13px] font-semibold ${disabled ? 'text-gray-400' : 'text-gray-900'}`}
        >
          {label}
        </div>
        <div className={`text-[12px] ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>{hint}</div>
      </div>
    </label>
  );
}

/**
 * P2.0.2 (2026-05-15) - shared 5-channel picker used by:
 *   - AccessResendModal (resend invite - `showJustRotate=true`)
 *   - AppAccessSection Step 3 (grant invite - `showJustRotate=false`)
 *
 * Replaces the legacy 3-radio (Auto / Link / Both) on grant so both flows
 * present the same per-channel mental model. Selection is reported via
 * `AccessChannelSelection`; callers map to their endpoint's DTO shape.
 */
export default function AccessChannelPicker({
  value,
  onChange,
  isWarm,
  memberEmail,
  memberMobile,
  showJustRotate = false,
}: Props) {
  const t = useTranslations();

  const canInApp = isWarm;
  const canEmail = !!memberEmail;
  const canSms = !!memberMobile;
  const canWhatsapp = !!memberMobile;

  function patch(next: Partial<AccessChannelSelection>) {
    onChange({ ...value, ...next });
  }

  function toggleJustRotate(next: boolean) {
    if (next) {
      onChange({
        inApp: false,
        email: false,
        sms: false,
        whatsapp: false,
        justRotate: true,
      });
    } else {
      patch({ justRotate: false });
    }
  }

  const lockedByJustRotate = showJustRotate && value.justRotate;

  return (
    <div className="flex flex-col gap-2">
      <ChannelRow
        id="in_app"
        label={t('team.accessResendChannelInApp')}
        hint={
          canInApp
            ? t('team.accessResendChannelInAppHint')
            : t('team.accessResendChannelInAppDisabled')
        }
        checked={value.inApp}
        disabled={!canInApp || lockedByJustRotate}
        onToggle={(v) => patch({ inApp: v })}
      />
      <ChannelRow
        id="email"
        label={t('team.accessResendChannelEmail')}
        hint={canEmail ? memberEmail! : t('team.accessResendChannelEmailDisabled')}
        checked={value.email}
        disabled={!canEmail || lockedByJustRotate}
        onToggle={(v) => patch({ email: v })}
      />
      <ChannelRow
        id="sms"
        label={t('team.accessResendChannelSms')}
        hint={canSms ? memberMobile! : t('team.accessResendChannelSmsDisabled')}
        checked={value.sms}
        disabled={!canSms || lockedByJustRotate}
        onToggle={(v) => patch({ sms: v })}
      />
      <ChannelRow
        id="whatsapp"
        label={t('team.accessResendChannelWhatsapp')}
        hint={
          canWhatsapp
            ? t('team.accessResendChannelWhatsappHint')
            : t('team.accessResendChannelWhatsappDisabled')
        }
        checked={value.whatsapp}
        disabled={!canWhatsapp || lockedByJustRotate}
        onToggle={(v) => patch({ whatsapp: v })}
      />

      {showJustRotate && (
        <div className="mt-1">
          <ChannelRow
            id="just_rotate"
            label={t('team.accessResendJustRotate')}
            hint={t('team.accessResendJustRotateHint')}
            checked={value.justRotate}
            onToggle={toggleJustRotate}
            dashed
          />
        </div>
      )}
    </div>
  );
}

/** Smart defaults per context - pre-check primary channels that are
 *  available; WhatsApp is always opt-in (manual share). */
export function defaultAccessChannelSelection(opts: {
  isWarm: boolean;
  memberEmail?: string;
  memberMobile?: string;
}): AccessChannelSelection {
  return {
    inApp: opts.isWarm,
    email: !!opts.memberEmail,
    sms: !!opts.memberMobile,
    whatsapp: false,
    justRotate: false,
  };
}
