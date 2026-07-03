'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Index redirect for a reminder rule. The rule folder holds the edit form and has
 * no page of its own, so visiting it directly - or clicking the breadcrumb
 * "Detail" segment on a rule sub-page - would 404. Send it to the rule editor.
 */
export default function ReminderRuleDetailIndex() {
  const router = useRouter();
  const params = useParams<{ firmId: string; ruleId: string }>();
  useEffect(() => {
    if (params?.firmId && params?.ruleId) {
      router.replace(
        `/dashboard/finance/firms/${params.firmId}/reminders/rules/${params.ruleId}/edit`,
      );
    }
  }, [router, params?.firmId, params?.ruleId]);
  return null;
}
