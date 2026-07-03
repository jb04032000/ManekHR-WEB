'use client';

import { useState, useEffect, useCallback } from 'react';
import { App, Button, Space, Modal, Select, Tag, Skeleton, Typography, Table, Alert } from 'antd';
import { UserSwitchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import { attendanceDevicesApi } from '@/lib/api/modules/attendance-devices.api';
import { teamApi } from '@/lib/api/modules/team.api';
import type { UnassignedPunchPair, TeamMember, PaginatedResponse } from '@/types';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

// ── Page component ────────────────────────────────────────────────────────────

export default function UnassignedPunchesPage() {
  const t = useTranslations('attendance.unassigned');
  const { currentWorkspaceId } = useWorkspaceStore();
  const { message: msgApi } = App.useApp();

  const [pairs, setPairs] = useState<UnassignedPunchPair[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPair, setSelectedPair] = useState<UnassignedPunchPair | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>();
  const [assigning, setAssigning] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchPairs = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const data = await attendanceDevicesApi.getUnassignedPunches(currentWorkspaceId);
      setPairs(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('toast.failLoad');
      msgApi.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, msgApi]);

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setMembersLoading(true);
    try {
      const result = await teamApi.list(currentWorkspaceId);
      // Handle both array and paginated response shapes
      if (Array.isArray(result)) {
        setMembers(result);
      } else {
        // PaginatedResponse<TeamMember>
        const paginated = result as PaginatedResponse<TeamMember>;
        setMembers(paginated.data ?? []);
      }
    } catch {
      // Non-critical - member list used only in assignment modal
    } finally {
      setMembersLoading(false);
    }
  }, [currentWorkspaceId]);

  // Inline-async-IIFE pair w/ cancel flag. useCallbacks stay for explicit
  // handler refresh (post-assign).
  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await attendanceDevicesApi.getUnassignedPunches(currentWorkspaceId);
        if (!cancelled) setPairs(data);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : t('toast.failLoad');
        msgApi.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    void (async () => {
      setMembersLoading(true);
      try {
        const result = await teamApi.list(currentWorkspaceId);
        if (cancelled) return;
        if (Array.isArray(result)) {
          setMembers(result);
        } else {
          const paginated = result as PaginatedResponse<TeamMember>;
          setMembers(paginated.data ?? []);
        }
      } catch {
        // Non-critical - member list used only in assignment modal
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, msgApi]);

  // ── Assignment modal ───────────────────────────────────────────────────────

  function openMapModal(pair: UnassignedPunchPair) {
    setSelectedPair(pair);
    setSelectedMemberId(undefined);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedPair(null);
    setSelectedMemberId(undefined);
  }

  async function handleAssign() {
    if (!currentWorkspaceId || !selectedPair || !selectedMemberId) return;
    setAssigning(true);
    try {
      await attendanceDevicesApi.assignDeviceUser(currentWorkspaceId, {
        deviceSerial: selectedPair.deviceSerial,
        deviceUserId: selectedPair.deviceUserId,
        teamMemberId: selectedMemberId,
      });
      msgApi.success(t('toast.mapped'));
      // Remove the mapped row from the table immediately
      setPairs((prev) =>
        prev.filter(
          (p) =>
            !(
              p.deviceSerial === selectedPair.deviceSerial &&
              p.deviceUserId === selectedPair.deviceUserId
            ),
        ),
      );
      closeModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('toast.failMap');
      msgApi.error(msg);
    } finally {
      setAssigning(false);
    }
  }

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns: ColumnsType<UnassignedPunchPair> = [
    {
      title: t('col.deviceSerial'),
      dataIndex: 'deviceSerial',
      key: 'deviceSerial',
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</Text>,
    },
    {
      title: t('col.deviceUserId'),
      dataIndex: 'deviceUserId',
      key: 'deviceUserId',
      render: (v: string) => <Tag style={{ fontFamily: 'monospace' }}>{v}</Tag>,
    },
    {
      title: t('col.eventCount'),
      dataIndex: 'eventCount',
      key: 'eventCount',
      render: (v: number) => v.toLocaleString(),
      width: 120,
    },
    {
      title: t('col.firstSeen'),
      dataIndex: 'firstSeenAt',
      key: 'firstSeenAt',
      render: (v: string) => (v ? dayjs(v).format('DD MMM YYYY, HH:mm') : '–'),
      width: 180,
    },
    {
      title: t('col.lastSeen'),
      dataIndex: 'lastSeenAt',
      key: 'lastSeenAt',
      render: (v: string) => (v ? dayjs(v).format('DD MMM YYYY, HH:mm') : '–'),
      width: 180,
    },
    {
      title: t('col.action'),
      key: 'action',
      width: 160,
      render: (_: unknown, record: UnassignedPunchPair) => (
        <Button
          size="small"
          type="primary"
          icon={<UserSwitchOutlined />}
          onClick={() => openMapModal(record)}
        >
          {t('mapToMember')}
        </Button>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <DsPageHeader title={t('pageTitle')} sub={t('intro')} icon={<UserSwitchOutlined />} />

      {/* Table */}
      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : pairs.length === 0 ? (
        <Alert
          type="success"
          showIcon
          title={t('allMappedTitle')}
          description={t('allMappedDesc')}
          style={{ maxWidth: 520 }}
        />
      ) : (
        <Table<UnassignedPunchPair>
          rowKey={(r) => `${r.deviceSerial}-${r.deviceUserId}`}
          dataSource={pairs}
          columns={columns}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          scroll={{ x: 860 }}
        />
      )}

      {/* Map-to-member modal */}
      <Modal
        open={modalOpen}
        title={t('modal.title')}
        onCancel={closeModal}
        onOk={handleAssign}
        okText={t('modal.confirm')}
        okButtonProps={{ disabled: !selectedMemberId, loading: assigning }}
        cancelButtonProps={{ disabled: assigning }}
        destroyOnHidden
      >
        {selectedPair && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text type="secondary">{t('modal.deviceSerialLabel')}</Text>
              <br />
              <Text strong style={{ fontFamily: 'monospace' }}>
                {selectedPair.deviceSerial}
              </Text>
            </div>
            <div>
              <Text type="secondary">{t('modal.deviceUserIdLabel')}</Text>
              <br />
              <Text strong style={{ fontFamily: 'monospace' }}>
                {selectedPair.deviceUserId}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                {t('modal.mapToTeamMember')}
              </Text>
              <Select
                aria-label={t('modal.mapToTeamMember')}
                style={{ width: '100%' }}
                placeholder={t('modal.searchPlaceholder')}
                showSearch
                loading={membersLoading}
                filterOption={(input, option) =>
                  ((option?.label as string) ?? '').toLowerCase().includes(input.toLowerCase())
                }
                value={selectedMemberId}
                onChange={setSelectedMemberId}
                options={members.map((m) => ({
                  value: m.id,
                  label: `${m.name}${m.employeeCode ? ` (${m.employeeCode})` : m.email ? ` (${m.email})` : ''}`,
                }))}
              />
            </div>
          </Space>
        )}
      </Modal>
    </>
  );
}
