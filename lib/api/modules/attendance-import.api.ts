'use client';

import http from '../client';
import { ApiEndpoints } from '../endpoints';

export interface ImportParseResponse {
  format: 'zk_dat' | 'etimetrack_xls' | 'biotime_csv' | 'generic_csv' | 'generic_xls';
  preview: Array<{
    deviceUserId: string;
    timestamp: string;
    punchType: string;
    verifyMethod: string | null;
  }>;
  columnMap: Record<string, string>;
  headers: string[];
  deviceUserIds: string[];
}

export interface ImportCommitPayload {
  columnMap: Record<string, string>;
  memberMap: Record<string, string | null>;
  deviceSerial?: string | null;
  dryRun?: boolean;
}

export interface ImportCommitResult {
  inserted: number;
  skipped: number;
  willInsert?: number;
  errors: string[];
}

export const attendanceImportApi = {
  /**
   * POST /api/workspaces/:wsId/attendance/import/parse
   * Send file as multipart/form-data with field name 'file'.
   */
  parse: (wsId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post(ApiEndpoints.attendance.importParse(wsId), form);
  },

  /**
   * POST /api/workspaces/:wsId/attendance/import/commit
   * Send file as multipart + payload as JSON string in field 'data'.
   */
  commit: (wsId: string, file: File, payload: ImportCommitPayload) => {
    const form = new FormData();
    form.append('file', file);
    form.append('data', JSON.stringify(payload));
    return http.post(ApiEndpoints.attendance.importCommit(wsId), form);
  },
};
