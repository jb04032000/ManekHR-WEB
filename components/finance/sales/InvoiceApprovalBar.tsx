'use client';
/**
 * InvoiceApprovalBar - maker-checker approval actions on a pending_approval Tax Invoice.
 *
 * Shown when invoice.state === 'pending_approval' (firm.makerCheckerEnabled.sale_invoice routes
 * a posted draft here instead of straight to posted). Approve posts the invoice; Reject sends it
 * back to draft with a reason.
 *
 * Cross-module links:
 *   - financeSalesApi.invoices.approve -> BE POST /invoices/:id/approve (assigns voucher no +
 *     posts the ledger). Maker-checker: the BE rejects self-approval (submitter != approver, 403).
 *   - financeSalesApi.invoices.reject  -> BE POST /invoices/:id/reject (state back to draft).
 *
 * Watch: backend enforces both the permission (finance.invoice.edit) and the maker-checker rule,
 * so a 403 is surfaced as a message rather than hidden here.
 */
import { useState } from 'react';
import { Alert, Form, Input, Modal, Space, message } from 'antd';
import { useTranslations } from 'next-intl';
import DsButton from '@/components/ui/DsButton';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import type { SaleInvoice } from '@/types';

export default function InvoiceApprovalBar({
  workspaceId,
  firmId,
  invoice,
  onRefresh,
}: {
  workspaceId: string;
  firmId: string;
  invoice: SaleInvoice;
  onRefresh: () => void;
}) {
  const t = useTranslations('finance.approval');
  const [approving, setApproving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [form] = Form.useForm<{ reason: string }>();

  async function handleApprove() {
    setApproving(true);
    try {
      await financeSalesApi.invoices.approve(workspaceId, firmId, invoice._id);
      message.success(t('approved'));
      onRefresh();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('approveFailed'));
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    let reason: string;
    try {
      reason = (await form.validateFields()).reason;
    } catch {
      return;
    }
    setRejecting(true);
    try {
      await financeSalesApi.invoices.reject(workspaceId, firmId, invoice._id, reason.trim());
      message.success(t('rejected'));
      setRejectOpen(false);
      form.resetFields();
      onRefresh();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('rejectFailed'));
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div style={{ padding: '16px 24px 0' }}>
      <Alert
        type="warning"
        showIcon
        title={t('awaitingTitle')}
        description={t('awaitingDesc')}
        action={
          <Space>
            <DsButton dsVariant="secondary" dsSize="sm" onClick={() => setRejectOpen(true)}>
              {t('reject')}
            </DsButton>
            <DsButton dsVariant="primary" dsSize="sm" loading={approving} onClick={handleApprove}>
              {t('approve')}
            </DsButton>
          </Space>
        }
      />

      <Modal
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={handleReject}
        okText={t('reject')}
        okButtonProps={{ loading: rejecting, danger: true }}
        title={t('rejectModalTitle')}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="reason"
            label={t('rejectReason')}
            rules={[{ required: true, message: t('rejectReasonRequired') }]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
