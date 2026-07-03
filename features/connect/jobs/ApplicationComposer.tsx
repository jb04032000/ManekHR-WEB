'use client';

/**
 * The karigar's apply form on a job detail. The application is their Connect
 * profile + an optional short message + an optional voice note (low-literacy
 * path). Submitting again updates the same application (BE upserts on
 * {jobId, applicantUserId}). The company reviews it - no chat (mediator model).
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Form, Input } from 'antd';
import DsButton from '@/components/ui/DsButton';
import VoiceNoteRecorder from '@/components/connect/VoiceNoteRecorder';
import ResumeUpload from './ResumeUpload';
import type { JobApplication, CreateApplicationPayload } from './jobs.types';

interface FormValues {
  message?: string;
}

interface Props {
  initial?: JobApplication | null;
  submitting: boolean;
  onSubmit: (payload: CreateApplicationPayload) => void;
}

export default function ApplicationComposer({ initial, submitting, onSubmit }: Props) {
  const t = useTranslations('connect.jobs');
  const [form] = Form.useForm<FormValues>();
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(initial?.voiceNoteUrl ?? null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(initial?.resumeUrl ?? null);
  const [resumeName, setResumeName] = useState<string>(initial?.resumeName ?? '');

  const handleFinish = (v: FormValues) => {
    const payload: CreateApplicationPayload = {};
    if (v.message?.trim()) payload.message = v.message.trim();
    if (voiceNoteUrl) payload.voiceNoteUrl = voiceNoteUrl;
    if (resumeUrl) {
      payload.resumeUrl = resumeUrl;
      if (resumeName) payload.resumeName = resumeName;
    }
    onSubmit(payload);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      colon={false}
      initialValues={{ message: initial?.message || undefined }}
      onFinish={handleFinish}
    >
      <Form.Item label={t('applyMessageLabel')} name="message" rules={[{ max: 2000 }]}>
        <Input.TextArea
          rows={3}
          maxLength={2000}
          showCount
          placeholder={t('applyMessagePlaceholder')}
        />
      </Form.Item>

      <Form.Item label={t('resumeLabel')}>
        <ResumeUpload
          url={resumeUrl}
          name={resumeName}
          onChange={(url, name) => {
            setResumeUrl(url);
            setResumeName(name);
          }}
          onClear={() => {
            setResumeUrl(null);
            setResumeName('');
          }}
        />
      </Form.Item>

      <Form.Item label={t('applyVoiceLabel')}>
        {/* PRIVATE bucket: the apply voice note lands in `connect-job-voice` (not
            the public feed `connect-audio`) so it is only reachable via a signed
            URL the BE mints on the application read. */}
        <VoiceNoteRecorder
          category="connect-job-voice"
          onRecorded={(audio) => setVoiceNoteUrl(audio.url)}
          onClear={() => setVoiceNoteUrl(null)}
        />
      </Form.Item>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <DsButton dsVariant="primary" htmlType="submit" loading={submitting}>
          {initial ? t('updateApplication') : t('apply')}
        </DsButton>
      </div>
    </Form>
  );
}
