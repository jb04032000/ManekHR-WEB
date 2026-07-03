'use server';

import { revalidatePath } from 'next/cache';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  ReminderRule,
  ReminderLog,
  ReminderSettings,
  ReminderTemplate,
  CreateReminderRuleDto,
  UpdateReminderSettingsDto,
} from '@/types';

const R = ApiEndpoints.finance.reminders;

// ===== Reminder Settings =====

export async function getReminderSettings(
  wsId: string,
  firmId: string,
): Promise<ReminderSettings> {
  const http = await serverHttp();
  const res = await http.get(R.settings(wsId, firmId));
  return unwrapServer<ReminderSettings>(res);
}

export async function updateReminderSettings(
  wsId: string,
  firmId: string,
  dto: UpdateReminderSettingsDto,
): Promise<ReminderSettings> {
  const http = await serverHttp();
  const res = await http.patch(R.settings(wsId, firmId), dto);
  revalidatePath(`/dashboard/finance/firms/${firmId}/reminders/settings`);
  return unwrapServer<ReminderSettings>(res);
}

// ===== Reminder Rules =====

export async function listReminderRules(
  wsId: string,
  firmId: string,
  params?: Record<string, unknown>,
): Promise<ReminderRule[]> {
  const http = await serverHttp();
  const res = await http.get(R.rules(wsId, firmId), { params });
  return unwrapServer<ReminderRule[]>(res);
}

export async function createReminderRule(
  wsId: string,
  firmId: string,
  dto: CreateReminderRuleDto,
): Promise<ReminderRule> {
  const http = await serverHttp();
  const res = await http.post(R.rules(wsId, firmId), dto);
  revalidatePath(`/dashboard/finance/firms/${firmId}/reminders/rules`);
  return unwrapServer<ReminderRule>(res);
}

export async function getReminderRule(
  wsId: string,
  firmId: string,
  ruleId: string,
): Promise<ReminderRule> {
  const http = await serverHttp();
  const res = await http.get(R.rule(wsId, firmId, ruleId));
  return unwrapServer<ReminderRule>(res);
}

export async function updateReminderRule(
  wsId: string,
  firmId: string,
  ruleId: string,
  dto: Partial<CreateReminderRuleDto>,
): Promise<ReminderRule> {
  const http = await serverHttp();
  const res = await http.patch(R.rule(wsId, firmId, ruleId), dto);
  revalidatePath(`/dashboard/finance/firms/${firmId}/reminders/rules`);
  return unwrapServer<ReminderRule>(res);
}

export async function deleteReminderRule(
  wsId: string,
  firmId: string,
  ruleId: string,
): Promise<void> {
  const http = await serverHttp();
  await http.delete(R.rule(wsId, firmId, ruleId));
  revalidatePath(`/dashboard/finance/firms/${firmId}/reminders/rules`);
}

// ===== Reminder Logs =====

export async function listReminderLogs(
  wsId: string,
  firmId: string,
  params?: Record<string, unknown>,
): Promise<{ items: ReminderLog[]; total: number; page: number; pageSize: number }> {
  const http = await serverHttp();
  const res = await http.get(R.logs(wsId, firmId), { params });
  return unwrapServer<{ items: ReminderLog[]; total: number; page: number; pageSize: number }>(res);
}

// ===== Reminder Templates =====

export async function listReminderTemplates(
  wsId: string,
  firmId: string,
): Promise<ReminderTemplate[]> {
  const http = await serverHttp();
  const res = await http.get(R.templates(wsId, firmId));
  return unwrapServer<ReminderTemplate[]>(res);
}

export async function upsertReminderTemplate(
  wsId: string,
  firmId: string,
  dto: Partial<ReminderTemplate>,
): Promise<ReminderTemplate> {
  const http = await serverHttp();
  const res = await http.patch(R.templates(wsId, firmId), dto);
  revalidatePath(`/dashboard/finance/firms/${firmId}/reminders`);
  return unwrapServer<ReminderTemplate>(res);
}

// ===== Manual Trigger =====

export async function triggerReminders(
  wsId: string,
  firmId: string,
  body?: { partyId?: string; ruleId?: string },
): Promise<{ triggered: boolean; sent: number; errors: number }> {
  const http = await serverHttp();
  const res = await http.post(R.trigger(wsId, firmId), body ?? {});
  return unwrapServer<{ triggered: boolean; sent: number; errors: number }>(res);
}
