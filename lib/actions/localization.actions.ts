'use server';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { PtSlabConfig, PtSlabEntry } from '@/types';

const E = ApiEndpoints.localization;
const A = ApiEndpoints.admin;

export interface Language {
  _id: string;
  code: string;
  name: string;
  nativeName: string;
  example?: string;
  isDefault: boolean;
  isActive: boolean;
  bundleVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationEntry {
  _id: string;
  languageCode: string;
  namespace: string;
  key: string;
  value: string;
  platforms?: string[];
  description?: string | null;
  screen?: string | null;
  feature?: string | null;
  componentRef?: string | null;
  tags?: string[];
  updatedAt: string;
}

export interface TranslationsIndexTuple {
  namespace: string;
  screen: string | null;
  feature: string | null;
  count: number;
}

export interface TranslationsIndex {
  tuples: TranslationsIndexTuple[];
  totalKeys: number;
  withMetadataPercent: number;
}

export interface CreateLanguagePayload {
  code: string;
  name: string;
  nativeName: string;
  example?: string;
  isDefault?: boolean;
}

export interface UpdateLanguagePayload {
  name?: string;
  nativeName?: string;
  example?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface CreatePtSlabPayload {
  state: string;
  frequency: 'monthly' | 'annual';
  slabs: PtSlabEntry[];
}

export interface UpdatePtSlabPayload {
  frequency?: 'monthly' | 'annual';
  slabs?: PtSlabEntry[];
  isActive?: boolean;
}

export async function getLanguages(): Promise<Language[]> {
  const http = await serverHttp();
  return http.get(ApiEndpoints.localization.languages).then(unwrapServer<Language[]>);
}

export async function getAdminLanguages(): Promise<Language[]> {
  const http = await serverHttp();
  return http.get(E.adminLanguages).then(unwrapServer<Language[]>);
}

export async function getAdminNamespaces(): Promise<string[]> {
  const http = await serverHttp();
  return http.get(E.adminNamespaces).then(unwrapServer<string[]>);
}

export async function createLanguage(data: CreateLanguagePayload): Promise<Language> {
  const http = await serverHttp();
  return http.post(E.createLanguage, data).then(unwrapServer<Language>);
}

export async function updateLanguage(code: string, data: UpdateLanguagePayload): Promise<Language> {
  const http = await serverHttp();
  return http.patch(E.updateLanguage(code), data).then(unwrapServer<Language>);
}

export async function deleteLanguage(code: string): Promise<Language> {
  const http = await serverHttp();
  return http.delete(E.deleteLanguage(code)).then(unwrapServer<Language>);
}

export async function hardDeleteLanguage(code: string): Promise<{ deleted: boolean }> {
  const http = await serverHttp();
  return http.delete(E.hardDeleteLanguage(code)).then(unwrapServer<{ deleted: boolean }>);
}

export async function getAdminTranslations(
  langCode: string,
  namespace?: string,
  platform?: string,
  screen?: string,
  feature?: string,
): Promise<TranslationEntry[]> {
  const http = await serverHttp();
  const params: Record<string, string> = {};
  if (namespace) params.namespace = namespace;
  if (platform) params.platform = platform;
  if (screen) params.screen = screen;
  if (feature) params.feature = feature;
  const url = E.adminTranslations(langCode);
  const result = await http
    .get(url, { params: Object.keys(params).length ? params : undefined })
    .then(unwrapServer<TranslationEntry[]>);
  return result;
}

export async function getTranslationsIndex(opts?: {
  langCode?: string;
  module?: string;
  screen?: string;
  feature?: string;
}): Promise<TranslationsIndex> {
  const http = await serverHttp();
  const params: Record<string, string> = {};
  if (opts?.langCode) params.langCode = opts.langCode;
  if (opts?.module) params.module = opts.module;
  if (opts?.screen) params.screen = opts.screen;
  if (opts?.feature) params.feature = opts.feature;
  return http
    .get(E.adminTranslationsIndex, {
      params: Object.keys(params).length ? params : undefined,
    })
    .then(unwrapServer<TranslationsIndex>);
}

export async function upsertTranslation(
  langCode: string,
  namespace: string,
  key: string,
  value: string,
  platforms?: string[],
  metadata?: {
    description?: string;
    screen?: string;
    feature?: string;
    componentRef?: string;
    tags?: string[];
  },
): Promise<TranslationEntry> {
  const http = await serverHttp();
  const body: Record<string, any> = { value };
  if (platforms) body.platforms = platforms;
  if (metadata?.description !== undefined) body.description = metadata.description;
  if (metadata?.screen !== undefined) body.screen = metadata.screen;
  if (metadata?.feature !== undefined) body.feature = metadata.feature;
  if (metadata?.componentRef !== undefined) body.componentRef = metadata.componentRef;
  if (metadata?.tags !== undefined) body.tags = metadata.tags;
  return http
    .put(E.upsertTranslation(langCode, namespace, key), body)
    .then(unwrapServer<TranslationEntry>);
}

export async function deleteTranslation(
  langCode: string,
  namespace: string,
  key: string,
): Promise<{ deleted: boolean }> {
  const http = await serverHttp();
  return http
    .delete(E.deleteTranslation(langCode, namespace, key))
    .then(unwrapServer<{ deleted: boolean }>);
}

export async function bulkImportTranslations(
  langCode: string,
  translations: Record<string, unknown>,
  platform?: string,
): Promise<{ imported: number }> {
  const http = await serverHttp();
  const body: Record<string, any> = { translations };
  if (platform) body.platform = platform;
  return http.post(E.bulkImport(langCode), body).then(unwrapServer<{ imported: number }>);
}

export async function exportTranslations(langCode: string): Promise<Record<string, unknown>> {
  const http = await serverHttp();
  return http.get(E.exportBundle(langCode)).then(unwrapServer<Record<string, unknown>>);
}

export async function getTranslationDiff(
  langCode: string,
  platform?: string,
): Promise<{ missingKeys: string[]; totalDefault: number; totalTarget: number }> {
  const http = await serverHttp();
  const params: Record<string, string> = {};
  if (platform) params.platform = platform;
  return http
    .get(E.diff(langCode), { params: Object.keys(params).length ? params : undefined })
    .then(unwrapServer<{ missingKeys: string[]; totalDefault: number; totalTarget: number }>);
}

export async function copyFromDefault(
  langCode: string,
  userId: string,
  platform?: string,
): Promise<{ copied: number }> {
  const http = await serverHttp();
  const body: Record<string, string> = { userId };
  const params: Record<string, string> = {};
  if (platform) params.platform = platform;
  return http
    .post(E.copyFromDefault(langCode), body, {
      params: Object.keys(params).length ? params : undefined,
    })
    .then(unwrapServer<{ copied: number }>);
}

export async function getAdminPtSlabs(): Promise<PtSlabConfig[]> {
  const http = await serverHttp();
  return http.get(A.ptSlabs).then(unwrapServer<PtSlabConfig[]>);
}

export async function getAdminPtSlab(state: string): Promise<PtSlabConfig> {
  const http = await serverHttp();
  return http.get(A.ptSlabByState(state)).then(unwrapServer<PtSlabConfig>);
}

export async function createAdminPtSlab(data: CreatePtSlabPayload): Promise<PtSlabConfig> {
  const http = await serverHttp();
  return http.post(A.ptSlabs, data).then(unwrapServer<PtSlabConfig>);
}

export async function updateAdminPtSlab(
  state: string,
  data: UpdatePtSlabPayload,
): Promise<PtSlabConfig> {
  const http = await serverHttp();
  return http.put(A.ptSlabByState(state), data).then(unwrapServer<PtSlabConfig>);
}

export async function deleteAdminPtSlab(state: string): Promise<{ message: string }> {
  const http = await serverHttp();
  return http.delete(A.ptSlabByState(state)).then(unwrapServer<{ message: string }>);
}
