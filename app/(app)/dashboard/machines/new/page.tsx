'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Form,
  Input,
  InputNumber,
  DatePicker,
  Radio,
  Row,
  Col,
  Collapse,
  message,
  Skeleton,
  Alert,
} from 'antd';
import { ToolOutlined, DownOutlined } from '@ant-design/icons';
import { DsButton, DsCard, DsSelect, DsOption, DsPageHeader } from '@/components/ui';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { createMachine, listLocations, peekNextMachineCode } from '@/lib/actions';
import type { CreateMachinePayload, Location as OperationalLocation, MachineStatus } from '@/types';
import { parseApiError } from '@/lib/utils';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import dayjs from 'dayjs';

const STATUS_OPTIONS: { value: MachineStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'idle', label: 'Idle' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

const TYPE_OPTIONS = [
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'printing', label: 'Printing' },
  { value: 'other', label: 'Other' },
];

function bumpMachineName(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  const match = name.match(/^(.*?)(\d+)(\s*)$/);
  if (!match) return undefined;
  const [, prefix, digits, trailing] = match;
  const next = String(Number(digits) + 1).padStart(digits.length, '0');
  return `${prefix}${next}${trailing}`;
}

export default function NewMachinePage() {
  const { entitlements, isHydrated } = useSubscriptionStore();
  const machinesModuleAccess = entitlements?.moduleAccess?.find((m) => m.module === 'machines');
  const canCreate =
    (machinesModuleAccess?.enabled ?? false) &&
    machinesModuleAccess?.subFeatures?.find((sf) => sf.key === 'machines_basic')?.access !==
      'locked';

  if (!isHydrated) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (!canCreate) return <ModuleLockedPage module="machines" />;
  return <NewMachineForm />;
}

