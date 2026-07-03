"use client";
import { Modal, Button } from 'antd';
import { WarningOutlined, UserOutlined } from '@ant-design/icons';
import type { PayrollMissingItem } from '@/lib/member-readiness';

interface PayrollReadinessModalProps {
  open: boolean;
  onClose: () => void;
  incompleteMembers: PayrollMissingItem[];
  eligibleCount: number;
  onSkip: () => void;
  onComplete: () => void;
}

export function PayrollReadinessModal({
  open,
  onClose,
  incompleteMembers,
  eligibleCount,
  onSkip,
  onComplete,
}: PayrollReadinessModalProps) {
  const totalAffected = incompleteMembers.length;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnHidden
      title={
        <div className="flex items-center gap-2.5">
          <WarningOutlined className="text-amber-700" />
          <span>Incomplete Member Profiles</span>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {/* Summary banner */}
        <div
          className="rounded-xl border px-4 py-3"
          style={{
            background: "var(--cr-warning-50)",
            borderColor: "rgba(245,158,11,0.25)",
          }}
        >
          <p className="m-0 text-[14px] font-semibold text-amber-700">
            {eligibleCount} member{eligibleCount !== 1 ? "s" : ""} eligible
          </p>
          <p className="m-0 mt-1 text-[13px] text-amber-700">
            {totalAffected} member{totalAffected !== 1 ? "s" : ""}{" "}
            {totalAffected !== 1 ? "have" : "has"} incomplete payroll details
            and will be skipped.
          </p>
        </div>

        {/* Member list */}
        <div className="space-y-2">
          {incompleteMembers.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-[var(--cr-border,var(--cr-border))] px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <UserOutlined className="text-[12px]" />
                </div>
                <span className="truncate text-[13px] font-medium text-heading">
                  {m.name}
                </span>
              </div>
              <span className="shrink-0 text-[12px] text-amber-700">
                Missing: {m.missing.join(", ")}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button type="primary" onClick={onSkip} className="flex-1">
            Skip &amp; continue ({eligibleCount})
          </Button>
          <Button onClick={onComplete} className="flex-1">
            Complete profiles
          </Button>
        </div>
      </div>
    </Modal>
  );
}
