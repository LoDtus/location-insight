export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  ADMIN = 'admin',
}

export enum Plan {
  FREE = 'free',
  UNLIMITED = 'unlimited',
  VALUED = 'valued',
}

export type Permission =
  | 'landing:view'
  | 'legal:view'
  | 'article:view'
  | 'listing:view'
  | 'map:view'
  | 'map:use'
  | 'analysis:demo'
  | 'profile:read'
  | 'profile:update'
  | 'session:manage'
  | 'account:delete'
  | 'billing:read'
  | 'notification:read'
  | 'notification:update'
  | 'place:save'
  | 'place:note'
  | 'analysis:run'
  | 'analysis:history:read'
  | 'listing:create'
  | 'listing:update'
  | 'listing:delete'
  | 'listing:contact:reveal'
  | 'comment:create'
  | 'comment:delete'
  | 'discussion:read'
  | 'discussion:write'
  | 'message:read'
  | 'message:write'
  | 'feedback:write'
  | 'email:self'
  | 'follow:read'
  | 'follow:write'
  | 'valuation:run'
  | 'admin:access'
  | 'user:read'
  | 'user:lock'
  | 'user:session:revoke'
  | 'subscription:grant'
  | 'credit:grant'
  | 'quota:reset'
  | 'listing:moderate'
  | 'article:manage'
  | 'discussion:moderate'
  | 'message:moderate'
  | 'feedback:manage'
  | 'email:manage'
  | 'audit:read';

export type QuotaName = 'analysisDaily';
export type LimitName =
  'savedPlaces' | 'activeListings' | 'comparePlaces' | 'historyDays';

export type QuotaValue = number | null;

export interface PlanEntitlement {
  readonly permissions: readonly Permission[];
  readonly quotas: Readonly<Record<QuotaName, QuotaValue>>;
  readonly limits: Readonly<Record<LimitName, number>>;
}

export interface ResourceRule {
  readonly ownerField: string;
  readonly orPermission?: Permission;
  readonly denyAs: 403 | 404;
}

export interface Principal {
  readonly userId: string | null;
  readonly role: UserRole;
  readonly status: 'active' | 'locked' | 'deleted' | null;
  readonly plan: Plan;
  readonly planUntil: number | null;
  readonly sessionId: string | null;
  readonly authTime: number | null;
}
