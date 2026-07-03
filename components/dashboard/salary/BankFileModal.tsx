'use client';

import { useState } from 'react';
import { Modal, Form, Select, Radio, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { BANK_TEMPLATES } from '@/lib/export/bankTemplates';
import { coerceTxnDate } from '@/lib/exportFields/bankFileValidators';
import type { BankTemplateId, BankFileMeta } from '@/types';
import { BankFilePreviewModal } from './BankFilePreviewModal';

interface BankFileModalProps {
  open: boolean;
  onClose: () => void;
  wsId: string;
  defaultMonth: number;
  defaultYear: number;
}

interface FormValues {
  templateId: BankTemplateId;
  format: 'xlsx' | 'csv' | 'both';
  txnDate: dayjs.Dayjs;
  month: dayjs.Dayjs;
}

export function BankFileModal({ open, onClose, wsId, defaultMonth, defaultYear }: BankFileModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [previewMeta, setPreviewMeta] = useState<BankFileMeta | null>(null);

  const handleContinue = async () => {
    const values = await form.validateFields();
    const meta: BankFileMeta = {
      templateId: values.templateId,
      format: values.format,
      txnDate: coerceTxnDate(values.txnDate.format('DD-MM-YYYY')),
      month: values.month.month() + 1,
      year: values.month.year(),
    };
    setPreviewMeta(meta);
  };

  const handlePreviewClose = () => {
    setPreviewMeta(null);
    onClose();
  };

  return (
    <>
      <Modal
        open={open && !previewMeta}
        title="Download Bank Transfer File"
        onCancel={onClose}
        onOk={handleContinue}
        okText="Continue"
        width={480}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            templateId: "generic" as BankTemplateId,
            format: "xlsx",
            txnDate: dayjs(),
            month: dayjs(new Date(defaultYear, defaultMonth - 1, 1)),
          }}
        >
          <Form.Item
            label="Bank Template"
            name="templateId"
            rules={[{ required: true }]}
          >
            <Select
              options={BANK_TEMPLATES.map((t) => ({
                value: t.id,
                label: t.name,
              }))}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item
            label="File Format"
            name="format"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio value="xlsx">XLSX</Radio>
              <Radio value="csv">CSV</Radio>
              <Radio value="both">Both</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            label="Salary Month"
            name="month"
            rules={[{ required: true }]}
          >
            <DatePicker
              picker="month"
              style={{ width: "100%" }}
              format="MMMM YYYY"
            />
          </Form.Item>
          <Form.Item
            label="Transaction Date"
            name="txnDate"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
          </Form.Item>
        </Form>
      </Modal>

      {previewMeta && (
        <BankFilePreviewModal
          open
          onClose={handlePreviewClose}
          wsId={wsId}
          meta={previewMeta}
        />
      )}
    </>
  );
}
