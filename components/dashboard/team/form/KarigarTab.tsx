'use client';
import type { TeamMember } from '@/types';

/* PAUSED 2026-05-14 - Karigar feature paused on web. Component body preserved
   in this comment block; revive by restoring the original implementation below
   and removing the no-op default export. Mobile + BE Karigar surfaces remain
   live; this only neutralises the web tab UI. See plan:
   C:\Users\jayes\.claude\plans\nest-24568-13-05-2026-velvety-marshmallow.md

import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Switch, Select, InputNumber, Form, Alert } from 'antd';
import { ToolOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { KarigarSkillType, UpdateKarigarProfilePayload } from '@/types';
import { updateKarigarProfile } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';

interface Props {
  member: TeamMember;
  workspaceId: string;
  onUpdated: (updated: TeamMember) => void;
}

export default function KarigarTab({ member, workspaceId, onUpdated }: Props) {
  const t = useTranslations('team');
  const { message } = App.useApp();
  const skillOptions = useMemo<{ value: KarigarSkillType; label: string }[]>(
    () => [
      { value: 'zari', label: t('karigarSkillZari') },
      { value: 'embroidery', label: t('karigarSkillEmbroidery') },
      { value: 'print', label: t('karigarSkillPrint') },
      { value: 'dyeing', label: t('karigarSkillDyeing') },
      { value: 'cutting', label: t('karigarSkillCutting') },
      { value: 'finishing', label: t('karigarSkillFinishing') },
      { value: 'other', label: t('karigarSkillOther') },
    ],
    [t],
  );
  const [isKarigar, setIsKarigar] = useState<boolean>(!!member.isKarigar);
  const [skill, setSkill] = useState<KarigarSkillType | undefined>(
    member.karigarSkillType as KarigarSkillType | undefined,
  );
  // Display rate as rupees in the UI; convert to paise on save
  const [dailyRateRupees, setDailyRateRupees] = useState<number | null>(
    typeof member.karigarDailyRatePaise === 'number' ? member.karigarDailyRatePaise / 100 : null,
  );
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = (payload: UpdateKarigarProfilePayload) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        setError(null);
        const updated = await updateKarigarProfile(workspaceId, member.id, payload);
        onUpdated(updated);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      } catch (err) {
        const msg = parseApiError(err);
        setError(msg);
        message.error(msg, 6);
      }
    }, 300);
  };

  const handleToggle = (checked: boolean) => {
    setIsKarigar(checked);
    persist({
      isKarigar: checked,
      karigarSkillType: skill,
      karigarDailyRatePaise:
        dailyRateRupees != null ? Math.round(dailyRateRupees * 100) : undefined,
    });
  };

  const handleSkillChange = (val: KarigarSkillType) => {
    setSkill(val);
    persist({
      isKarigar,
      karigarSkillType: val,
      karigarDailyRatePaise:
        dailyRateRupees != null ? Math.round(dailyRateRupees * 100) : undefined,
    });
  };

  const handleRateChange = (val: number | null) => {
    setDailyRateRupees(val);
    persist({
      isKarigar,
      karigarSkillType: skill,
      karigarDailyRatePaise: val != null ? Math.round(val * 100) : undefined,
    });
  };

  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <ToolOutlined style={{ fontSize: 18 }} />
        <h3 className="m-0 text-base font-semibold text-gray-900">{t('karigarProfileTitle')}</h3>
        {savedFlash && (
          <CheckCircleOutlined style={{ color: 'var(--cr-success)', marginLeft: 8 }} />
        )}
      </div>

      {error && <Alert type="error" title={error} showIcon />}

      <Form layout="vertical" colon={false}>
        <Form.Item label={t('karigarMarkAsLabel')} extra={t('karigarMarkAsExtra')}>
          <Switch checked={isKarigar} onChange={handleToggle} />
        </Form.Item>

        {isKarigar && (
          <div className="animate-fade-down flex flex-col gap-3">
            <Form.Item label={t('karigarSkillLabel')}>
              <Select
                placeholder={t('karigarSkillPlaceholder')}
                options={skillOptions}
                value={skill}
                onChange={handleSkillChange}
                allowClear
                style={{ width: 280 }}
              />
            </Form.Item>

            <Form.Item label={t('karigarDailyRateLabel')} extra={t('karigarDailyRateExtra')}>
              <InputNumber
                prefix="₹"
                min={0}
                step={1}
                placeholder={t('karigarDailyRatePlaceholder')}
                value={dailyRateRupees ?? undefined}
                onChange={(v) => handleRateChange(typeof v === 'number' ? v : null)}
                style={{ width: 280 }}
              />
            </Form.Item>
          </div>
        )}
      </Form>
    </div>
  );
}
*/

interface Props {
  member: TeamMember;
  workspaceId: string;
  onUpdated: (updated: TeamMember) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- PAUSED 2026-05-14: no-op default export preserves the import contract for any straggler reference; props kept for type-compat on revive.
export default function KarigarTab(_props: Props) {
  return null;
}
