/** Connect revenue dashboard types (M3.3). Mirrors the backend rollup. */

export interface ConnectPlanRevenueRow {
  planId: string;
  planName: string;
  tier: string;
  grossPaise: number;
  refundedPaise: number;
  netPaise: number;
  payments: number;
}

export interface ConnectRevenueSummary {
  subscription: {
    grossPaise: number;
    refundedPaise: number;
    netPaise: number;
    payments: number;
    byPlan: ConnectPlanRevenueRow[];
  };
}