function NewMachineForm() {
  const router = useRouter();
  const { currentWorkspaceId } = useWorkspaceStore();
  const [form] = Form.useForm();
  const [msgApi, ctx] = message.useMessage();
  const [locations, setLocations] = useState<OperationalLocation[]>([]);
  const [nextCode, setNextCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [lastSavedName, setLastSavedName] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    (async () => {
      try {
        const [locs, code] = await Promise.all([
          listLocations(currentWorkspaceId),
          peekNextMachineCode(currentWorkspaceId).catch(() => null),
        ]);
        setLocations(locs);
        setNextCode(code?.nextCode ?? null);
        form.setFieldsValue({
          type: 'embroidery',
          status: 'active',
          attributes: { needles: 9, heads: 12, hoopSizeMm: 360, maxRpm: 1000 },
          locationId: locs[0]?._id ?? locs[0]?.id,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [currentWorkspaceId, form]);

  const save = async (action: 'redirect' | 'another' | 'done') => {
    if (!currentWorkspaceId) return;
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload: CreateMachinePayload = {
        locationId: vals.locationId,
        name: vals.name,
        machineCode: vals.machineCode || undefined,
        type: vals.type,
        model: vals.model || undefined,
        manufacturer: vals.manufacturer || undefined,
        serialNumber: vals.serialNumber || undefined,
        status: vals.status,
        floorTag: vals.floorTag || undefined,
        attributes: {
          needles: vals.attributes?.needles,
          heads: vals.attributes?.heads,
          hoopSizeMm: vals.attributes?.hoopSizeMm,
          maxRpm: vals.attributes?.maxRpm,
          spec: vals.attributes?.spec,
        },
        installedOn: vals.installedOn ? dayjs(vals.installedOn).format('YYYY-MM-DD') : undefined,
        notes: vals.notes || undefined,
      };
      const created = await createMachine(currentWorkspaceId, payload);
      const createdId = created.id ?? created._id;
      msgApi.success(`Machine ${created.machineCode ?? vals.name} added`);
      setAddedCount((c) => c + 1);
      setLastSavedName(vals.name ?? null);

      if (action === 'redirect' && createdId) {
        router.push(`/dashboard/machines/${createdId}`);
        return;
      }
      if (action === 'done') {
        router.push('/dashboard/machines');
        return;
      }

      const nextName = bumpMachineName(vals.name);
      const refreshedCode = await peekNextMachineCode(currentWorkspaceId).catch(() => null);
      setNextCode(refreshedCode?.nextCode ?? null);
      form.setFieldsValue({
        name: nextName ?? undefined,
        machineCode: '',
        serialNumber: '',
        installedOn: null,
        notes: '',
      });
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {ctx}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <DsPageHeader
          title="Add Machine"
          sub="Register a new operational machine and its attributes."
          icon={<ToolOutlined />}
        />

        {locations.length === 0 && !loading && (
          <Alert
            showIcon
            type="warning"
            title="No locations configured yet"
            description={
              <span>
                Create at least one operational location before adding machines.{' '}
                <Link href="/dashboard/machines/locations" style={{ textDecoration: 'underline' }}>
                  Go to Locations
                </Link>
                .
              </span>
            }
          />
        )}
        {addedCount > 0 && (
          <Alert
            showIcon
            type="success"
            title={`${addedCount} machine${addedCount === 1 ? '' : 's'} added this session${lastSavedName ? ` (last: ${lastSavedName})` : ''}.`}
          />
        )}

        {loading && <Skeleton active paragraph={{ rows: 8 }} />}

        <DsCard style={{ display: loading ? 'none' : undefined }}>
          <Form form={form} layout="vertical" requiredMark disabled={locations.length === 0}>
            <Row gutter={[20, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="name"
                  label="Machine name"
                  rules={[{ required: true, message: 'Name is required' }]}
                >
                  <Input placeholder="e.g. Machine 1, Tajima A-3" size="large" autoFocus />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="machineCode"
                  label={`Machine code (optional - auto: ${nextCode ?? 'M-001'})`}
                >
                  <Input placeholder={nextCode ?? 'Auto-generated'} size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                {/* Location picked from the workspace Locations master list as a
                    radio group — the same list (and picker style) employees use,
                    so machine ↔ employee locations stay aligned. */}
                <Form.Item name="locationId" label="Location" rules={[{ required: true }]}>
                  <Radio.Group className="flex flex-col gap-2">
                    {locations.map((l) => (
                      <Radio key={l._id ?? l.id} value={l._id ?? l.id}>
                        {l.name}
                      </Radio>
                    ))}
                  </Radio.Group>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="floorTag" label="Floor tag (optional)">
                  <Input placeholder="e.g. Floor 2 East, Building B" size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                  <DsSelect size="large">
                    {STATUS_OPTIONS.map((o) => (
                      <DsOption key={o.value} value={o.value}>
                        {o.label}
                      </DsOption>
                    ))}
                  </DsSelect>
                </Form.Item>
              </Col>
            </Row>

            <Collapse
              ghost
              style={{ marginTop: 4 }}
              expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 180 : 0} />}
              items={[
                {
                  key: 'advanced',
                  label: (
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--cr-text-2)' }}>
                      Advanced details - type, attributes, manufacturer, notes
                    </span>
                  ),
                  children: (
                    <Row gutter={[20, 0]}>
                      <Col xs={24} md={8}>
                        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                          <DsSelect size="large">
                            {TYPE_OPTIONS.map((o) => (
                              <DsOption key={o.value} value={o.value}>
                                {o.label}
                              </DsOption>
                            ))}
                          </DsSelect>
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="manufacturer" label="Manufacturer">
                          <Input placeholder="e.g. Tajima, Brother" size="large" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="model" label="Model">
                          <Input placeholder="e.g. TEHX-C1201" size="large" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6}>
                        <Form.Item name={['attributes', 'needles']} label="Needles">
                          <InputNumber min={1} max={99} style={{ width: '100%' }} size="large" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6}>
                        <Form.Item name={['attributes', 'heads']} label="Heads">
                          <InputNumber min={1} max={99} style={{ width: '100%' }} size="large" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6}>
                        <Form.Item name={['attributes', 'hoopSizeMm']} label="Hoop size (mm)">
                          <InputNumber min={50} max={2000} style={{ width: '100%' }} size="large" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6}>
                        <Form.Item name={['attributes', 'maxRpm']} label="Max RPM">
                          <InputNumber
                            min={100}
                            max={5000}
                            style={{ width: '100%' }}
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="serialNumber" label="Serial number">
                          <Input size="large" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="installedOn" label="Installed on">
                          <DatePicker style={{ width: '100%' }} size="large" />
                        </Form.Item>
                      </Col>
                      <Col xs={24}>
                        <Form.Item name="notes" label="Notes">
                          <Input.TextArea rows={3} placeholder="Any service notes or context" />
                        </Form.Item>
                      </Col>
                    </Row>
                  ),
                },
              ]}
            />

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                marginTop: 12,
                paddingTop: 16,
                borderTop: '1px solid var(--cr-border)',
              }}
            >
              <Link href="/dashboard/machines">
                <DsButton dsVariant="ghost" dsSize="lg">
                  Cancel
                </DsButton>
              </Link>
              {addedCount > 0 && (
                <DsButton
                  dsVariant="neutral"
                  dsSize="lg"
                  onClick={() => router.push('/dashboard/machines')}
                >
                  Done
                </DsButton>
              )}
              <DsButton
                dsVariant="neutral"
                dsSize="lg"
                onClick={() => save('redirect')}
                loading={saving}
                disabled={locations.length === 0}
              >
                Save & View
              </DsButton>
              <DsButton
                dsVariant="primary"
                dsSize="lg"
                onClick={() => save('another')}
                loading={saving}
                disabled={locations.length === 0}
              >
                Save & Add Another
              </DsButton>
            </div>
          </Form>
        </DsCard>
      </div>
    </>
  );
}
