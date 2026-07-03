'use client';
/**
 * Shared debounced item search-select. Calls the finance items endpoint
 * (?q=...) and returns a real item _id, so callers satisfy the backend
 * @IsMongoId() contract instead of accepting a free-typed string.
 *
 * Keeps the last selected option "sticky" so its name keeps showing after the
 * search results change (otherwise the box would fall back to the raw id).
 */
import { useEffect, useState, startTransition } from 'react';
import { Select } from 'antd';
import { useDebounce } from '@/hooks/useDebounce';
import http, { unwrap } from '@/lib/api/client';

export interface ItemSuggestion {
  _id: string;
  name: string;
  hsnSacCode?: string;
  unit?: string;
  defaultRate?: number;
  gstRate?: number;
}

export interface ItemAutoCompleteProps {
  value: string;
  onChange: (val: string, item?: ItemSuggestion) => void;
  wsId: string;
  firmId: string;
  disabled?: boolean;
  placeholder?: string;
}

export function ItemAutoComplete({
  value,
  onChange,
  wsId,
  firmId,
  disabled,
  placeholder = 'Search item…',
}: ItemAutoCompleteProps) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<ItemSuggestion[]>([]);
  const [selected, setSelected] = useState<ItemSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      startTransition(() => {
        setOptions([]);
      });
      return;
    }
    startTransition(() => {
      setLoading(true);
    });
    http
      .get(`workspaces/${wsId}/finance/firms/${firmId}/items`, {
        params: { q: debouncedSearch, limit: 10 },
      })
      .then((res) => {
        const data = unwrap<ItemSuggestion[] | { data: ItemSuggestion[] }>(res);
        setOptions(Array.isArray(data) ? data : ((data as { data: ItemSuggestion[] }).data ?? []));
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [debouncedSearch, wsId, firmId]);

  // Merge the sticky selected option in so its label survives an options reset.
  const mergedOptions = [
    ...(selected && !options.some((o) => o._id === selected._id) ? [selected] : []),
    ...options,
  ].map((o) => ({ value: o._id, label: o.name }));

  return (
    <Select
      showSearch
      filterOption={false}
      value={value || undefined}
      placeholder={placeholder}
      disabled={disabled}
      style={{ width: '100%', minWidth: 160 }}
      onSearch={setSearch}
      loading={loading}
      onChange={(val) => {
        const found = options.find((o) => o._id === val) ?? null;
        if (found) setSelected(found);
        onChange(val, found ?? undefined);
      }}
      options={mergedOptions}
    />
  );
}
