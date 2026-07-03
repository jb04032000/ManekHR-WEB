'use client';

import { Form, DatePicker, InputNumber, Alert } from 'antd';

export function MachineMaintenanceFields() {
  return (
    <>
      <Alert
        type="info"
        showIcon
        title="Service Reminders"
        description="Set the maintenance interval to receive service reminder notifications when maintenance is approaching or overdue. Leave empty to disable service reminders for this machine."
        style={{ marginBottom: 16 }}
      />
      <Form.Item name="lastMaintenanceDate" label="Last Maintenance Date">
        <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item
        name="maintenanceIntervalDays"
        label="Maintenance Interval (days)"
        rules={[{ type: 'number', min: 1, max: 365, message: 'Interval must be 1–365 days' }]}
        extra="Reminders fire when next maintenance approaches (per ReminderRule daysOffset). Leave empty to disable service reminders."
      >
        <InputNumber min={1} max={365} placeholder="e.g. 90" style={{ width: '100%' }} />
      </Form.Item>
    </>
  );
}
