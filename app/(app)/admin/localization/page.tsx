'use client';
import { useEffect, useMemo, useState, useCallback, startTransition } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Tooltip,
  Typography,
  InputNumber,
  Radio,
  Dropdown,
  Skeleton,
} from 'antd';
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface';
import {
  PlusOutlined,
  StarOutlined,
  StarFilled,
  DownloadOutlined,
  UploadOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  GlobalOutlined,
  TranslationOutlined,
  DeleteOutlined,
  CopyOutlined,
  MoreOutlined,
  SettingOutlined,
  TagsOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  getAdminLanguages,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  hardDeleteLanguage,
  getAdminTranslations,
  upsertTranslation,
  deleteTranslation,
  bulkImportTranslations,
  exportTranslations,
  getTranslationDiff,
  copyFromDefault,
  getAdminNamespaces,
  getAdminPtSlabs,
  createAdminPtSlab,
  updateAdminPtSlab,
  deleteAdminPtSlab,
} from '@/lib/actions';
import type { Language as Lang, TranslationEntry } from '@/lib/actions/localization.actions';
import type { PtSlabConfig, PtSlabEntry } from '@/types';
import { parseApiError, fmt } from '@/lib/utils';
import { StatTile } from '@/components/ui/StatTile';
import { MetadataPickerTree } from '@/components/admin/localization/MetadataPickerTree';
import { HardcodedReportPanel } from '@/components/admin/localization/HardcodedReportPanel';
import { BulkActionsBar } from '@/components/admin/localization/BulkActionsBar';
import {
  TranslationRowMetadataEditor,
  type TranslationMetadata,
} from '@/components/admin/localization/TranslationRowMetadata';

const { Text } = Typography;

const FALLBACK_NAMESPACES = [
  'common',
  'auth',
  'workspace',
  'navigation',
  'roster',
  'attendance',
  'payroll',
  'team',
  'profile',
  'dashboard',
  'rbac',
  'admin',
  'bills',
  'roles',
  'subscription',
  'notifications',
  'invite',
];

function ErrorState({ message: msg }: { message: string }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Card>
        <div className="text-center">
          <p className="mb-2 text-lg text-error">Error</p>
          <p className="text-subtle">{msg}</p>
        </div>
      </Card>
    </div>
  );
}

const PLATFORM_OPTIONS = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'web', label: 'Web' },
];

type PtSlabFormValues = {
  state: string;
  frequency: 'monthly' | 'annual';
  slabs: PtSlabEntry[];
};

const createDefaultPtSlabEntry = (): PtSlabEntry => ({
  minSalary: 0,
  maxSalary: null,
  ptAmount: 0,
});

