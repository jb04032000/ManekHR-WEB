import { create } from 'zustand';
import { salaryApi } from '@/lib/api';
import type {
  SalaryComponentTemplate,
  SeedComponentTemplatePayload,
  CreateComponentTemplatePayload,
  UpdateComponentTemplatePayload,
} from '@/types';

function upsertTemplateWithDefaultState(
  templates: SalaryComponentTemplate[],
  nextTemplate: SalaryComponentTemplate,
  placeAtFront = true,
): SalaryComponentTemplate[] {
  const withoutNext = templates.filter(
    (template) => template._id !== nextTemplate._id,
  );
  const merged = [...withoutNext];

  if (placeAtFront) {
    merged.unshift(nextTemplate);
  } else {
    const existingIndex = templates.findIndex(
      (template) => template._id === nextTemplate._id,
    );
    if (existingIndex !== -1) {
      merged.splice(existingIndex, 0, nextTemplate);
    } else {
      merged.push(nextTemplate);
    }
  }

  if (!nextTemplate.isDefault) {
    return merged;
  }

  return merged.map((template) =>
    template._id === nextTemplate._id
      ? template
      : { ...template, isDefault: false },
  );
}

interface ComponentTemplateState {
  templates: SalaryComponentTemplate[];
  isLoading: boolean;
  error: string | null;
  hasFetched: boolean;
  fetchedWorkspaceId: string | null;

  fetchTemplates: (workspaceId: string) => Promise<void>;
  seedTemplate: (workspaceId: string, data: SeedComponentTemplatePayload) => Promise<SalaryComponentTemplate>;
  createTemplate: (workspaceId: string, data: CreateComponentTemplatePayload) => Promise<SalaryComponentTemplate>;
  updateTemplate: (workspaceId: string, templateId: string, data: UpdateComponentTemplatePayload) => Promise<SalaryComponentTemplate>;
  deleteTemplate: (workspaceId: string, templateId: string) => Promise<void>;
  getDefaultTemplate: () => SalaryComponentTemplate | undefined;
  reset: () => void;
}

export const useComponentTemplateStore = create<ComponentTemplateState>((set, get) => ({
  templates: [],
  isLoading: false,
  error: null,
  hasFetched: false,
  fetchedWorkspaceId: null,

  fetchTemplates: async (workspaceId) => {
    const { hasFetched, fetchedWorkspaceId } = get();
    if (hasFetched && fetchedWorkspaceId === workspaceId) return;

    set({
      isLoading: true,
      error: null,
      ...(fetchedWorkspaceId === workspaceId
        ? {}
        : { templates: [], hasFetched: false, fetchedWorkspaceId: workspaceId }),
    });
    try {
      const templates = await salaryApi.listComponentTemplates(workspaceId);
      set({
        templates,
        isLoading: false,
        hasFetched: true,
        fetchedWorkspaceId: workspaceId,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch templates', isLoading: false });
    }
  },

  seedTemplate: async (workspaceId, data) => {
    const template = await salaryApi.seedComponentTemplate(workspaceId, data);
    set((s) => ({
      templates: upsertTemplateWithDefaultState(s.templates, template),
    }));
    return template;
  },

  createTemplate: async (workspaceId, data) => {
    const template = await salaryApi.createComponentTemplate(workspaceId, data);
    set((s) => ({
      templates: upsertTemplateWithDefaultState(s.templates, template),
    }));
    return template;
  },

  updateTemplate: async (workspaceId, templateId, data) => {
    const template = await salaryApi.updateComponentTemplate(workspaceId, templateId, data);
    set((s) => ({
      templates: upsertTemplateWithDefaultState(s.templates, template, false),
    }));
    return template;
  },

  deleteTemplate: async (workspaceId, templateId) => {
    await salaryApi.deleteComponentTemplate(workspaceId, templateId);
    set((s) => ({
      templates: s.templates.filter((t) => t._id !== templateId),
    }));
  },

  getDefaultTemplate: () => {
    return get().templates.find((t) => t.isDefault);
  },

  reset: () =>
    set({
      templates: [],
      isLoading: false,
      error: null,
      hasFetched: false,
      fetchedWorkspaceId: null,
    }),
}));
