'use client';
import type {
  TeamMemberDocument,
  TeamMemberDocumentType,
  PendingDocument,
} from '@/types';
import { DocumentsPanel } from '@/components/dashboard/team/DocumentsPanel';

interface PreviewSource {
  fileUrl: string;
  fileName?: string;
  mimeType?: string;
  type: TeamMemberDocumentType;
  label?: string;
}

interface DocumentsTabProps {
  mode: 'view' | 'add' | 'edit';
  editMode: boolean;
  documents: TeamMemberDocument[];
  pendingDocs: PendingDocument[];
  loading: boolean;
  payrollEnabled: boolean;
  onUploadClick: (type: TeamMemberDocumentType) => void;
  onPreview: (src: PreviewSource) => void;
  onDeleteServer: (doc: TeamMemberDocument) => void;
  onRemovePending: (localId: string) => void;
}

export default function DocumentsTab({
  mode,
  editMode,
  documents,
  pendingDocs,
  loading,
  payrollEnabled,
  onUploadClick,
  onPreview,
  onDeleteServer,
  onRemovePending,
}: DocumentsTabProps) {
  return (
    <DocumentsPanel
      mode={mode === 'add' ? 'add' : 'edit'}
      editable={mode === 'add' || editMode}
      documents={documents}
      pendingDocs={pendingDocs}
      loading={loading}
      payrollEnabled={payrollEnabled}
      onUploadClick={onUploadClick}
      onPreview={onPreview}
      onDeleteServer={onDeleteServer}
      onRemovePending={onRemovePending}
    />
  );
}
