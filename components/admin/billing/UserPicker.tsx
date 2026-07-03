'use client';

import { useEffect, useMemo, useState } from 'react';
import { Select, Spin } from 'antd';
import { getAdminUsers } from '@/lib/actions';
import type { User } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';

interface Props {
  value?: string;
  onChange?: (id: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Async user search picker - debounced server-side search via
 * `getAdminUsers({ search })`. Renders user.name (email).
 */
export function UserPicker({ value, onChange, placeholder = 'Search user', disabled }: Props) {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAdminUsers({ search: debounced || undefined, limit: 25 })
      .then((res) => {
        if (cancelled) return;
        const list = (res?.data ?? []) as User[];
        setUsers(list);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const options = useMemo(
    () =>
      users.map((u) => ({
        value: u._id,
        label: u.email ? `${u.name} (${u.email})` : u.name,
      })),
    [users],
  );

  return (
    <Select
      value={value}
      onChange={onChange}
      onSearch={setSearch}
      placeholder={placeholder}
      disabled={disabled}
      showSearch
      filterOption={false}
      notFoundContent={loading ? <Spin size="small" /> : 'No users found'}
      style={{ width: '100%' }}
      options={options}
    />
  );
}
