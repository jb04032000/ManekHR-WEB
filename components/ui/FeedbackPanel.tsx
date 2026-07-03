'use client';

// Feedback form body (quick-first). Scope toggle (this-page/general) + mood
// faces (-> rating 1-5, optional) + category chips + message + photo
// attachments + screen capture + an auto-context note. Submits via
// submitFeedback with page/device context. Rendered inside FeedbackButton's
// Popover (desktop) / Drawer (mobile). Links to: lib/actions/feedback.actions.ts,
// FeedbackAttachments.tsx, FeedbackScreenCapture.tsx.
import { useCallback, useRef, useState } from 'react';
import { App as AntApp, Button, Input } from 'antd';
import { FrownOutlined, MehOutlined, SmileOutlined, CameraOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import {
  submitFeedback,
  type FeedbackCategory,
  type FeedbackScope,
} from '@/lib/actions/feedback.actions';
import { useWorkspaceStore } from '@/lib/store';
import { track } from '@/lib/analytics';
import FeedbackAttachments, { type FeedbackAttachmentsHandle } from './FeedbackAttachments';
import FeedbackScreenCapture from './FeedbackScreenCapture';

const CATEGORIES: FeedbackCategory[] = ['general', 'feature_request', 'bug_report'];
const MOODS = [1, 2, 3, 4, 5] as const;

function moodIcon(n: number) {
  if (n <= 2) return <FrownOutlined />;
  if (n === 3) return <MehOutlined />;
  return <SmileOutlined />;
}

export interface FeedbackPanelProps {
  module: string;
  pageLabel?: string;
  onDone: () => void;
  /** Fill the container width (mobile Drawer) instead of the fixed 340px used
   *  by the desktop Popover, so the form does not leave a big right gutter on
   *  phones. Set by FeedbackButton's Drawer branch. */
  fullWidth?: boolean;
}

export default function FeedbackPanel({
  module,
  pageLabel,
  onDone,
  fullWidth = false,
}: FeedbackPanelProps) {
  const t = useTranslations('feedback');
  const { message: msg } = AntApp.useApp();
  const pathname = usePathname();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);

  const [scope, setScope] = useState<FeedbackScope>('page');
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Bumped on successful submit to remount FeedbackAttachments (clears its tiles).
  const [attKey, setAttKey] = useState(0);
  const attachRef = useRef<FeedbackAttachmentsHandle>(null);

  const buildContext = useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    const locale = document.cookie.match(/z360_locale=([^;]+)/)?.[1];
    return {
      path: pathname,
      locale,
      userAgent: navigator.userAgent.slice(0, 512),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    };
  }, [pathname]);

  const submit = useCallback(async () => {
    if (!workspaceId) {
      msg.error(t('toast.needWorkspace'));
      return;
    }
    if (text.trim().length === 0) {
      msg.error(t('toast.needMessage'));
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback(workspaceId, {
        module,
        rating: rating ?? undefined,
        message: text.trim(),
        category,
        scope,
        attachments,
        context: buildContext(),
      });
      track('feedback.submit.success', {
        module,
        scope,
        rating,
        category,
        photoCount: attachments.length,
      });
      msg.success(t('toast.success'));
      // Clear the form so it reopens empty. Belt-and-suspenders with the
      // Popover/Drawer destroyOnHidden; honours the reset rule even if a future
      // refactor keeps the panel mounted. (See CLAUDE.md "Modal / Drawer".)
      setScope('page');
      setRating(null);
      setCategory('general');
      setText('');
      setAttachments([]);
      setCaptureOpen(false);
      setAttKey((k) => k + 1);
      onDone();
    } catch {
      track('feedback.submit.error', { module, scope, category });
      msg.error(t('toast.error'));
    } finally {
      setSubmitting(false);
    }
  }, [
    workspaceId,
    text,
    module,
    rating,
    category,
    scope,
    attachments,
    buildContext,
    msg,
    t,
    onDone,
  ]);

  const scopeBtn = (val: FeedbackScope, label: string) => (
    <button
      type="button"
      onClick={() => {
        setScope(val);
        track('feedback.scope_changed', { module, scope: val });
      }}
      style={{
        flex: 1,
        padding: '6px 8px',
        fontSize: 13,
        borderRadius: 6,
        cursor: 'pointer',
        border: scope === val ? '1px solid var(--cr-primary)' : '1px solid var(--cr-border-light)',
        background: scope === val ? 'var(--cr-primary-light)' : 'transparent',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ width: fullWidth ? '100%' : 340, maxWidth: '100%' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {scopeBtn('page', pageLabel ? t('scope.pageWith', { page: pageLabel }) : t('scope.page'))}
        {scopeBtn('general', t('scope.general'))}
      </div>

      <div style={{ fontSize: 13, color: 'var(--cr-text-2)', marginBottom: 6 }}>
        {t('mood.label')}
      </div>
      {/* Mood faces. Each is a 44x44 tap target (mobile touch minimum) with a
          clear selected state - tinted bg + primary border + slight scale - so
          selection is obvious. The old version only recoloured a thin outline
          icon (gray -> navy), which was near-invisible and read as "nothing
          happened" on phones. Matches the primary-highlight style used by the
          scope/category chips above. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, fontSize: 24 }}>
        {MOODS.map((n) => {
          const active = rating === n;
          return (
            <button
              key={n}
              type="button"
              aria-label={t(`mood.${n}` as 'mood.1')}
              aria-pressed={active}
              onClick={() => setRating(n)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                lineHeight: 1,
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'transform 0.15s ease, background 0.15s ease, border-color 0.15s ease',
                transform: active ? 'scale(1.08)' : 'scale(1)',
                border: active ? '1px solid var(--cr-primary)' : '1px solid var(--cr-border-light)',
                background: active ? 'var(--cr-primary-light)' : 'var(--cr-surface-2)',
                color: active ? 'var(--cr-primary)' : 'var(--cr-text-3)',
              }}
            >
              {moodIcon(n)}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            style={{
              fontSize: 12,
              padding: '4px 11px',
              borderRadius: 14,
              cursor: 'pointer',
              border:
                category === c ? '1px solid var(--cr-primary)' : '1px solid var(--cr-border-light)',
              background: category === c ? 'var(--cr-primary-light)' : 'transparent',
            }}
          >
            {t(`category.${c}` as 'category.general')}
          </button>
        ))}
      </div>

      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('message.placeholder')}
        rows={4}
        maxLength={2000}
        showCount
        style={{ marginBottom: 12 }}
      />

      <FeedbackAttachments
        key={attKey}
        ref={attachRef}
        onChange={setAttachments}
        onLimit={() => msg.warning(t('attachments.limit', { max: 3 }))}
      />

      <Button
        size="small"
        icon={<CameraOutlined />}
        onClick={() => {
          if ((attachRef.current?.count() ?? 0) >= 3) {
            msg.warning(t('attachments.limit', { max: 3 }));
            return;
          }
          setCaptureOpen(true);
          track('feedback.screen_captured', { module });
        }}
        style={{ marginTop: 8 }}
      >
        {t('attachments.capture')}
      </Button>

      <div
        style={{
          display: 'flex',
          gap: 7,
          alignItems: 'flex-start',
          background: 'var(--cr-surface-2)',
          borderRadius: 'var(--cr-radius-md)',
          padding: '8px 10px',
          margin: '12px 0',
          fontSize: 12,
          color: 'var(--cr-text-2)',
        }}
      >
        {t('context.note')}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={onDone} disabled={submitting}>
          {t('actions.cancel')}
        </Button>
        <Button type="primary" loading={submitting} onClick={submit}>
          {t('actions.send')}
        </Button>
      </div>

      <FeedbackScreenCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onAttach={(file) => attachRef.current?.addFile(file)}
      />
    </div>
  );
}
