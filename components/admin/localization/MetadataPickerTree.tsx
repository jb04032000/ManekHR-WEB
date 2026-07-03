'use client';
import { useEffect, useMemo, useState, startTransition } from 'react';
import { Spin } from 'antd';
import { getTranslationsIndex } from '@/lib/actions/localization.actions';
import type { TranslationsIndex } from '@/lib/actions/localization.actions';

type PickerSelection = {
  module?: string;
  screen?: string;
  feature?: string;
};

type Props = {
  langCode?: string;
  selection: PickerSelection;
  onSelect: (s: PickerSelection) => void;
  refreshKey?: number;
};

export function MetadataPickerTree({ langCode, selection, onSelect, refreshKey = 0 }: Props) {
  const [data, setData] = useState<TranslationsIndex | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
    });
    void (async () => {
      try {
        const d = await getTranslationsIndex({ langCode });
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [langCode, refreshKey]);

  const grouped = useMemo(() => {
    const tree = new Map<string, Map<string | null, Map<string | null, number>>>();
    for (const t of data?.tuples ?? []) {
      if (!tree.has(t.namespace)) tree.set(t.namespace, new Map());
      const screens = tree.get(t.namespace)!;
      if (!screens.has(t.screen)) screens.set(t.screen, new Map());
      const features = screens.get(t.screen)!;
      features.set(t.feature, (features.get(t.feature) ?? 0) + t.count);
    }
    return tree;
  }, [data]);

  const isActive = (m?: string, s?: string | null, f?: string | null) =>
    selection.module === m &&
    (selection.screen ?? null) === (s ?? null) &&
    (selection.feature ?? null) === (f ?? null);

  return (
    <aside
      className="flex w-full flex-col gap-2 rounded-xl border bg-surface p-3 lg:w-64"
      style={{ borderColor: 'var(--cr-border-subtle, rgba(0,0,0,0.06))' }}
      aria-label="Module / screen / feature picker"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[11px] font-semibold tracking-wide text-muted uppercase">Modules</p>
        {data && (
          <span className="text-[11px] text-subtle tabular-nums">{data.totalKeys} keys</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onSelect({})}
        className={`rounded-md px-2 py-1.5 text-left text-[12px] transition-colors ${
          !selection.module
            ? 'bg-[var(--cr-pill-brand-bg)] font-semibold text-[var(--cr-pill-brand-fg)]'
            : 'hover:bg-[var(--cr-surface-2,var(--cr-bg))]'
        }`}
      >
        All keys
        {data && <span className="ml-2 text-[11px] tabular-nums opacity-80">{data.totalKeys}</span>}
      </button>

      {loading && !data && (
        <div className="flex items-center justify-center py-4">
          <Spin size="small" />
        </div>
      )}

      <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
        {Array.from(grouped.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([ns, screens]) => {
            const nsTotal = Array.from(screens.values()).reduce(
              (sum, fmap) => sum + Array.from(fmap.values()).reduce((s, n) => s + n, 0),
              0,
            );
            const expanded = selection.module === ns;
            return (
              <div key={ns} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => onSelect({ module: ns })}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] transition-colors ${
                    isActive(ns, null, null)
                      ? 'bg-[var(--cr-pill-brand-bg)] font-semibold text-[var(--cr-pill-brand-fg)]'
                      : 'hover:bg-[var(--cr-surface-2,var(--cr-bg))]'
                  }`}
                >
                  <span className="truncate font-mono">{ns}</span>
                  <span className="ml-2 text-[11px] tabular-nums opacity-80">{nsTotal}</span>
                </button>
                {expanded &&
                  Array.from(screens.entries()).map(([screen, features]) => (
                    <div key={String(screen)} className="ml-3 flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => onSelect({ module: ns, screen: screen ?? undefined })}
                        className={`flex items-center justify-between rounded-md px-2 py-1 text-left text-[11.5px] transition-colors ${
                          isActive(ns, screen, null) && selection.screen
                            ? 'bg-[var(--cr-pill-brand-bg)] font-semibold text-[var(--cr-pill-brand-fg)]'
                            : 'text-subtle hover:bg-[var(--cr-surface-2,var(--cr-bg))]'
                        }`}
                      >
                        <span className="truncate">{screen ?? '(no screen)'}</span>
                        <span className="ml-2 tabular-nums opacity-70">
                          {Array.from(features.values()).reduce((s, n) => s + n, 0)}
                        </span>
                      </button>
                      {selection.screen === screen &&
                        Array.from(features.entries())
                          .filter(([f]) => f !== null)
                          .map(([feature, count]) => (
                            <button
                              key={String(feature)}
                              type="button"
                              onClick={() =>
                                onSelect({
                                  module: ns,
                                  screen: screen ?? undefined,
                                  feature: feature ?? undefined,
                                })
                              }
                              className={`ml-4 flex items-center justify-between rounded-md px-2 py-0.5 text-left text-[11px] transition-colors ${
                                isActive(ns, screen, feature)
                                  ? 'bg-[var(--cr-pill-brand-bg)] font-semibold text-[var(--cr-pill-brand-fg)]'
                                  : 'text-subtle hover:bg-[var(--cr-surface-2,var(--cr-bg))]'
                              }`}
                            >
                              <span className="truncate">{feature}</span>
                              <span className="ml-2 tabular-nums opacity-70">{count}</span>
                            </button>
                          ))}
                    </div>
                  ))}
              </div>
            );
          })}
        {data && data.tuples.length === 0 && !loading && (
          <p className="m-0 px-2 py-2 text-[11px] text-subtle">
            No metadata yet. Add `screen` / `feature` to translations.
          </p>
        )}
      </div>

      {data && (
        <p className="m-0 mt-1 text-[11px] text-subtle">
          {data.withMetadataPercent.toFixed(1)}% tagged
        </p>
      )}
    </aside>
  );
}
