'use client';

import { useState, useEffect, useCallback, startTransition } from 'react';
import { Input, Button, Tag, Alert, Spin } from 'antd';
import { TagOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { validateCoupons, autoApplyCoupon } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import type { CouponValidationResult, BillingCycle } from '@/types';

interface Props {
  planId: string;
  billingCycle: BillingCycle;
  /** Pre-existing codes to seed the chip list (e.g. from URL ?promo=). */
  initialCodes?: string[];
  /** Called any time the validated coupon set changes. */
  onChange?: (result: CouponValidationResult | null, codes: string[]) => void;
  /** When set, attempts to fetch an auto-apply coupon for this campaign on mount. */
  autoApplyCampaignKey?: string;
}

const COUPON_CODE_RE = /^[A-Z0-9_-]{3,32}$/;
const MAX_CODES = 5;

export function CouponInput({
  planId,
  billingCycle,
  initialCodes = [],
  onChange,
  autoApplyCampaignKey,
}: Props) {
  const [codes, setCodes] = useState<string[]>(initialCodes);
  const [draft, setDraft] = useState('');
  const [validation, setValidation] = useState<CouponValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-validate any time codes change.
  const revalidate = useCallback(
    async (nextCodes: string[]) => {
      if (nextCodes.length === 0) {
        startTransition(() => {
          setValidation(null);
        });
        onChange?.(null, []);
        return;
      }
      startTransition(() => {
        setValidating(true);
        setError(null);
      });
      try {
        const result = await validateCoupons({
          planId,
          billingCycle,
          codes: nextCodes,
        });
        startTransition(() => {
          setValidation(result);
        });
        onChange?.(result, nextCodes);
        if (result.warnings && result.warnings.length > 0) {
          startTransition(() => {
            setError(result.warnings!.join('. '));
          });
        }
      } catch (e) {
        const msg = parseApiError(e);
        startTransition(() => {
          setError(msg);
          setValidation(null);
        });
        onChange?.(null, nextCodes);
      } finally {
        setValidating(false);
      }
    },
    [planId, billingCycle, onChange],
  );

  // Auto-apply on mount when campaign key supplied.
  useEffect(() => {
    if (!autoApplyCampaignKey || codes.length > 0) return;
    let cancelled = false;
    autoApplyCoupon({ planId, billingCycle, campaignKey: autoApplyCampaignKey })
      .then((result) => {
        if (cancelled) return;
        const auto = result?.resolved?.[0];
        if (auto) {
          setCodes([auto.code]);
          setValidation(result);
          onChange?.(result, [auto.code]);
        }
      })
      .catch(() => {
        // Silent - auto-apply is best-effort.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoApplyCampaignKey, planId, billingCycle]);

  // Re-validate whenever plan / cycle changes (price changes invalidate quote).
  useEffect(() => {
    revalidate(codes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, billingCycle]);

  const addCode = () => {
    const code = draft.trim().toUpperCase();
    if (!code) return;
    if (!COUPON_CODE_RE.test(code)) {
      setError('Invalid format. 3–32 chars, A–Z 0–9 _ -');
      return;
    }
    if (codes.includes(code)) {
      setError('Already applied');
      return;
    }
    if (codes.length >= MAX_CODES) {
      setError(`Max ${MAX_CODES} coupons per checkout`);
      return;
    }
    const next = [...codes, code];
    setCodes(next);
    setDraft('');
    revalidate(next);
  };

  const removeCode = (code: string) => {
    const next = codes.filter((c) => c !== code);
    setCodes(next);
    revalidate(next);
  };

  const totalDiscount = validation?.totalDiscountPaise ?? 0;
  const ok = (validation?.resolved?.length ?? 0) > 0 && totalDiscount > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          prefix={<TagOutlined className="text-muted" />}
          placeholder="Enter coupon code"
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onPressEnter={addCode}
          maxLength={32}
          disabled={codes.length >= MAX_CODES}
          allowClear
        />
        <Button onClick={addCode} disabled={!draft.trim() || codes.length >= MAX_CODES}>
          Apply
        </Button>
      </div>

      {codes.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {codes.map((code) => {
            const resolved = validation?.resolved?.find((r) => r.code === code);
            const discount = resolved?.discountPaise ?? 0;
            return (
              <Tag
                key={code}
                closable
                onClose={() => removeCode(code)}
                color={resolved && ok ? 'green' : 'red'}
                icon={resolved && ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              >
                {code}
                {resolved && discount > 0 && (
                  <span className="ml-1 font-normal">−{Money.fromPaise(discount).format()}</span>
                )}
              </Tag>
            );
          })}
        </div>
      )}

      {validating && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Spin size="small" /> Validating…
        </div>
      )}

      {!validating && error && <Alert type="error" showIcon title={error} className="mt-1" />}

      {!validating && !error && ok && totalDiscount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <span className="text-sm font-medium text-green-700">Discount applied</span>
          <span className="text-base font-bold text-green-700">
            −{Money.fromPaise(totalDiscount).format()}
          </span>
        </div>
      )}
    </div>
  );
}
