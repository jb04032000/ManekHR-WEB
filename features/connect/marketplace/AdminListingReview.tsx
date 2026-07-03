'use client';

/**
 * AdminListingReview - the platform-admin marketplace moderation console (M1.3).
 *
 * Internal admin tool: English-only copy + AntD design language, consistent
 * with app/admin/*. One section: the pending-listing review queue. Each listing
 * shows its content (title, trade terms, location, images, seller) with
 * Approve / Reject (reason required) actions. Approving or rejecting removes the
 * card optimistically.
 *
 * Auth: gated by AdminLayout (client isAdmin redirect) + the backend
 * IsAdminGuard. This component assumes an admin viewer.
 */

import { useCallback, useState } from 'react';
import { Button, Card, Empty, Image, Input, Tag, message } from 'antd';
import { approveListing, rejectListing } from './marketplace-admin.actions';
import type { AdminListing } from './marketplace.types';

interface AdminListingReviewProps {
  listings: AdminListing[];
}

function formatPrice(l: AdminListing): string {
  if (l.priceType === 'negotiable') return 'Negotiable';
  const unit = l.unit ? ` / ${l.unit.replace('per-', '')}` : '';
  if (l.priceType === 'range' && l.priceMin != null && l.priceMax != null) {
    return `Rs ${l.priceMin} - ${l.priceMax}${unit}`;
  }
  if (l.priceMin != null) return `Rs ${l.priceMin}${unit}`;
  return 'Price on request';
}

function formatLocation(l: AdminListing): string {
  const parts = [l.location?.district, l.location?.city, l.location?.state].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Location not set';
}

export default function AdminListingReview({ listings }: AdminListingReviewProps) {
  const [queue, setQueue] = useState<AdminListing[]>(listings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [msgApi, ctx] = message.useMessage();

  const removeFromQueue = useCallback((id: string) => {
    setQueue((q) => q.filter((l) => l._id !== id));
  }, []);

  const onApprove = useCallback(
    async (id: string) => {
      setBusyId(id);
      const res = await approveListing(id);
      setBusyId(null);
      if (res.ok) {
        msgApi.success('Listing approved. It is now live.');
        removeFromQueue(id);
      } else {
        msgApi.error(res.error);
      }
    },
    [msgApi, removeFromQueue],
  );

  const onConfirmReject = useCallback(
    async (id: string) => {
      const trimmed = reason.trim();
      if (trimmed === '') return;
      setBusyId(id);
      const res = await rejectListing(id, trimmed);
      setBusyId(null);
      if (res.ok) {
        msgApi.success('Listing rejected. The seller can see the reason.');
        setRejectingId(null);
        setReason('');
        removeFromQueue(id);
      } else {
        msgApi.error(res.error);
      }
    },
    [msgApi, reason, removeFromQueue],
  );

  return (
    <>
      {ctx}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="m-0 mb-1 font-display text-2xl font-extrabold text-heading">
            Marketplace Review
          </h2>
          <p className="m-0 text-sm text-muted">
            Approve or reject seller listings before they go live in the marketplace.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-lg font-semibold text-heading">
            Pending review{' '}
            {queue.length > 0 && <span className="text-muted">({queue.length})</span>}
          </h3>

          {queue.length === 0 ? (
            <Card className="rounded-2xl">
              <Empty description="No listings pending review" />
            </Card>
          ) : (
            queue.map((l) => {
              const isBusy = busyId === l._id;
              const isRejecting = rejectingId === l._id;
              return (
                <Card key={l._id} className="rounded-2xl">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Tag color="blue">{l.category}</Tag>
                    <Tag>{formatPrice(l)}</Tag>
                    {l.moq != null && <Tag>MOQ {l.moq}</Tag>}
                    {l.leadTimeDays != null && <Tag>{l.leadTimeDays}d lead</Tag>}
                  </div>

                  <div className="font-semibold text-heading">{l.title}</div>
                  {l.description && (
                    <p className="m-0 mt-1 line-clamp-3 text-sm text-muted">{l.description}</p>
                  )}
                  <div className="mt-1 text-xs text-muted">
                    {formatLocation(l)} &middot; Seller {l.ownerUserId}
                  </div>

                  {l.images && l.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Image.PreviewGroup>
                        {l.images.slice(0, 6).map((src) => (
                          <Image
                            key={src}
                            src={src}
                            alt={l.title}
                            width={72}
                            height={72}
                            className="rounded-lg object-cover"
                          />
                        ))}
                      </Image.PreviewGroup>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2">
                    {isRejecting ? (
                      <>
                        <label
                          htmlFor={`reject-reason-${l._id}`}
                          className="text-sm font-semibold text-heading"
                        >
                          Rejection reason (shown to the seller)
                        </label>
                        <Input.TextArea
                          id={`reject-reason-${l._id}`}
                          rows={2}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g. Images do not match the listing category."
                        />
                        <div className="flex gap-2">
                          <Button
                            danger
                            type="primary"
                            loading={isBusy}
                            disabled={reason.trim() === ''}
                            onClick={() => void onConfirmReject(l._id)}
                          >
                            Confirm reject
                          </Button>
                          <Button
                            onClick={() => {
                              setRejectingId(null);
                              setReason('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          type="primary"
                          loading={isBusy}
                          onClick={() => void onApprove(l._id)}
                        >
                          Approve
                        </Button>
                        <Button
                          danger
                          disabled={isBusy}
                          onClick={() => {
                            setRejectingId(l._id);
                            setReason('');
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </section>
      </div>
    </>
  );
}
