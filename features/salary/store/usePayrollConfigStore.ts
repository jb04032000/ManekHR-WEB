import { create } from 'zustand';
import type {
  PayrollConfig,
  PayrollConfigDeductor,
  PayrollConfigFeatures,
  PayrollConfigStatutory,
  PayrollPreset,
  UpdatePayrollConfigPayload,
} from '@/types';
import { salaryApi } from '@/lib/api/modules';
import { env } from '@/lib/env';

interface PayrollConfigState {
  config: PayrollConfig | null;
  isLoading: boolean;
  error: string | null;
  fetchConfig: (workspaceId: string) => Promise<void>;
  updateConfig: (workspaceId: string, updates: UpdatePayrollConfigPayload) => Promise<void>;
  applyPreset: (workspaceId: string, preset: PayrollPreset) => Promise<void>;
  isFeatureEnabled: (feature: keyof PayrollConfigFeatures) => boolean;
  getCurrencyConfig: () => { symbol: string; locale: string; code: string };
  reset: () => void;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const DEFAULT_PAYROLL_STATUTORY: PayrollConfigStatutory = {
  pfEnabled: false,
  pfEstablishmentCode: '',
  pfWageCeiling: 15000,
  esiEnabled: false,
  esiCode: '',
  esiGrossThreshold: 21000,
  ptEnabled: false,
  tdsEnabled: false,
  lwfEnabled: false,
  ptState: 'Gujarat',
  ptUseCustomSlabs: false,
  ptCustomSlabs: [],
};

const DEFAULT_PAYROLL_DEDUCTOR: PayrollConfigDeductor = {
  tan: '',
  pan: '',
  branchDivision: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
  responsiblePersonName: '',
  responsiblePersonPan: '',
  responsiblePersonDesignation: '',
};

const withPayrollDefaults = (config: PayrollConfig): PayrollConfig => ({
  ...config,
  statutory: {
    ...DEFAULT_PAYROLL_STATUTORY,
    ...(config.statutory ?? {}),
  },
  deductor: {
    ...DEFAULT_PAYROLL_DEDUCTOR,
    ...(config.deductor ?? {}),
  },
});

export const usePayrollConfigStore = create<PayrollConfigState>((set, get) => ({
  config: null,
  isLoading: false,
  error: null,

  fetchConfig: async (workspaceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const config = withPayrollDefaults(
        await salaryApi.getPayrollConfig<PayrollConfig>(workspaceId),
      );
      if (env.isDev) {
        console.info('[PayrollConfigStore] fetchConfig', {
          workspaceId,
          preset: config?.preset ?? null,
          features: config?.features ?? null,
        });
      }
      set({ config, isLoading: false });
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to fetch config'), isLoading: false });
    }
  },

  updateConfig: async (workspaceId: string, updates: UpdatePayrollConfigPayload) => {
    set({ isLoading: true, error: null });
    try {
      const updatedFeatureKey =
        updates.features && Object.keys(updates.features).length === 1
          ? (Object.keys(updates.features)[0] as keyof PayrollConfig['features'])
          : null;
      if (env.isDev) {
        console.info('[PayrollConfigStore] updateConfig:start', {
          workspaceId,
          updates,
          currentConfig: get().config,
        });
      }
      const config = withPayrollDefaults(
        await salaryApi.updatePayrollConfig<PayrollConfig>(workspaceId, updates),
      );
      if (env.isDev) {
        console.info('[PayrollConfigStore] updateConfig:done', {
          workspaceId,
          updates,
          returnedConfig: config,
          updatedFeatureKey,
          updatedFeatureValue: updatedFeatureKey ? config?.features?.[updatedFeatureKey] : null,
        });
      }
      set({ config, isLoading: false });
    } catch (error) {
      if (env.isDev) {
        console.error('[PayrollConfigStore] updateConfig:error', {
          workspaceId,
          updates,
          error,
        });
      }
      set({ error: getErrorMessage(error, 'Failed to update config'), isLoading: false });
      throw error;
    }
  },

  applyPreset: async (workspaceId: string, preset: PayrollPreset) => {
    await get().updateConfig(workspaceId, { preset });
  },

  isFeatureEnabled: (feature: keyof PayrollConfigFeatures) => {
    return get().config?.features?.[feature] ?? true;
  },

  getCurrencyConfig: () => {
    const cfg = get().config?.display;
    return {
      symbol: cfg?.currencySymbol || '₹',
      locale: cfg?.currencyLocale || 'en-IN',
      code: cfg?.currencyCode || 'INR',
    };
  },

  reset: () => {
    set({ config: null, isLoading: false, error: null });
  },
}));
