'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { CashRegisterExtended, DenominationCount, JournalVoucher } from '@/types';

const EA = ApiEndpoints.finance.cashRegisterActions;
const EB = ApiEndpoints.finance.cashRegisters;

// ===== Input types =====

export interface DayEndTallyInput {
  denominationBreakdown: DenominationCount[];
  narration?: string;
}

export interface ReplenishPettyCashInput {
  sourceAccountId: string;
  sourceCashRegisterId?: string;
  amountPaise: number;
  narration: string;
}

// ===== Extended Cash Register actions (F-06) =====

export async function dayEndTally(
  wsId: string,
  firmId: string,
  registerId: string,
  dto: DayEndTallyInput,
): Promise<{ register: CashRegisterExtended; varianceJv?: JournalVoucher }> {
  const http = await serverHttp();
  const res = await http.post(EA.dayEndTally(wsId, firmId, registerId), dto);
  return unwrapServer<{ register: CashRegisterExtended; varianceJv?: JournalVoucher }>(res);
}

export async function replenishPettyCash(
  wsId: string,
  firmId: string,
  registerId: string,
  dto: ReplenishPettyCashInput,
): Promise<{ register: CashRegisterExtended; jv: JournalVoucher }> {
  const http = await serverHttp();
  const res = await http.post(EA.replenish(wsId, firmId, registerId), dto);
  return unwrapServer<{ register: CashRegisterExtended; jv: JournalVoucher }>(res);
}

export async function getLowWaterAlerts(
  wsId: string,
  firmId: string,
): Promise<CashRegisterExtended[]> {
  const http = await serverHttp();
  const res = await http.get(EA.lowWaterAlerts(wsId, firmId));
  return unwrapServer<CashRegisterExtended[]>(res);
}
