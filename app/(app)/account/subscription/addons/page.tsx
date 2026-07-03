'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { Card, Row, Col, Button, Tag, Modal, Spin, Empty, Alert, message } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import {
  getAvailableAddOns,
  getMyAddOns,
  previewAddOnPurchase,
  purchaseAddOn,
} from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { AddOnDefinition, PurchasedAddOn } from '@/types';
import {
  PaymentsComingSoonAlert,
  usePaymentsGate,
} from '@/components/subscription/PaymentsComingSoon';

export default function AddOnsPage() {
  const [available, setAvailable] = useState<AddOnDefinition[]>([]);
  const [purchased, setPurchased] = useState<PurchasedAddOn[]>([]);
  const [loading, setLoading] = useState(true);

  const [previewing, setPreviewing] = useState<AddOnDefinition | null>(null);
  const [previewData, setPreviewData] = useState<{
    proratedPrice?: number;
    fullPrice?: number;
    daysUntilRenewal?: number;
    warnings?: string[];
  } | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  const refresh = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const [a, p] = await Promise.all([getAvailableAddOns(), getMyAddOns()]);
      startTransition(() => {
        setAvailable(Array.isArray(a) ? a : []);
        setPurchased(Array.isArray(p) ? p : []);
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openPreview = async (addOn: AddOnDefinition) => {
    setPreviewing(addOn);
    setPreviewData(null);
    let qty = 1;
    const existing = purchased.find(
      (p) =>
        (typeof p.addOnDefinitionId === 'object'
          ? p.addOnDefinitionId._id
          : p.addOnDefinitionId) === addOn._id,
    );
    if (existing && addOn.stackable && addOn.maxStack > 0) {
      qty = Math.max(1, Math.min(addOn.maxStack - (existing.quantity ?? 1), 1));
    }
    setSelectedQuantity(qty);
    try {
      const preview = await previewAddOnPurchase({
        addOnDefinitionId: addOn._id,
        quantity: qty,
      });
      setPreviewData(preview);
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  // Coming-soon gate for add-on purchase (online payments not live yet -
  // env.paymentsEnabled defaults off). Browsing + price preview stay live.
  const { guard } = usePaymentsGate();

  const handlePurchase = () => {
    if (!previewing) return;
    guard(async () => {
      setPurchasing(true);
      try {
        await purchaseAddOn({
          addOnDefinitionId: previewing._id,
          quantity: selectedQuantity,
          billingCycle: 'monthly',
        });
        msgApi.success('Add-on activated.');
        setPreviewing(null);
        setPreviewData(null);
        refresh();
      } catch (e) {
        msgApi.error(parseApiError(e));
      } finally {
        setPurchasing(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-15">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      {ctx}

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="m-0 mb-1 font-display text-xl font-bold text-heading">Add-Ons</h2>
          <p className="m-0 text-sm text-muted">
            Boost your plan with extra capacity, features, or modules.
          </p>
        </div>

        <PaymentsComingSoonAlert />

        {available.length === 0 ? (
          <Card className="rounded-2xl">
            <Empty
              image={<AppstoreOutlined className="text-5xl text-muted" />}
              description="No add-ons available for your plan"
            />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {available.map((addOn) => {
              const owned = purchased.find(
                (p) =>
                  (typeof p.addOnDefinitionId === 'object'
                    ? p.addOnDefinitionId._id
                    : p.addOnDefinitionId) === addOn._id,
              );
              const isOwned = !!owned;
              return (
                <Col xs={24} sm={12} lg={8} key={addOn._id}>
                  <Card
                    className={`flex h-full flex-col rounded-2xl ${isOwned ? 'border-green-500' : ''}`}
                    extra={isOwned ? <Tag color="green">Active</Tag> : null}
                    // Body as a full-height flex column so the CTA pins to the
                    // card bottom (mt-auto) and every card's button aligns on one
                    // baseline regardless of description / price-block height.
                    styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
                  >
                    <h3 className="mb-1 text-lg font-semibold">{addOn.name}</h3>
                    <p className="mb-4 text-sm text-muted">{addOn.description}</p>

                    {isOwned ? (
                      <div className="mb-4 rounded-lg bg-green-50 p-3">
                        <p className="mb-1 text-sm font-medium text-green-700">✓ Add-on active</p>
                        <p className="text-xs text-green-700">
                          Included until your subscription expires.
                        </p>
                      </div>
                    ) : (
                      <div className="mb-4">
                        <span className="text-2xl font-bold">₹{addOn.monthlyPrice}</span>
                        <span className="text-sm text-muted">/month</span>
                        <p className="mt-1 mb-0 text-xs text-muted">
                          Prorated to your remaining billing days at checkout.
                        </p>
                      </div>
                    )}

                    {/* mt-auto pins the CTA to the card bottom so buttons align
                        across the row even when descriptions differ in height. */}
                    {(!isOwned || addOn.stackable) && (
                      <div className="mt-auto pt-1">
                        <Button type="primary" block onClick={() => openPreview(addOn)}>
                          {isOwned && addOn.stackable ? 'Buy More' : 'Get Add-On'}
                        </Button>
                      </div>
                    )}
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </div>

      <Modal
        open={!!previewing}
        onCancel={() => {
          setPreviewing(null);
          setPreviewData(null);
        }}
        title={previewing ? `Get ${previewing.name}` : ''}
        footer={null}
        width={500}
      >
        {previewing && (
          <div>
            <p className="mb-4 text-muted">{previewing.description}</p>

            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="mb-2 font-medium text-blue-900">Price for remaining days</p>
              {previewData?.proratedPrice !== undefined && previewData.proratedPrice > 0 ? (
                <>
                  <p className="mb-1 text-3xl font-bold text-blue-700">
                    ₹{previewData.proratedPrice}
                  </p>
                  <p className="m-0 text-sm text-blue-700">
                    For {previewData.daysUntilRenewal} remaining days of your billing cycle
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-1 text-3xl font-bold text-blue-700">
                    ₹{previewData?.fullPrice ?? previewing.monthlyPrice ?? 0}
                  </p>
                  <p className="m-0 text-sm text-blue-700">Full monthly price</p>
                </>
              )}
            </div>

            {previewData?.warnings && previewData.warnings.length > 0 && (
              <Alert type="warning" title={previewData.warnings[0]} className="mb-4" />
            )}

            <p className="mb-4 text-xs text-muted">
              Once purchased, this add-on remains active until your subscription expires.
            </p>

            <Button type="primary" block size="large" loading={purchasing} onClick={handlePurchase}>
              Purchase Add-On
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
