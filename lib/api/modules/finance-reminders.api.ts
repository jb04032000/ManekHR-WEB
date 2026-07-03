import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  ReminderRule,
  ReminderLog,
  ReminderSettings,
  ReminderTemplate,
  CallTodo,
  CallTodoCount,
  CreateReminderRuleDto,
  UpdateReminderSettingsDto,
  CreateCallTodoDto,
  UpdateCallTodoDto,
} from '@/types';

const R = ApiEndpoints.finance.reminders;
const CT = ApiEndpoints.finance.callTodos;

export const remindersApi = {
  getSettings: async (wsId: string, firmId: string): Promise<ReminderSettings> =>
    unwrap<ReminderSettings>(await http.get(R.settings(wsId, firmId))),

  updateSettings: async (wsId: string, firmId: string, dto: UpdateReminderSettingsDto): Promise<ReminderSettings> =>
    unwrap<ReminderSettings>(await http.patch(R.settings(wsId, firmId), dto)),

  listRules: async (wsId: string, firmId: string, params?: Record<string, unknown>): Promise<ReminderRule[]> =>
    unwrap<ReminderRule[]>(await http.get(R.rules(wsId, firmId), { params })),

  createRule: async (wsId: string, firmId: string, dto: CreateReminderRuleDto): Promise<ReminderRule> =>
    unwrap<ReminderRule>(await http.post(R.rules(wsId, firmId), dto)),

  getRule: async (wsId: string, firmId: string, ruleId: string): Promise<ReminderRule> =>
    unwrap<ReminderRule>(await http.get(R.rule(wsId, firmId, ruleId))),

  updateRule: async (wsId: string, firmId: string, ruleId: string, dto: Partial<CreateReminderRuleDto>): Promise<ReminderRule> =>
    unwrap<ReminderRule>(await http.patch(R.rule(wsId, firmId, ruleId), dto)),

  deleteRule: async (wsId: string, firmId: string, ruleId: string): Promise<void> =>
    unwrap<void>(await http.delete(R.rule(wsId, firmId, ruleId))),

  listLogs: async (
    wsId: string,
    firmId: string,
    params?: Record<string, unknown>,
  ): Promise<{ items: ReminderLog[]; total: number; page: number; pageSize: number }> =>
    unwrap(await http.get(R.logs(wsId, firmId), { params })),

  listTemplates: async (wsId: string, firmId: string): Promise<ReminderTemplate[]> =>
    unwrap<ReminderTemplate[]>(await http.get(R.templates(wsId, firmId))),

  upsertTemplate: async (wsId: string, firmId: string, dto: Partial<ReminderTemplate>): Promise<ReminderTemplate> =>
    unwrap<ReminderTemplate>(await http.patch(R.templates(wsId, firmId), dto)),

  trigger: async (
    wsId: string,
    firmId: string,
    body?: { partyId?: string; ruleId?: string },
  ): Promise<{ triggered: boolean; sent: number; errors: number }> =>
    unwrap(await http.post(R.trigger(wsId, firmId), body ?? {})),
};

export const callTodosApi = {
  list: async (wsId: string, firmId: string, params?: Record<string, unknown>): Promise<CallTodo[]> =>
    unwrap<CallTodo[]>(await http.get(CT.list(wsId, firmId), { params })),

  count: async (wsId: string, firmId: string): Promise<CallTodoCount> =>
    unwrap<CallTodoCount>(await http.get(CT.count(wsId, firmId))),

  get: async (wsId: string, firmId: string, id: string): Promise<CallTodo> =>
    unwrap<CallTodo>(await http.get(CT.todo(wsId, firmId, id))),

  create: async (wsId: string, firmId: string, dto: CreateCallTodoDto): Promise<CallTodo> =>
    unwrap<CallTodo>(await http.post(CT.list(wsId, firmId), dto)),

  update: async (wsId: string, firmId: string, id: string, dto: UpdateCallTodoDto): Promise<CallTodo> =>
    unwrap<CallTodo>(await http.patch(CT.todo(wsId, firmId, id), dto)),

  delete: async (wsId: string, firmId: string, id: string): Promise<void> =>
    unwrap<void>(await http.delete(CT.todo(wsId, firmId, id))),

  snooze: async (wsId: string, firmId: string, id: string, days: number): Promise<CallTodo> =>
    unwrap<CallTodo>(await http.post(CT.snooze(wsId, firmId, id), { days })),

  complete: async (wsId: string, firmId: string, id: string, completionNote?: string): Promise<CallTodo> =>
    unwrap<CallTodo>(await http.post(CT.complete(wsId, firmId, id), { completionNote })),
};
