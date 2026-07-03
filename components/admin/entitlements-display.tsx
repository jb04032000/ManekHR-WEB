'use client';

import { Descriptions } from 'antd';
import type { PlanEntitlements, ModuleAccessEntry } from '@/types';
import { formatEntitlementValue, countUnlockedFeatures } from '@/lib/utils/subscription.utils';

export type EntitlementsDisplayLayout = 'inline' | 'descriptions';

export type EntitlementsProduct = 'erp' | 'connect' | 'bundle';

export interface EntitlementsDisplayProps {
  entitlements: Partial<PlanEntitlements>;
  layout?: EntitlementsDisplayLayout;
  moduleAccessStats?: { modules: number; features: number; total: number };
  purchased?: Partial<PlanEntitlements>;
  /**
   * The plan/tier product line. Connect allowances render for `connect` and
   * `bundle`; the ERP workspace/member rows are hidden for a pure `connect`
   * plan (they are meaningless there). Defaults to ERP for back-compat.
   */
  product?: EntitlementsProduct;
}

export function EntitlementsDisplay({
  entitlements,
  layout = 'inline',
  moduleAccessStats,
  purchased,
  product = 'erp',
}: EntitlementsDisplayProps) {
  if (layout === 'descriptions') {
    return (
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="Workspaces">
          {formatEntitlementValue(entitlements.maxWorkspaces)}
          {purchased && purchased.maxWorkspaces !== entitlements.maxWorkspaces && (
            <span className="ml-1 text-xs text-faint">
              (purchased: {formatEntitlementValue(purchased.maxWorkspaces)})
            </span>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Members / Workspace">
          {formatEntitlementValue(entitlements.maxMembersPerWorkspace)}
          {purchased &&
            purchased.maxMembersPerWorkspace !== entitlements.maxMembersPerWorkspace && (
              <span className="ml-1 text-xs text-faint">
                (purchased: {formatEntitlementValue(purchased.maxMembersPerWorkspace)})
              </span>
            )}
        </Descriptions.Item>
        <Descriptions.Item label="Total Members">
          {formatEntitlementValue(entitlements.maxTotalMembers)}
          {purchased && purchased.maxTotalMembers !== entitlements.maxTotalMembers && (
            <span className="ml-1 text-xs text-faint">
              (purchased: {formatEntitlementValue(purchased.maxTotalMembers)})
            </span>
          )}
        </Descriptions.Item>
        {entitlements.maxSessionsTotal != null && (
          <Descriptions.Item label="Total Sessions">
            {formatEntitlementValue(entitlements.maxSessionsTotal)}
          </Descriptions.Item>
        )}
        {entitlements.maxSessionsPerPlatform != null && (
          <Descriptions.Item label="Sessions / Platform">
            {formatEntitlementValue(entitlements.maxSessionsPerPlatform)}
          </Descriptions.Item>
        )}
      </Descriptions>
    );
  }

  const stats =
    moduleAccessStats ||
    (entitlements.moduleAccess
      ? countUnlockedFeatures(entitlements.moduleAccess as ModuleAccessEntry[])
      : undefined);

  const connect = entitlements.connect;
  const showConnect = product !== 'erp' && !!connect;
  // Hide the ERP workspace/member rows only for a pure Connect plan that
  // actually carries Connect allowances. A Connect *tier* (which has no
  // Connect block today) falls back to the ERP rows so the card is never empty.
  const showErp = product !== 'connect' || !connect;

  return (
    <div className="flex flex-col gap-1.5 text-xs text-secondary">
      {showErp && (
        <>
          <span>🏢 {formatEntitlementValue(entitlements.maxWorkspaces)} workspaces</span>
          <span>
            👥 {formatEntitlementValue(entitlements.maxMembersPerWorkspace)} members/workspace
          </span>
          {entitlements.maxSessionsTotal !== undefined && (
            <span>📱 {formatEntitlementValue(entitlements.maxSessionsTotal)} sessions</span>
          )}
          {entitlements.moduleAccess && entitlements.moduleAccess.length > 0 && stats && (
            <span>
              📦 {stats.modules} modules, {stats.features}/{stats.total} features unlocked
            </span>
          )}
          {!entitlements.moduleAccess && (
            <span>📦 {entitlements.modules?.length ?? 0} modules</span>
          )}
        </>
      )}
      {showConnect && connect && (
        <>
          <span>🛍️ {formatEntitlementValue(connect.maxListings)} listings</span>
          <span>📨 {formatEntitlementValue(connect.leadsPerMonth)} leads/month</span>
          {connect.includedBoostCredits != null && connect.includedBoostCredits > 0 && (
            <span>🚀 {connect.includedBoostCredits} boost credits/cycle</span>
          )}
          {connect.searchPriority != null && connect.searchPriority > 0 && (
            <span>🔝 Search priority {connect.searchPriority}</span>
          )}
          {connect.verifiedBadge && <span>✅ Verified badge included</span>}
        </>
      )}
    </div>
  );
}
