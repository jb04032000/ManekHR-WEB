'use server';

import { revalidatePath } from 'next/cache';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  CallTodo,
  CallTodoCount,
  CreateCallTodoDto,
  UpdateCallTodoDto,
} from '@/types';

const CT = ApiEndpoints.finance.callTodos;

// ===== Call Todos =====

export async function listCallTodos(
  wsId: string,
  firmId: string,
  params?: Record<string, unknown>,
): Promise<CallTodo[]> {
  const http = await serverHttp();
  const res = await http.get(CT.list(wsId, firmId), { params });
  return unwrapServer<CallTodo[]>(res);
}

export async function getCallTodoCount(
  wsId: string,
  firmId: string,
): Promise<CallTodoCount> {
  const http = await serverHttp();
  const res = await http.get(CT.count(wsId, firmId));
  return unwrapServer<CallTodoCount>(res);
}

export async function getCallTodo(
  wsId: string,
  firmId: string,
  id: string,
): Promise<CallTodo> {
  const http = await serverHttp();
  const res = await http.get(CT.todo(wsId, firmId, id));
  return unwrapServer<CallTodo>(res);
}

export async function createCallTodo(
  wsId: string,
  firmId: string,
  dto: CreateCallTodoDto,
): Promise<CallTodo> {
  const http = await serverHttp();
  const res = await http.post(CT.list(wsId, firmId), dto);
  revalidatePath(`/dashboard/finance/firms/${firmId}/call-todos`);
  return unwrapServer<CallTodo>(res);
}

export async function updateCallTodo(
  wsId: string,
  firmId: string,
  id: string,
  dto: UpdateCallTodoDto,
): Promise<CallTodo> {
  const http = await serverHttp();
  const res = await http.patch(CT.todo(wsId, firmId, id), dto);
  revalidatePath(`/dashboard/finance/firms/${firmId}/call-todos`);
  return unwrapServer<CallTodo>(res);
}

export async function deleteCallTodo(
  wsId: string,
  firmId: string,
  id: string,
): Promise<void> {
  const http = await serverHttp();
  await http.delete(CT.todo(wsId, firmId, id));
  revalidatePath(`/dashboard/finance/firms/${firmId}/call-todos`);
}

export async function snoozeCallTodo(
  wsId: string,
  firmId: string,
  id: string,
  days: number,
): Promise<CallTodo> {
  const http = await serverHttp();
  const res = await http.post(CT.snooze(wsId, firmId, id), { days });
  revalidatePath(`/dashboard/finance/firms/${firmId}/call-todos`);
  return unwrapServer<CallTodo>(res);
}

export async function completeCallTodo(
  wsId: string,
  firmId: string,
  id: string,
  completionNote?: string,
): Promise<CallTodo> {
  const http = await serverHttp();
  const res = await http.post(CT.complete(wsId, firmId, id), { completionNote });
  revalidatePath(`/dashboard/finance/firms/${firmId}/call-todos`);
  return unwrapServer<CallTodo>(res);
}
