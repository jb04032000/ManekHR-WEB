'use client';

import { useMemo } from 'react';
import { Alert, Button, Empty, Popconfirm, Spin, Tag, Tooltip } from 'antd';
import { useTranslations } from 'next-intl';
import {
  BankOutlined,
  BookOutlined,
  CarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  IdcardOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReadOutlined,
  SolutionOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { TeamMemberDocument, TeamMemberDocumentType, PendingDocument } from '@/types';
import {
  CATEGORY_DESCRIPTION,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  DOC_TYPE_META,
  type DocumentCategory,
  getTypesByCategory,
} from '@/lib/constants/documentTypes';

const ICON_MAP: Record<string, React.ReactNode> = {
  IdcardOutlined: <IdcardOutlined />,
  BookOutlined: <BookOutlined />,
  CarOutlined: <CarOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  ReadOutlined: <ReadOutlined />,
  SolutionOutlined: <SolutionOutlined />,
  BankOutlined: <BankOutlined />,
  PaperClipOutlined: <PaperClipOutlined />,
};

interface PreviewSource {
  fileUrl: string;
  fileName?: string;
  mimeType?: string;
  type: TeamMemberDocumentType;
  label?: string;
}

interface Props {
  mode: 'add' | 'edit';
  editable?: boolean;
  documents: TeamMemberDocument[];
  pendingDocs: PendingDocument[];
  loading?: boolean;
  payrollEnabled?: boolean;
  onUploadClick: (type: TeamMemberDocumentType) => void;
  onPreview: (src: PreviewSource) => void;
  onDeleteServer: (doc: TeamMemberDocument) => void;
  onRemovePending: (localId: string) => void;
}

interface SlotEntry {
  kind: 'server' | 'pending' | 'empty';
  serverDoc?: TeamMemberDocument;
  pendingDoc?: PendingDocument;
}

function buildSlots(
  type: TeamMemberDocumentType,
  documents: TeamMemberDocument[],
  pendingDocs: PendingDocument[],
): SlotEntry[] {
  const meta = DOC_TYPE_META[type];
  const serverMatches = documents.filter((d) => d.type === type);
  const pendingMatches = pendingDocs.filter((p) => p.type === type);

  if (meta.allowMultiple) {
    const entries: SlotEntry[] = [
      ...serverMatches.map((d) => ({ kind: 'server' as const, serverDoc: d })),
      ...pendingMatches.map((p) => ({
        kind: 'pending' as const,
        pendingDoc: p,
      })),
    ];
    return entries.length > 0 ? entries : [{ kind: 'empty' }];
  }

  const serverDoc = serverMatches[0];
  const pendingDoc = pendingMatches[0];
  if (serverDoc) return [{ kind: 'server', serverDoc }];
  if (pendingDoc) return [{ kind: 'pending', pendingDoc }];
  return [{ kind: 'empty' }];
}

function StatusChip({
  meta,
  filled,
  payrollEnabled,
}: {
  meta: (typeof DOC_TYPE_META)[TeamMemberDocumentType];
  filled: boolean;
  payrollEnabled?: boolean;
}) {
  const t = useTranslations('team');
  if (filled) {
    return (
      <Tag color="success" icon={<CheckCircleFilled />} className="m-0">
        {t('docsStatusUploaded')}
      </Tag>
    );
  }
  if (meta.isRequiredForPayroll && payrollEnabled) {
    return (
      <Tag color="error" className="m-0">
        {t('docsStatusRequiredForPayroll')}
      </Tag>
    );
  }
  if (meta.isRecommendedForPayroll && payrollEnabled) {
    return (
      <Tag color="warning" className="m-0">
        {t('docsStatusRecommended')}
      </Tag>
    );
  }
  return null;
}

export function DocumentsPanel({
  mode,
  editable = true,
  documents,
  pendingDocs,
  loading,
  payrollEnabled,
  onUploadClick,
  onPreview,
  onDeleteServer,
  onRemovePending,
}: Props) {
  const t = useTranslations('team');
  const sectionData = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => {
      const types = getTypesByCategory(cat);
      return { category: cat, types };
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Spin />
      </div>
    );
  }

  const totalCount = documents.length + pendingDocs.length;

  return (
    <div className="flex flex-col gap-5">
      {mode === 'add' && <Alert type="info" showIcon title={t('docsAlertSaveFirst')} />}

      {totalCount === 0 && mode === 'edit' && (
        <Empty description={t('docsEmptyAll')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}

      {sectionData.map(({ category, types }) => (
        <Section
          key={category}
          category={category}
          types={types}
          documents={documents}
          pendingDocs={pendingDocs}
          editable={editable}
          payrollEnabled={payrollEnabled}
          onUploadClick={onUploadClick}
          onPreview={onPreview}
          onDeleteServer={onDeleteServer}
          onRemovePending={onRemovePending}
        />
      ))}
    </div>
  );
}

function Section({
  category,
  types,
  documents,
  pendingDocs,
  editable,
  payrollEnabled,
  onUploadClick,
  onPreview,
  onDeleteServer,
  onRemovePending,
}: {
  category: DocumentCategory;
  types: TeamMemberDocumentType[];
  documents: TeamMemberDocument[];
  pendingDocs: PendingDocument[];
  editable: boolean;
  payrollEnabled?: boolean;
  onUploadClick: (type: TeamMemberDocumentType) => void;
  onPreview: (src: PreviewSource) => void;
  onDeleteServer: (doc: TeamMemberDocument) => void;
  onRemovePending: (localId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col border-b border-gray-100 pb-2.5">
        <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
          {CATEGORY_LABEL[category]}
        </p>
        <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
          {CATEGORY_DESCRIPTION[category]}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {types.map((type) => {
          const slots = buildSlots(type, documents, pendingDocs);
          return slots.map((slot, idx) => (
            <SlotCard
              key={`${type}-${idx}-${slot.kind}-${slot.serverDoc?.id ?? slot.pendingDoc?.localId ?? 'empty'}`}
              type={type}
              slot={slot}
              editable={editable}
              payrollEnabled={payrollEnabled}
              onUploadClick={onUploadClick}
              onPreview={onPreview}
              onDeleteServer={onDeleteServer}
              onRemovePending={onRemovePending}
            />
          ));
        })}
      </div>
    </section>
  );
}

function SlotCard({
  type,
  slot,
  editable,
  payrollEnabled,
  onUploadClick,
  onPreview,
  onDeleteServer,
  onRemovePending,
}: {
  type: TeamMemberDocumentType;
  slot: SlotEntry;
  editable: boolean;
  payrollEnabled?: boolean;
  onUploadClick: (type: TeamMemberDocumentType) => void;
  onPreview: (src: PreviewSource) => void;
  onDeleteServer: (doc: TeamMemberDocument) => void;
  onRemovePending: (localId: string) => void;
}) {
  const t = useTranslations('team');
  const meta = DOC_TYPE_META[type];
  const icon = ICON_MAP[meta.icon] ?? <FileTextOutlined />;
  const filled = slot.kind !== 'empty';

  const headerLabel =
    slot.kind === 'server' && slot.serverDoc?.label
      ? slot.serverDoc.label
      : slot.kind === 'pending' && slot.pendingDoc?.label
        ? slot.pendingDoc.label
        : meta.label;

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors ${filled ? 'border-gray-200 bg-white' : 'border-dashed border-gray-300 bg-gray-50/40'} `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 text-base text-primary">{icon}</span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-gray-800">{headerLabel}</span>
            {!filled && <span className="text-xs text-gray-600">{meta.shortHint}</span>}
          </div>
        </div>
        <StatusChip meta={meta} filled={filled} payrollEnabled={payrollEnabled} />
      </div>

      {slot.kind === 'server' && slot.serverDoc && (
        <ServerRow
          doc={slot.serverDoc}
          editable={editable}
          onPreview={() =>
            onPreview({
              fileUrl: slot.serverDoc!.fileUrl,
              fileName: slot.serverDoc!.fileName,
              mimeType: slot.serverDoc!.mimeType,
              type,
              label: slot.serverDoc!.label,
            })
          }
          onDelete={() => onDeleteServer(slot.serverDoc!)}
        />
      )}

      {slot.kind === 'pending' && slot.pendingDoc && (
        <PendingRow
          pending={slot.pendingDoc}
          editable={editable}
          onPreview={() =>
            onPreview({
              fileUrl: slot.pendingDoc!.previewUrl,
              fileName: slot.pendingDoc!.fileName,
              mimeType: slot.pendingDoc!.file.type,
              type,
              label: slot.pendingDoc!.label,
            })
          }
          onRemove={() => onRemovePending(slot.pendingDoc!.localId)}
        />
      )}

      {slot.kind === 'empty' && editable && (
        <Button
          type="dashed"
          icon={meta.allowMultiple ? <PlusOutlined /> : <UploadOutlined />}
          onClick={() => onUploadClick(type)}
          block
        >
          {meta.allowMultiple ? t('docsBtnAddDocument') : t('docsBtnUpload')}
        </Button>
      )}

      {slot.kind === 'empty' && !editable && (
        <span className="text-xs text-faint italic">{t('docsNotUploaded')}</span>
      )}

      {meta.allowMultiple && filled && editable && (
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onUploadClick(type)}
        >
          {t('docsBtnAddAnother')}
        </Button>
      )}
    </div>
  );
}

function ServerRow({
  doc,
  editable,
  onPreview,
  onDelete,
}: {
  doc: TeamMemberDocument;
  editable: boolean;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('team');
  const fileName = doc.fileName ?? t('docsDefaultLabel');
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <FileTextOutlined className="text-gray-700" />
        <Tooltip title={fileName} placement="topLeft" mouseEnterDelay={0.4}>
          <span className="truncate text-xs text-gray-700">{fileName}</span>
        </Tooltip>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip title={t('docsTooltipPreview')}>
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={onPreview} />
        </Tooltip>
        {editable && (
          <Popconfirm
            title={t('docsDeleteConfirmTitle')}
            okText={t('docsDeleteConfirmOk')}
            okButtonProps={{ danger: true }}
            cancelText={t('docsDeleteConfirmCancel')}
            onConfirm={onDelete}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
      </div>
    </div>
  );
}

function PendingRow({
  pending,
  editable,
  onPreview,
  onRemove,
}: {
  pending: PendingDocument;
  editable: boolean;
  onPreview: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('team');
  const pendingLine = `${pending.fileName} · ${t('docsPendingSuffix')}`;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <ClockCircleOutlined className="text-amber-700" />
        <Tooltip title={pendingLine} placement="topLeft" mouseEnterDelay={0.4}>
          <span className="truncate text-xs text-amber-800">{pendingLine}</span>
        </Tooltip>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip title={t('docsTooltipPreview')}>
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={onPreview} />
        </Tooltip>
        {editable && (
          <Tooltip title={t('docsTooltipRemove')}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onRemove} />
          </Tooltip>
        )}
      </div>
    </div>
  );
}
