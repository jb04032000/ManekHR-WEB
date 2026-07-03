'use client';
import { useState } from 'react';
import { App, Button, Tag, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { TeamMember } from '@/types';
import { DsAvatar } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { generateIdCardsPdf } from '@/lib/export/generateIdCardPdf';
import dayjs from 'dayjs';

interface Props {
  member: TeamMember;
  editMode: boolean;
  saving: boolean;
  /**
   * True when the form has been edited since entering edit mode. Drives the
   * Save Changes button's disabled state - uploads / inline-saved tabs (e.g.
   * documents, karigar, piece-rate) write to the server independently and
   * MUST NOT mark the form dirty, so this stays false after a doc upload.
   */
  isDirty: boolean;
  /**
   * §7 Part B - whether the viewer may edit this record at all. `false`
   * (a self-scoped member without `team.edit`) hides the Edit button
   * entirely so the profile is cleanly read-only. Defaults to `true`.
   */
  canEdit?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onBack: () => void;
}

function StatusTag({ member }: { member: TeamMember }) {
  const t = useTranslations('team');
  if (member.isDeleted) {
    return <Tag color="default">{t('headerStatusArchived')}</Tag>;
  }
  if (
    member.isActive &&
    member.dateOfResignation &&
    dayjs(member.dateOfResignation).isAfter(dayjs())
  ) {
    return <Tag color="warning">{t('headerStatusNoticePeriod')}</Tag>;
  }
  if (member.isActive) {
    return <Tag color="success">{t('headerStatusActive')}</Tag>;
  }
  return <Tag color="error">{t('headerStatusInactive')}</Tag>;
}

export default function MemberProfileHeader({
  member,
  editMode,
  saving,
  isDirty,
  canEdit = true,
  onEdit,
  onCancel,
  onSave,
  onBack,
}: Props) {
  const t = useTranslations('team');
  const { message } = App.useApp();
  const { currentWorkspace } = useWorkspaceStore();
  const [idCardBusy, setIdCardBusy] = useState(false);

  // Generate this member's ID card. Logo + workspace name come from the active
  // workspace branding (-> lib/export/generateIdCardPdf). City-only location
  // is derived inside the generator from member.location.
  const handleIdCard = async () => {
    setIdCardBusy(true);
    try {
      await generateIdCardsPdf(
        [
          {
            name: member.name,
            employeeCode: member.employeeCode,
            designation: member.designation,
            bloodGroup: member.bloodGroup,
            emergencyContactName: member.emergencyContactName,
            emergencyContactNumber: member.emergencyContactNumber,
            location: member.location,
            avatar: member.avatar,
          },
        ],
        {
          workspaceName: currentWorkspace?.name ?? 'ManekHR',
          logoUrl: currentWorkspace?.branding?.pdfHeaderLogo ?? currentWorkspace?.branding?.logo,
          // Owner-uploaded light background watermark + company address (SSOT).
          backgroundUrl: currentWorkspace?.branding?.idCardBackground,
          companyAddress: currentWorkspace?.address,
        },
      );
    } catch {
      message.error('Could not generate the ID card.');
    } finally {
      setIdCardBusy(false);
    }
  };

  return (
    <header>
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            className="hidden md:inline-flex"
            aria-label={t('headerBackAria')}
          />
          <DsAvatar name={member.name} size={56} src={member.avatar} />
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 truncate font-display text-[20px] font-bold text-gray-900">
                {member.name}
              </h1>
              <StatusTag member={member} />
            </div>
            <p className="m-0 truncate text-sm text-gray-700">
              {member.designation || t('headerDefaultDesignation')}
              {member.employeeCode ? (
                <span className="ml-2 font-mono text-xs text-faint">· {member.employeeCode}</span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Actions. Mobile (< md): a full-width 2-column grid so the buttons
            never overflow off the right edge (which clipped "Save Changes").
            When editing, the primary Save spans the full row beneath ID card +
            Cancel. md+ reverts to the inline auto-width row. */}
        <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:shrink-0 md:items-center">
          <Tooltip title="Download printable ID card (PDF)">
            <Button
              icon={<IdcardOutlined />}
              onClick={handleIdCard}
              loading={idCardBusy}
              aria-label="Download ID card"
              className="w-full md:w-auto"
            >
              ID card
            </Button>
          </Tooltip>
          {editMode ? (
            <>
              <Button
                icon={<CloseOutlined />}
                onClick={onCancel}
                disabled={saving}
                className="w-full md:w-auto"
              >
                {t('headerBtnCancel')}
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={onSave}
                loading={saving}
                disabled={!isDirty}
                data-shortcut="save"
                className="col-span-2 w-full md:col-span-1 md:w-auto"
              >
                {t('headerBtnSaveChanges')}
              </Button>
            </>
          ) : canEdit ? (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={onEdit}
              disabled={member.isDeleted}
              className="w-full md:w-auto"
            >
              {t('headerBtnEditProfile')}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