export default function AdminLocalizationPage() {
  const [msgApi, ctx] = message.useMessage();
  const [initError, setInitError] = useState<string | null>(null);

  // --- Languages tab ---
  const [langs, setLangs] = useState<Lang[]>([]);
  const [langsLoading, setLangsLoading] = useState(true);
  const [addLangOpen, setAddLangOpen] = useState(false);
  const [addLangForm] = Form.useForm();
  const [addLangSaving, setAddLangSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editingExample, setEditingExample] = useState('');
  const [editExampleValue, setEditExampleValue] = useState('');
  const [savingExample, setSavingExample] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalType, setDeleteModalType] = useState<'soft' | 'hard'>('soft');
  const [deleteTarget, setDeleteTarget] = useState<Lang | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // --- Translations tab ---
  const [selectedLang, setSelectedLang] = useState<string>('');
  const [nsFilter, setNsFilter] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [transLoading, setTransLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string>('');
  const [editValue, setEditValue] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [diffInfo, setDiffInfo] = useState<{
    missingKeys: string[];
    totalDefault: number;
    totalTarget: number;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importPlatform, setImportPlatform] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editPlatforms, setEditPlatforms] = useState<string[]>(['mobile', 'web']);
  const [, setCopying] = useState(false);
  const [namespaces, setNamespaces] = useState<string[]>(FALLBACK_NAMESPACES);
  const [, setNamespacesLoading] = useState(false);

  // Picker tree selection (module / screen / feature)
  const [picker, setPicker] = useState<{
    module?: string;
    screen?: string;
    feature?: string;
  }>({});
  const [pickerRefresh, setPickerRefresh] = useState(0);

  // Bulk + metadata editor
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMetaOpen, setBulkMetaOpen] = useState(false);
  const [bulkMetaInitial, setBulkMetaInitial] = useState<TranslationMetadata>({});
  const [bulkMetaSaving, setBulkMetaSaving] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [savingMetadataKey, setSavingMetadataKey] = useState('');

  // --- Professional Tax slab management ---
  const [ptSlabs, setPtSlabs] = useState<PtSlabConfig[]>([]);
  const [ptSlabsLoading, setPtSlabsLoading] = useState(true);
  const [ptModalOpen, setPtModalOpen] = useState(false);
  const [ptSaving, setPtSaving] = useState(false);
  const [editingPtSlab, setEditingPtSlab] = useState<PtSlabConfig | null>(null);
  const [ptForm] = Form.useForm<PtSlabFormValues>();

  // Active tab
  const [activeTab, setActiveTab] = useState<'languages' | 'translations' | 'pt'>('languages');

  // Load languages
  const loadLanguages = useCallback(async () => {
    startTransition(() => {
      setLangsLoading(true);
    });
    try {
      const data = await getAdminLanguages();
      startTransition(() => {
        setLangs(data ?? []);
        if (!selectedLang && data?.length) setSelectedLang(data[0].code);
      });
    } catch (e) {
      const errMsg = parseApiError(e);
      startTransition(() => {
        setInitError(errMsg);
      });
      msgApi.error(errMsg);
    } finally {
      setLangsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLanguages();
  }, [loadLanguages]);

  // Load namespaces
  const loadNamespaces = useCallback(async () => {
    startTransition(() => {
      setNamespacesLoading(true);
    });
    try {
      const data = await getAdminNamespaces();
      startTransition(() => {
        if (data && data.length > 0) setNamespaces(data.sort());
        else setNamespaces(FALLBACK_NAMESPACES);
      });
    } catch {
      startTransition(() => {
        setNamespaces(FALLBACK_NAMESPACES);
      });
    } finally {
      setNamespacesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNamespaces();
  }, [loadNamespaces]);

  const loadPtSlabs = useCallback(async () => {
    startTransition(() => {
      setPtSlabsLoading(true);
    });
    try {
      const data = await getAdminPtSlabs();
      startTransition(() => {
        setPtSlabs(data ?? []);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setPtSlabsLoading(false);
    }
  }, [msgApi]);

  useEffect(() => {
    loadPtSlabs();
  }, [loadPtSlabs]);

  // Load translations when lang/ns/platform/picker changes
  const loadTranslations = useCallback(async () => {
    if (!selectedLang) return;
    startTransition(() => {
      setTransLoading(true);
    });
    try {
      const effectiveNs = picker.module ?? nsFilter;
      const [data, diff] = await Promise.all([
        getAdminTranslations(
          selectedLang,
          effectiveNs || undefined,
          platformFilter || undefined,
          picker.screen,
          picker.feature,
        ),
        getTranslationDiff(selectedLang, platformFilter || undefined),
      ]);
      startTransition(() => {
        setTranslations(data ?? []);
        setDiffInfo(diff);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setTransLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLang, nsFilter, platformFilter, picker]);

  useEffect(() => {
    if (selectedLang) loadTranslations();
  }, [loadTranslations, selectedLang]);

  const handleToggleActive = async (lang: Lang) => {
    if (lang.isDefault) {
      msgApi.warning('Cannot deactivate the default language');
      return;
    }
    try {
      await updateLanguage(lang.code, { isActive: !lang.isActive });
      msgApi.success(`Language ${lang.isActive ? 'deactivated' : 'activated'}`);
      loadLanguages();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handleSetDefault = async (lang: Lang) => {
    if (lang.isDefault) return;
    try {
      await updateLanguage(lang.code, { isDefault: true });
      msgApi.success(`${lang.name} set as default`);
      loadLanguages();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handleDeleteLanguage = (lang: Lang) => {
    if (lang.isDefault) return;
    setDeleteTarget(lang);
    setDeleteModalType('soft');
    setDeleteModalOpen(true);
  };

  const handleHardDeleteLanguage = (lang: Lang) => {
    setDeleteTarget(lang);
    setDeleteModalType('hard');
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteModalType === 'soft') {
        await deleteLanguage(deleteTarget.code);
        msgApi.success(`${deleteTarget.name} deleted`);
      } else {
        await hardDeleteLanguage(deleteTarget.code);
        msgApi.success(`${deleteTarget.name} permanently deleted`);
      }
      loadLanguages();
      setDeleteModalOpen(false);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setDeleteLoading(false);
    }
  };

  const startEditExample = (lang: Lang) => {
    setEditingExample(lang._id);
    setEditExampleValue(lang.example ?? '');
  };

  const cancelEditExample = () => {
    setEditingExample('');
    setEditExampleValue('');
  };

  const saveEditExample = async (lang: Lang) => {
    setSavingExample(true);
    try {
      await updateLanguage(lang.code, { example: editExampleValue || undefined });
      msgApi.success('Example updated');
      setEditingExample('');
      loadLanguages();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSavingExample(false);
    }
  };

  const handleDeleteTranslation = (record: TranslationEntry) => {
    Modal.confirm({
      title: 'Delete Translation',
      content: `Delete "${record.namespace}.${record.key}" for ${record.languageCode.toUpperCase()}?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteTranslation(record.languageCode, record.namespace, record.key);
          msgApi.success('Translation deleted');
          loadTranslations();
          setPickerRefresh((n) => n + 1);
        } catch (e) {
          msgApi.error(parseApiError(e));
        }
      },
    });
  };

  const handleAddLanguage = async () => {
    try {
      const vals = await addLangForm.validateFields();
      setAddLangSaving(true);
      await createLanguage({ ...vals, code: vals.code.toLowerCase() });
      msgApi.success('Language added');
      setAddLangOpen(false);
      addLangForm.resetFields();
      loadLanguages();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      msgApi.error(parseApiError(e));
    } finally {
      setAddLangSaving(false);
    }
  };

  const startEdit = (record: TranslationEntry) => {
    setEditingKey(record._id);
    setEditValue(record.value);
    setEditPlatforms(record.platforms ?? ['mobile', 'web']);
  };

  const cancelEdit = () => {
    setEditingKey('');
    setEditValue('');
    setEditPlatforms(['mobile', 'web']);
  };

  const saveEdit = async (record: TranslationEntry) => {
    setSavingKey(record._id);
    try {
      await upsertTranslation(
        record.languageCode,
        record.namespace,
        record.key,
        editValue,
        editPlatforms,
      );
      msgApi.success('Saved');
      setEditingKey('');
      loadTranslations();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSavingKey('');
    }
  };

  const saveRowMetadata = async (record: TranslationEntry, metadata: TranslationMetadata) => {
    setSavingMetadataKey(record._id);
    try {
      await upsertTranslation(
        record.languageCode,
        record.namespace,
        record.key,
        record.value,
        record.platforms,
        metadata,
      );
      msgApi.success('Metadata saved');
      setExpandedRowKeys((keys) => keys.filter((k) => k !== record._id));
      loadTranslations();
      setPickerRefresh((n) => n + 1);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSavingMetadataKey('');
    }
  };

  const handleCopyFromDefault = async () => {
    if (!selectedLang) return;
    setCopying(true);
    try {
      const defaultLang = langs.find((l) => l.isDefault);
      const res = await copyFromDefault(selectedLang, 'admin', platformFilter || undefined);
      msgApi.success(`Copied ${res.copied} keys${defaultLang ? ` from ${defaultLang.name}` : ''}`);
      loadTranslations();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setCopying(false);
    }
  };

  const handleImport = async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      msgApi.error('Invalid JSON');
      return;
    }
    setImporting(true);
    try {
      const res = await bulkImportTranslations(selectedLang, parsed, importPlatform || undefined);
      msgApi.success(`Imported ${res.imported} strings`);
      setImportOpen(false);
      setImportJson('');
      setImportPlatform('');
      loadTranslations();
      setPickerRefresh((n) => n + 1);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    if (!selectedLang) {
      msgApi.warning('Select a language first');
      return;
    }
    setExporting(true);
    try {
      const data = await exportTranslations(selectedLang);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedLang}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setExporting(false);
    }
  };

  const closePtModal = () => {
    setPtModalOpen(false);
    setEditingPtSlab(null);
    ptForm.resetFields();
  };

  const openCreatePtSlabModal = () => {
    setEditingPtSlab(null);
    ptForm.setFieldsValue({
      state: '',
      frequency: 'monthly',
      slabs: [createDefaultPtSlabEntry()],
    });
    setPtModalOpen(true);
  };

  const openEditPtSlabModal = (record: PtSlabConfig) => {
    setEditingPtSlab(record);
    ptForm.setFieldsValue({
      state: record.state,
      frequency: record.frequency,
      slabs:
        record.slabs.length > 0
          ? record.slabs.map((slab) => ({
              minSalary: slab.minSalary,
              maxSalary: slab.maxSalary,
              ptAmount: slab.ptAmount,
            }))
          : [createDefaultPtSlabEntry()],
    });
    setPtModalOpen(true);
  };

  const handleSavePtSlab = async () => {
    try {
      const values = await ptForm.validateFields();
      const payload = {
        state: values.state.trim(),
        frequency: values.frequency,
        slabs: values.slabs.map((slab) => ({
          minSalary: slab.minSalary ?? 0,
          maxSalary: slab.maxSalary ?? null,
          ptAmount: slab.ptAmount ?? 0,
        })),
      };
      setPtSaving(true);
      if (editingPtSlab) {
        await updateAdminPtSlab(editingPtSlab.state, {
          frequency: payload.frequency,
          slabs: payload.slabs,
        });
        msgApi.success('PT slab configuration updated');
      } else {
        await createAdminPtSlab(payload);
        msgApi.success('PT slab configuration created');
      }
      closePtModal();
      loadPtSlabs();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      msgApi.error(parseApiError(e));
    } finally {
      setPtSaving(false);
    }
  };

  const handleDeletePtSlab = (record: PtSlabConfig) => {
    Modal.confirm({
      title: 'Delete PT slab configuration?',
      content: `Delete the Professional Tax slab setup for ${record.state}?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteAdminPtSlab(record.state);
          msgApi.success('PT slab configuration deleted');
          loadPtSlabs();
        } catch (e) {
          msgApi.error(parseApiError(e));
        }
      },
    });
  };

  const filteredTranslations = useMemo(
    () =>
      translations.filter((t) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return t.key.toLowerCase().includes(q) || t.value.toLowerCase().includes(q);
      }),
    [translations, search],
  );

  const displayedLangs = showInactive ? langs : langs.filter((l) => l.isActive);

  const platformLabel = (platforms?: string[]) => {
    if (!platforms || platforms.length === 0) return 'both';
    const sorted = [...platforms].sort();
    if (sorted.length === 2 && sorted[0] === 'mobile' && sorted[1] === 'web') return 'both';
    if (sorted.length === 1) return sorted[0];
    return sorted.join(', ');
  };

  // ─── Bulk operations ────────────────────────────────────────────────
  const clearSelection = () => setSelectedRowKeys([]);

  const bulkDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    setBulkLoading(true);
    let ok = 0;
    let fail = 0;
    for (const id of selectedRowKeys) {
      const row = translations.find((t) => t._id === id);
      if (!row) {
        fail += 1;
        continue;
      }
      try {
        await deleteTranslation(row.languageCode, row.namespace, row.key);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setBulkLoading(false);
    if (ok > 0) msgApi.success(`Deleted ${ok}${fail > 0 ? ` (${fail} failed)` : ''}`);
    if (ok === 0 && fail > 0) msgApi.error('Bulk delete failed');
    clearSelection();
    loadTranslations();
    setPickerRefresh((n) => n + 1);
  };

  const openBulkMetaModal = () => {
    setBulkMetaInitial({});
    setBulkMetaOpen(true);
  };

  const applyBulkMetadata = async (metadata: TranslationMetadata) => {
    if (selectedRowKeys.length === 0) return;
    setBulkMetaSaving(true);
    let ok = 0;
    let fail = 0;
    for (const id of selectedRowKeys) {
      const row = translations.find((t) => t._id === id);
      if (!row) {
        fail += 1;
        continue;
      }
      try {
        await upsertTranslation(
          row.languageCode,
          row.namespace,
          row.key,
          row.value,
          row.platforms,
          metadata,
        );
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setBulkMetaSaving(false);
    if (ok > 0) msgApi.success(`Updated metadata on ${ok}${fail > 0 ? ` (${fail} failed)` : ''}`);
    if (ok === 0 && fail > 0) msgApi.error('Bulk metadata update failed');
    setBulkMetaOpen(false);
    clearSelection();
    loadTranslations();
    setPickerRefresh((n) => n + 1);
  };

  const rowSelection: TableRowSelection<TranslationEntry> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
    preserveSelectedRowKeys: true,
  };

  // ─── Stats for tiles ────────────────────────────────────────────────
  const totalLangs = langs.length;
  const activeLangs = langs.filter((l) => l.isActive).length;
  const missingCount = diffInfo?.missingKeys?.length ?? 0;
  const totalKeys = translations.length;
  const taggedKeys = translations.filter((t) => Boolean(t.screen)).length;
  const taggedPercent = totalKeys === 0 ? 0 : Math.round((taggedKeys / totalKeys) * 1000) / 10;

  // ─── Columns ─────────────────────────────────────────────────────────
  const langColumns: ColumnsType<Lang> = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 80,
      render: (v: string) => <Tag className="font-mono uppercase">{v}</Tag>,
    },
    {
      title: 'Language',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (v: string, r: Lang) => (
        <div>
          <p className="m-0 text-[13px] font-semibold">{v}</p>
          <p className="m-0 text-[11px] text-subtle">{r.nativeName}</p>
        </div>
      ),
    },
    {
      title: 'Default',
      dataIndex: 'isDefault',
      key: 'default',
      width: 90,
      align: 'center',
      render: (v: boolean) => (v ? <Tag color="gold">Default</Tag> : null),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'active',
      width: 100,
      align: 'center',
      render: (v: boolean, r: Lang) => (
        <Switch
          size="small"
          checked={v}
          aria-label={v ? `Deactivate ${r.code}` : `Activate ${r.code}`}
          onChange={() => handleToggleActive(r)}
          disabled={r.isDefault}
        />
      ),
    },
    {
      title: 'Version',
      dataIndex: 'bundleVersion',
      key: 'version',
      width: 80,
      align: 'center',
      render: (v: number) => <Tag className="font-mono">v{v ?? 1}</Tag>,
    },
    {
      title: 'Example',
      dataIndex: 'example',
      key: 'example',
      width: 200,
      render: (v: string | undefined, r: Lang) =>
        editingExample === r._id ? (
          <Space size={4}>
            <Input
              value={editExampleValue}
              onChange={(e) => setEditExampleValue(e.target.value)}
              onPressEnter={() => saveEditExample(r)}
              placeholder="e.g., Hello, Welcome!"
              size="small"
              style={{ width: 120 }}
              autoFocus
            />
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined className="text-success" />}
              loading={savingExample}
              onClick={() => saveEditExample(r)}
              aria-label="Save example"
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={cancelEditExample}
              aria-label="Cancel"
            />
          </Space>
        ) : (
          <Space size={2}>
            <span className={v ? 'text-[13px] text-muted italic' : 'text-[12px] text-subtle'}>
              {v || '-'}
            </span>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => startEditExample(r)}
              className="ml-1"
              aria-label={`Edit example for ${r.code}`}
            />
          </Space>
        ),
    },
    {
      title: 'Added',
      dataIndex: 'createdAt',
      key: 'created',
      width: 110,
      render: (v: string) => fmt(v),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_: unknown, r: Lang) => (
        <Space size={4} className="row-actions-secondary">
          <Tooltip title={r.isDefault ? 'Already default' : 'Set as default'}>
            <Button
              type="text"
              size="small"
              icon={r.isDefault ? <StarFilled className="text-warning" /> : <StarOutlined />}
              onClick={() => handleSetDefault(r)}
              disabled={r.isDefault}
              aria-label={r.isDefault ? 'Already default' : `Set ${r.code} as default`}
            />
          </Tooltip>
          {r.isActive ? (
            <Tooltip title={r.isDefault ? 'Cannot delete default' : 'Deactivate language'}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteLanguage(r)}
                disabled={r.isDefault}
                aria-label={`Deactivate ${r.code}`}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Permanently delete language and all translations">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleHardDeleteLanguage(r)}
                aria-label={`Permanently delete ${r.code}`}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const transColumns: ColumnsType<TranslationEntry> = [
    {
      title: 'Namespace',
      dataIndex: 'namespace',
      key: 'ns',
      width: 110,
      render: (v: string) => (
        <Tag color="blue" className="font-mono text-[11px]">
          {v}
        </Tag>
      ),
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: 200,
      render: (v: string) => <Text className="font-mono text-[12px]">{v}</Text>,
    },
    {
      title: 'Translation',
      dataIndex: 'value',
      key: 'value',
      render: (v: string, r: TranslationEntry) =>
        editingKey === r._id ? (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onPressEnter={() => saveEdit(r)}
            autoFocus
            size="small"
            aria-label={`Edit translation for ${r.namespace}.${r.key}`}
          />
        ) : (
          <span className="text-[13px]">{v}</span>
        ),
    },
    {
      title: 'Tags',
      key: 'metaTags',
      width: 160,
      render: (_: unknown, r: TranslationEntry) => {
        const tags = r.tags ?? [];
        const hasScreen = Boolean(r.screen);
        return (
          <Space size={4} wrap>
            {hasScreen && (
              <Tooltip title={`${r.screen}${r.feature ? ' / ' + r.feature : ''}`}>
                <Tag color="processing" className="text-[10.5px]">
                  {r.screen}
                </Tag>
              </Tooltip>
            )}
            {tags.slice(0, 2).map((t) => (
              <Tag key={t} className="text-[10.5px]">
                {t}
              </Tag>
            ))}
            {tags.length > 2 && <Tag className="text-[10.5px]">+{tags.length - 2}</Tag>}
            {!hasScreen && tags.length === 0 && <span className="text-[11px] text-subtle">-</span>}
          </Space>
        );
      },
    },
    {
      title: 'Platform',
      dataIndex: 'platforms',
      key: 'platforms',
      width: 120,
      render: (platforms: string[] | undefined, r: TranslationEntry) =>
        editingKey === r._id ? (
          <Select
            mode="multiple"
            size="small"
            value={editPlatforms}
            onChange={setEditPlatforms}
            className="w-28"
            options={[
              { value: 'mobile', label: 'Mobile' },
              { value: 'web', label: 'Web' },
            ]}
            aria-label="Select platforms"
          />
        ) : (
          (() => {
            const label = platformLabel(platforms);
            const color = label === 'mobile' ? 'green' : label === 'web' ? 'purple' : 'default';
            return (
              <Tag color={color} className="text-[11px]">
                {label}
              </Tag>
            );
          })()
        ),
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'upd',
      width: 110,
      render: (v: string) => fmt(v),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      width: 140,
      align: 'right',
      render: (_: unknown, r: TranslationEntry) =>
        editingKey === r._id ? (
          <Space size={4}>
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined className="text-success" />}
              loading={savingKey === r._id}
              onClick={() => saveEdit(r)}
              aria-label="Save translation"
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={cancelEdit}
              aria-label="Cancel edit"
            />
          </Space>
        ) : (
          <Space size={4} className="row-actions-secondary">
            <Tooltip title="Edit value">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => startEdit(r)}
                aria-label={`Edit translation for ${r.namespace}.${r.key}`}
              />
            </Tooltip>
            <Tooltip title="Edit metadata">
              <Button
                type="text"
                size="small"
                icon={<TagsOutlined />}
                onClick={() =>
                  setExpandedRowKeys((keys) =>
                    keys.includes(r._id) ? keys.filter((k) => k !== r._id) : [...keys, r._id],
                  )
                }
                aria-label={`Edit metadata for ${r.namespace}.${r.key}`}
              />
            </Tooltip>
            <Tooltip title="Delete translation">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteTranslation(r)}
                aria-label={`Delete ${r.namespace}.${r.key}`}
              />
            </Tooltip>
          </Space>
        ),
    },
  ];

  const ptSlabColumns: ColumnsType<PtSlabConfig> = [
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (value: string) => (
        <span className="font-medium">
          {value}
          {value === 'Gujarat' ? ' (Default)' : ''}
        </span>
      ),
    },
    {
      title: 'Frequency',
      dataIndex: 'frequency',
      key: 'frequency',
      width: 120,
      render: (value: PtSlabConfig['frequency']) => (
        <Tag color="blue">{value === 'annual' ? 'Annual' : 'Monthly'}</Tag>
      ),
    },
    {
      title: 'Slabs Count',
      key: 'slabsCount',
      width: 120,
      render: (_value: unknown, record: PtSlabConfig) => record.slabs.length,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      width: 120,
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'default'}>{value ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_value: unknown, record: PtSlabConfig) => (
        <Space size={4} className="row-actions-secondary">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditPtSlabModal(record)}
            aria-label={`Edit PT slab for ${record.state}`}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeletePtSlab(record)}
            aria-label={`Delete PT slab for ${record.state}`}
          />
        </Space>
      ),
    },
  ];

  if (initError) {
    return (
      <>
        {ctx}
        <ErrorState message={initError} />
      </>
    );
  }

  // ─── Header right action zone ───────────────────────────────────────
  const headerActions = (
    <div className="flex items-center gap-2">
      <HardcodedReportPanel buttonProps={{ size: 'middle' }} />
      <Button
        icon={<DownloadOutlined />}
        onClick={handleExport}
        loading={exporting}
        disabled={!selectedLang}
      >
        Export
      </Button>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        className="cr-cta-gold"
        onClick={() => setAddLangOpen(true)}
      >
        Add language
      </Button>
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            {
              key: 'copy',
              icon: <CopyOutlined />,
              label: 'Copy from default',
              disabled: !selectedLang,
              onClick: handleCopyFromDefault,
            },
            {
              key: 'import',
              icon: <UploadOutlined />,
              label: 'Import JSON',
              disabled: !selectedLang,
              onClick: () => setImportOpen(true),
            },
            { type: 'divider' as const },
            {
              key: 'inactive',
              icon: <SettingOutlined />,
              label: showInactive ? 'Hide inactive languages' : 'Show inactive languages',
              onClick: () => setShowInactive((s) => !s),
            },
          ],
        }}
      >
        <Button
          type="text"
          icon={<MoreOutlined />}
          aria-label="More page actions"
          className="text-muted"
        />
      </Dropdown>
    </div>
  );

  return (
    <>
      {ctx}
      <section className="flex flex-col gap-4">
        {/* ─── Header ────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 font-body text-[20px] leading-[1.25] font-semibold text-heading">
              Localization
            </h1>
            <p className="m-0 mt-1 text-[12px] text-subtle">
              {totalLangs} {totalLangs === 1 ? 'language' : 'languages'}
              {' · '}
              {activeLangs} active
              {missingCount > 0 && ` · ${missingCount} missing keys`}
            </p>
          </div>
          {headerActions}
        </header>

        {/* ─── Critical alert (high missing-key count) ───────────── */}
        {missingCount > 30 && selectedLang && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-red-100 bg-red-50/70 px-4 py-2.5 text-[13px]"
          >
            <ExclamationCircleOutlined className="shrink-0 text-[15px] text-red-600" />
            <span className="font-semibold text-red-900">
              {missingCount} keys missing in {selectedLang.toUpperCase()}
            </span>
            <span className="text-red-700/80">
              - copy-from-default to backfill or import a translated bundle.
            </span>
            <button
              type="button"
              onClick={handleCopyFromDefault}
              className="ml-auto text-[12px] font-semibold tracking-wide text-red-700 uppercase transition-colors hover:text-red-900 hover:underline"
            >
              Copy missing →
            </button>
          </div>
        )}

        {/* ─── Stat tiles ────────────────────────────────────────── */}
        <section>
          {langsLoading && langs.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border bg-surface px-5 py-4"
                  style={{
                    borderColor: 'var(--cr-border-subtle,rgba(0,0,0,0.06))',
                  }}
                >
                  <Skeleton active paragraph={{ rows: 2 }} title={{ width: '40%' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Active languages"
                value={String(activeLangs)}
                hint={
                  totalLangs === activeLangs ? 'All in scope' : `${totalLangs - activeLangs} hidden`
                }
              />
              <StatTile
                label="Total keys"
                value={String(totalKeys)}
                hint={selectedLang ? `For ${selectedLang.toUpperCase()}` : 'Pick a language'}
              />
              <StatTile
                label="With metadata"
                value={`${taggedPercent.toFixed(1)}%`}
                hint={taggedKeys > 0 ? `${taggedKeys} keys tagged` : 'Add screen / feature tags'}
                emphasis
              />
              <StatTile
                label="Missing keys"
                value={String(missingCount)}
                hint={missingCount > 0 ? 'vs default language' : 'Catalog complete'}
                tone={missingCount > 0 ? 'danger' : 'neutral'}
              />
            </div>
          )}
        </section>

        {/* ─── Tabs ──────────────────────────────────────────────── */}
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as typeof activeTab)}
          items={[
            {
              key: 'languages',
              label: (
                <span>
                  <GlobalOutlined className="mr-1" />
                  Languages
                </span>
              ),
              children: (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInactive(false)}
                      className={`cr-filter-chip ${!showInactive ? 'cr-filter-chip--active' : ''}`}
                    >
                      Active
                      <span className="cr-filter-chip__count tabular-nums">{activeLangs}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInactive(true)}
                      className={`cr-filter-chip ${showInactive ? 'cr-filter-chip--active' : ''}`}
                    >
                      All
                      <span className="cr-filter-chip__count tabular-nums">{totalLangs}</span>
                    </button>
                  </div>
                  <Table
                    columns={langColumns}
                    dataSource={displayedLangs}
                    rowKey="_id"
                    loading={langsLoading}
                    pagination={false}
                    size="middle"
                    rowClassName={(r) => (!r.isActive ? 'opacity-50' : '')}
                  />
                </div>
              ),
            },
            {
              key: 'translations',
              label: (
                <span>
                  <TranslationOutlined className="mr-1" />
                  Translations
                  {missingCount > 0 && selectedLang && (
                    <span className="ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-100 px-1.5 text-[10.5px] font-semibold text-red-700">
                      {missingCount}
                    </span>
                  )}
                </span>
              ),
              children: (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <MetadataPickerTree
                    langCode={selectedLang || undefined}
                    selection={picker}
                    onSelect={(s) => {
                      setPicker(s);
                      setEditingKey('');
                      clearSelection();
                    }}
                    refreshKey={pickerRefresh}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* locale chips */}
                      {langs
                        .filter((l) => l.isActive)
                        .map((l) => {
                          const active = selectedLang === l.code;
                          return (
                            <button
                              key={l.code}
                              type="button"
                              onClick={() => {
                                setSelectedLang(l.code);
                                setEditingKey('');
                                clearSelection();
                              }}
                              className={`cr-filter-chip ${active ? 'cr-filter-chip--active' : ''}`}
                              aria-pressed={active}
                            >
                              <span className="font-mono uppercase">{l.code}</span>
                            </button>
                          );
                        })}

                      {/* picker reset chip */}
                      {(picker.module || picker.screen || picker.feature) && (
                        <button
                          type="button"
                          onClick={() => setPicker({})}
                          className="cr-filter-chip"
                          aria-label="Clear module/screen/feature filter"
                        >
                          Clear filter
                          <span className="cr-filter-chip__count tabular-nums">✕</span>
                        </button>
                      )}

                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <Select
                          aria-label="Filter by namespace"
                          value={nsFilter || undefined}
                          onChange={(v) => {
                            setNsFilter(v ?? '');
                            setPicker({});
                            setEditingKey('');
                          }}
                          allowClear
                          placeholder="All namespaces"
                          options={namespaces.map((ns) => ({
                            value: ns,
                            label: ns,
                          }))}
                          style={{ width: 180, height: 36 }}
                          disabled={Boolean(picker.module)}
                        />
                        <Select
                          aria-label="Filter by platform"
                          value={platformFilter || undefined}
                          onChange={(v) => {
                            setPlatformFilter(v ?? '');
                            setEditingKey('');
                          }}
                          allowClear
                          placeholder="All platforms"
                          options={PLATFORM_OPTIONS}
                          style={{ width: 180, height: 36 }}
                        />
                        <Input.Search
                          aria-label="Search keys or values"
                          placeholder="Search keys or values…"
                          value={search}
                          allowClear
                          onChange={(e) => setSearch(e.target.value)}
                          style={{ width: 220, height: 36 }}
                        />
                      </div>
                    </div>

                    <Table
                      columns={transColumns}
                      dataSource={filteredTranslations}
                      rowKey="_id"
                      loading={transLoading}
                      size="middle"
                      rowSelection={rowSelection}
                      pagination={{
                        pageSize: 50,
                        showTotal: (t: number) => `${t} strings`,
                        showSizeChanger: false,
                      }}
                      rowClassName={(r) =>
                        editingKey === r._id ? 'bg-[var(--cr-warning-bg)]' : ''
                      }
                      expandable={{
                        expandedRowKeys,
                        showExpandColumn: false,
                        expandedRowRender: (r) => (
                          <TranslationRowMetadataEditor
                            initial={{
                              description: r.description ?? undefined,
                              screen: r.screen ?? undefined,
                              feature: r.feature ?? undefined,
                              componentRef: r.componentRef ?? undefined,
                              tags: r.tags,
                            }}
                            saving={savingMetadataKey === r._id}
                            onSave={(meta) => saveRowMetadata(r, meta)}
                            onCancel={() =>
                              setExpandedRowKeys((keys) => keys.filter((k) => k !== r._id))
                            }
                          />
                        ),
                      }}
                    />

                    <BulkActionsBar
                      selectedCount={selectedRowKeys.length}
                      onClear={clearSelection}
                      onBulkDelete={bulkDelete}
                      onBulkEditMetadata={openBulkMetaModal}
                      loading={bulkLoading || bulkMetaSaving}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'pt',
              label: <span>Professional Tax slabs</span>,
              children: (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="m-0 max-w-3xl text-[13px] text-subtle">
                      Configure platform-level Professional Tax slabs that workspace payroll
                      settings can inherit by default. Gujarat is treated as the default state when
                      no other state is selected.
                    </p>
                    <Space>
                      <Tag color="gold">Gujarat (Default)</Tag>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openCreatePtSlabModal}
                      >
                        Add state
                      </Button>
                    </Space>
                  </div>
                  <Table
                    columns={ptSlabColumns}
                    dataSource={ptSlabs}
                    rowKey="_id"
                    loading={ptSlabsLoading}
                    pagination={false}
                    size="middle"
                  />
                </div>
              ),
            },
          ]}
        />
      </section>

      {/* ─── Add Language Modal ──────────────────────────────────── */}
      <Modal
        title="Add Language"
        open={addLangOpen}
        onCancel={() => {
          setAddLangOpen(false);
          addLangForm.resetFields();
        }}
        onOk={handleAddLanguage}
        okText="Add Language"
        confirmLoading={addLangSaving}
      >
        <Form form={addLangForm} layout="vertical" className="mt-4">
          <Form.Item
            name="code"
            label="Language Code"
            rules={[
              { required: true, message: 'Required' },
              {
                pattern: /^[a-z]{2,5}(-[a-z]{2,5})?$/,
                message:
                  "Lowercase letters, 2-5 chars, optional '-xx' suffix (e.g. en, gu-en, hi-en)",
              },
            ]}
          >
            <Input placeholder="en" maxLength={8} className="font-mono" />
          </Form.Item>
          <Form.Item
            name="name"
            label="Language Name (English)"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="Hinglish" />
          </Form.Item>
          <Form.Item
            name="nativeName"
            label="Native Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="Hinglish" />
          </Form.Item>
          <Form.Item
            name="example"
            label="Example Text"
            extra="Sample text showing how the language looks (e.g., 'Hello, Welcome!' or 'Namaste')"
          >
            <Input placeholder="Hello, Welcome!" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── PT Slab Modal ───────────────────────────────────────── */}
      <Modal
        title={editingPtSlab ? `Edit PT Slabs - ${editingPtSlab.state}` : 'Add PT Slab State'}
        open={ptModalOpen}
        onCancel={closePtModal}
        onOk={handleSavePtSlab}
        okText={editingPtSlab ? 'Save Changes' : 'Create State'}
        confirmLoading={ptSaving}
        width={860}
        destroyOnHidden
      >
        <Form form={ptForm} layout="vertical" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="state"
              label="State Name"
              rules={[{ required: true, message: 'State name is required' }]}
            >
              <Input placeholder="e.g. Gujarat" disabled={Boolean(editingPtSlab)} />
            </Form.Item>
            <Form.Item
              name="frequency"
              label="Frequency"
              rules={[{ required: true, message: 'Frequency is required' }]}
            >
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                options={[
                  { label: 'Monthly', value: 'monthly' },
                  { label: 'Annual', value: 'annual' },
                ]}
              />
            </Form.Item>
          </div>

          <Form.List name="slabs">
            {(fields, { add, remove }) => (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="m-0 text-sm font-medium text-gray-700">Slab Rows</p>
                    <p className="m-0 mt-1 text-xs text-subtle">
                      Define the salary range and PT amount to deduct for each row.
                    </p>
                  </div>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => add(createDefaultPtSlabEntry())}
                  >
                    Add Row
                  </Button>
                </div>

                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
                  <span>Min Salary</span>
                  <span>Max Salary</span>
                  <span>PT Amount</span>
                  <span className="sr-only">Actions</span>
                </div>

                {fields.map((field, index) => (
                  <div
                    key={field.key}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <Form.Item
                      name={[field.name, 'minSalary']}
                      rules={[{ required: true, message: 'Required' }]}
                      className="mb-0"
                    >
                      <InputNumber className="w-full" min={0} placeholder="0" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'maxSalary']}
                      className="mb-0"
                      extra={
                        index === fields.length - 1 ? 'Leave blank for no upper limit' : undefined
                      }
                    >
                      <InputNumber className="w-full" min={0} placeholder="No limit" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'ptAmount']}
                      rules={[{ required: true, message: 'Required' }]}
                      className="mb-0"
                    >
                      <InputNumber className="w-full" min={0} placeholder="0" />
                    </Form.Item>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(field.name)}
                      disabled={fields.length === 1}
                      aria-label="Remove slab row"
                    />
                  </div>
                ))}
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* ─── Import JSON Modal ───────────────────────────────────── */}
      <Modal
        title={`Import Translations - ${selectedLang?.toUpperCase()}`}
        open={importOpen}
        onCancel={() => {
          setImportOpen(false);
          setImportJson('');
          setImportPlatform('');
        }}
        onOk={handleImport}
        okText="Import"
        confirmLoading={importing}
        width={640}
      >
        <p className="mb-2 text-[13px] text-subtle">
          Paste a nested JSON object. Existing keys will be overwritten.
        </p>
        <div className="mb-3">
          <span className="mr-2 text-[13px]">Platform:</span>
          <Select
            value={importPlatform || undefined}
            onChange={(v) => setImportPlatform(v ?? '')}
            className="w-48"
            allowClear
            placeholder="Both (default)"
            options={[
              { value: 'mobile', label: 'Mobile only' },
              { value: 'web', label: 'Web only' },
            ]}
          />
        </div>
        <Input.TextArea
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          rows={14}
          className="font-mono text-[12px]"
          placeholder={'{\n  "common": {\n    "save": "Guardar"\n  }\n}'}
        />
      </Modal>

      {/* ─── Delete Language Modal ───────────────────────────────── */}
      <Modal
        title={deleteModalType === 'hard' ? 'Permanently Delete Language' : 'Delete Language'}
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        onOk={confirmDelete}
        okText={deleteModalType === 'hard' ? 'Delete Permanently' : 'Delete'}
        okButtonProps={{ danger: true }}
        confirmLoading={deleteLoading}
      >
        {deleteModalType === 'hard' ? (
          <div>
            <p>Are you sure you want to permanently delete &quot;{deleteTarget?.name}&quot;?</p>
            <p style={{ color: 'var(--cr-error)', marginTop: 8 }}>
              This will also delete all {deleteTarget?.code.toUpperCase()} translations. This action
              cannot be undone.
            </p>
          </div>
        ) : (
          <p>
            Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will deactivate
            the language.
          </p>
        )}
      </Modal>

      {/* ─── Bulk Metadata Modal ─────────────────────────────────── */}
      <Modal
        title={`Bulk edit metadata - ${selectedRowKeys.length} translation${selectedRowKeys.length === 1 ? '' : 's'}`}
        open={bulkMetaOpen}
        onCancel={() => setBulkMetaOpen(false)}
        footer={null}
        width={640}
        destroyOnHidden
      >
        <p className="mb-3 text-[12px] text-subtle">
          Fields left blank will <strong>NOT</strong> overwrite existing values (only filled fields
          apply).
        </p>
        <TranslationRowMetadataEditor
          initial={bulkMetaInitial}
          saving={bulkMetaSaving}
          onSave={(meta) => {
            const cleaned: TranslationMetadata = {};
            if (meta.description) cleaned.description = meta.description;
            if (meta.screen) cleaned.screen = meta.screen;
            if (meta.feature) cleaned.feature = meta.feature;
            if (meta.componentRef) cleaned.componentRef = meta.componentRef;
            if (meta.tags && meta.tags.length > 0) cleaned.tags = meta.tags;
            setBulkMetaInitial(cleaned);
            applyBulkMetadata(cleaned);
          }}
          onCancel={() => setBulkMetaOpen(false)}
        />
      </Modal>
    </>
  );
}
