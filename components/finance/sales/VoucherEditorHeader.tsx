'use client';
/**
 * Inline page header for the voucher editor: title on the left (at the content edge,
 * no back button - the breadcrumb covers navigation) and a status pill + the primary
 * actions on the right. Mirrors the Tax Invoices LIST page header so the create page
 * reads consistently. Cross-links: VoucherEditor owns the handlers + autosave state.
 */
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { SyncOutlined, DownOutlined } from '@ant-design/icons';
import { Tag, Dropdown } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { Can } from '@/components/rbac/Can';
import type { AutosaveStatus } from '@/hooks/useDraftAutosave';
import type { VoucherType } from '@/types';

// Friendly status tag shown (instead of Save/Post) once a voucher leaves draft - keep in
// sync with the VoucherState enum (voucher-base.interface). Read-only states have no editor
// actions: posted/cancelled/void are final; pending_approval is acted on via InvoiceApprovalBar.
// Labels are resolved via i18n (finance.sales.editor.header.stateLabel*) at render time; this
// record only carries the AntD Tag colour per state.
const STATE_TAG_COLOR: Record<string, string> = {
  pending_approval: 'gold',
  posted: 'green',
  cancelled: 'red',
  void: 'default',
};

// i18n key suffixes (finance.sales.editor.header.title*/post*) per voucher type, so the
// title + post-button label come from the message catalog instead of inline English.
const VOUCHER_LABEL_KEYS: Record<VoucherType, { titleKey: string; postKey: string }> = {
  sale_invoice: { titleKey: 'header.titleSaleInvoice', postKey: 'header.postSaleInvoice' },
  quotation: { titleKey: 'header.titleQuotation', postKey: 'header.postQuotation' },
  sale_order: { titleKey: 'header.titleSaleOrder', postKey: 'header.postSaleOrder' },
  proforma: { titleKey: 'header.titleProforma', postKey: 'header.postProforma' },
  delivery_challan: {
    titleKey: 'header.titleDeliveryChallan',
    postKey: 'header.postDeliveryChallan',
  },
};

// Small inline keyboard hint, inheriting the button's text colour via currentColor.
const KBD_STYLE: CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 10,
  lineHeight: 1,
  padding: '2px 5px',
  marginLeft: 7,
  border: '1px solid currentColor',
  borderRadius: 4,
  opacity: 0.5,
};
function Kbd({ children }: { children: ReactNode }) {
  return <span style={KBD_STYLE}>{children}</span>;
}

interface StatusPillProps {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  isNewDraft?: boolean;
}

// Compact coloured status pill (Draft / Saving / Saved / Saved locally / Save failed),
// matching the reference header. A pristine new invoice reads "Draft" (never a false
// "Saved locally" - that gate lives in useDraftAutosave/VoucherEditor).
function StatusPill({ status, lastSavedAt, isNewDraft }: StatusPillProps) {
  const t = useTranslations('finance.sales');
  const [renderNow] = useState(() => Date.now());
  const secondsAgo = lastSavedAt ? Math.round((renderNow - lastSavedAt.getTime()) / 1000) : null;

  const pill = (bg: string, fg: string, mark: ReactNode, label: string) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 11px',
        borderRadius: 999,
        background: bg,
        color: fg,
        whiteSpace: 'nowrap',
      }}
    >
      {mark}
      {label}
    </span>
  );
  const dot = (c: string) => (
    <span
      style={{ width: 7, height: 7, borderRadius: 999, background: c, display: 'inline-block' }}
    />
  );

  if (status === 'saving') {
    return pill(
      'var(--cr-surface-2)',
      'var(--cr-text-3)',
      <SyncOutlined spin style={{ fontSize: 11 }} />,
      t('editor.status.saving'),
    );
  }
  if (status === 'saved') {
    return pill(
      'var(--cr-success-50)',
      'var(--cr-success-700)',
      dot('var(--cr-success-500)'),
      secondsAgo != null
        ? t('editor.status.savedAgo', { seconds: secondsAgo })
        : t('editor.status.saved'),
    );
  }
  if (status === 'error') {
    return pill(
      'var(--cr-danger-50)',
      'var(--cr-danger-700)',
      dot('var(--cr-danger-500)'),
      t('editor.status.saveFailed'),
    );
  }
  // idle / offline / brand-new -> Draft (or genuine "Saved locally" after a real edit).
  const offlineAfterEdit = status === 'offline' && !isNewDraft;
  return pill(
    'var(--cr-warning-50)',
    'var(--cr-warning-700)',
    dot('var(--cr-warning-500)'),
    offlineAfterEdit ? t('editor.status.savedLocally') : t('editor.status.draft'),
  );
}

interface VoucherEditorHeaderProps {
  voucherType: VoucherType;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
  onSaveDraft: () => void;
  onPost: () => void;
  /** Optional secondary post-actions for sale invoices: post then go-new / print / share. */
  onSaveAndNew?: () => void;
  onSaveAndPrint?: () => void;
  onSaveAndShare?: () => void;
  onPreview?: () => void;
  isPostable: boolean;
  isPostLoading: boolean;
  /** Override the primary action label. Defaults to the voucherType-derived label. */
  postLabel?: string;
  /** New, unsaved voucher: primary action is "Save & Post" (create then post). */
  isNewDraft?: boolean;
  /** Voucher is no longer a draft (pending_approval/posted/cancelled/void): hide the
   *  Save Draft + Post actions (they would error) and show a status tag instead. */
  isReadOnly?: boolean;
  /** The voucher's current state, used to label the read-only status tag. */
  voucherState?: string;
}

