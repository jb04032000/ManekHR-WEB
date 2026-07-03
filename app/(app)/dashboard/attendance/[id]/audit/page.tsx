import AuditClient from './AuditClient';

/**
 * Server shell for the per-record audit trail page.
 * Route: /dashboard/attendance/[id]/audit
 * D-28, M-05 Task 4.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuditClient attendanceId={id} />;
}