export function VoucherEditorHeader({
  voucherType,
  autosaveStatus,
  lastSavedAt,
  onSaveDraft,
  onPost,
  onSaveAndNew,
  onSaveAndPrint,
  onSaveAndShare,
  onPreview,
  isPostable,
  isPostLoading,
  postLabel: postLabelOverride,
  isNewDraft,
  isReadOnly,
  voucherState,
}: VoucherEditorHeaderProps) {
  const t = useTranslations('finance.sales');
  const { titleKey, postKey } = VOUCHER_LABEL_KEYS[voucherType];
  const title = t(`editor.${titleKey}`);
  const defaultPostLabel = t(`editor.${postKey}`);
  const primaryLabel = isNewDraft
    ? t('editor.header.saveAndPost')
    : (postLabelOverride ?? defaultPostLabel);

  // Resolve the read-only status tag label from i18n; unknown states fall back to the raw
  // state string so a new VoucherState value still renders something rather than blank.
  const STATE_LABEL_KEYS: Record<string, string> = {
    pending_approval: 'editor.header.stateLabelPendingApproval',
    posted: 'editor.header.stateLabelPosted',
    cancelled: 'editor.header.stateLabelCancelled',
    void: 'editor.header.stateLabelVoid',
  };
  const stateLabel = (state?: string) => {
    const key = state ? STATE_LABEL_KEYS[state] : undefined;
    return key ? t(key) : (state ?? '');
  };

  // Post (finalise) is a sensitive, ledger-affecting action on a tax invoice. Gate it
  // behind `finance.invoice.post` for sale invoices (design spec 2026-06-01 SS6.B).
  // A brand-new draft enables it (it runs the save-then-post flow).
  const postButton = (
    <DsButton
      dsVariant="primary"
      dsSize="sm"
      onClick={onPost}
      disabled={!isNewDraft && !isPostable}
      loading={isPostLoading}
      title={t('editor.header.postTooltip')}
    >
      {primaryLabel}
      <Kbd>Ctrl ↵</Kbd>
    </DsButton>
  );

  // Secondary post-actions for sale invoices (post -> print / share / new), shown as a
  // small dropdown next to the primary Post button. Same enable rule as Post.
  const moreActionItems = [
    onSaveAndPrint && {
      key: 'print',
      label: t('editor.header.saveAndPrint'),
      onClick: onSaveAndPrint,
    },
    onSaveAndShare && {
      key: 'share',
      label: t('editor.header.saveAndShare'),
      onClick: onSaveAndShare,
    },
    onSaveAndNew && { key: 'new', label: t('editor.header.saveAndNew'), onClick: onSaveAndNew },
  ].filter(Boolean) as { key: string; label: string; onClick: () => void }[];
  const moreActions =
    voucherType === 'sale_invoice' && moreActionItems.length > 0 ? (
      <Dropdown
        trigger={['click']}
        disabled={!isNewDraft && !isPostable}
        menu={{ items: moreActionItems }}
      >
        <DsButton dsVariant="ghost" dsSize="sm" aria-label={t('editor.header.moreActions')}>
          <DownOutlined />
        </DsButton>
      </Dropdown>
    ) : null;

  return (
    <header
      style={{
        // Inline page header on the page background, matching the Tax Invoices list
        // page: title at the left edge, status + actions on the right, no white bar.
        flex: '0 0 100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '0 0 2px',
      }}
    >
      <h1 className="m-0 font-display text-[20px] leading-[1.25] font-semibold text-heading">
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {isReadOnly ? (
          // Finalised / non-draft voucher: no Save/Post (they would error). Preview stays so
          // the document can still be viewed/printed; a status tag explains the locked state.
          <>
            {onPreview && (
              <DsButton dsVariant="ghost" dsSize="sm" onClick={onPreview}>
                {t('editor.header.preview')}
              </DsButton>
            )}
            <Tag
              color={STATE_TAG_COLOR[voucherState ?? ''] ?? 'default'}
              style={{ marginInlineEnd: 0 }}
            >
              {stateLabel(voucherState)}
            </Tag>
          </>
        ) : (
          <>
            <StatusPill status={autosaveStatus} lastSavedAt={lastSavedAt} isNewDraft={isNewDraft} />
            {onPreview && (
              <DsButton dsVariant="ghost" dsSize="sm" onClick={onPreview}>
                {t('editor.header.preview')}
              </DsButton>
            )}
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              onClick={onSaveDraft}
              title={t('editor.header.saveDraftTooltip')}
            >
              {t('editor.header.saveDraft')}
              <Kbd>Ctrl S</Kbd>
            </DsButton>
            {voucherType === 'sale_invoice' ? (
              <Can path="finance.invoice.post" scope="all">
                {postButton}
                {moreActions}
              </Can>
            ) : (
              postButton
            )}
          </>
        )}
      </div>
    </header>
  );
}
