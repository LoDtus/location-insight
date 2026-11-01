import {
  Permission,
  Plan,
  PlanEntitlement,
  ResourceRule,
  UserRole,
} from './authorization.types.js';

export const GUEST_PERMISSIONS = [
  'landing:view',
  'legal:view',
  'article:view',
  'listing:view',
  'map:view',
  'analysis:demo',
] as const satisfies readonly Permission[];

export const USER_PERMISSIONS = [
  'profile:read',
  'profile:update',
  'session:manage',
  'account:delete',
  'billing:read',
  'notification:read',
  'place:save',
  'place:note',
  'analysis:run',
  'analysis:history:read',
  'listing:create',
  'listing:update',
  'listing:delete',
  'listing:contact:reveal',
  'comment:create',
  'comment:delete',
  'discussion:read',
  'discussion:write',
  'message:read',
  'message:write',
  'feedback:write',
] as const satisfies readonly Permission[];

export const ADMIN_PERMISSIONS = [
  'admin:access',
  'user:read',
  'user:lock',
  'user:session:revoke',
  'subscription:grant',
  'credit:grant',
  'quota:reset',
  'listing:moderate',
  'article:manage',
  'discussion:moderate',
  'message:moderate',
  'feedback:manage',
  'audit:read',
] as const satisfies readonly Permission[];

export const PLAN_ENTITLEMENTS: Readonly<Record<Plan, PlanEntitlement>> = {
  [Plan.FREE]: {
    permissions: [],
    quotas: { analysisDaily: 10 },
    limits: {
      savedPlaces: 20,
      activeListings: 3,
      comparePlaces: 4,
      historyDays: 30,
    },
  },
  [Plan.UNLIMITED]: {
    permissions: [],
    quotas: { analysisDaily: null },
    limits: {
      savedPlaces: 200,
      activeListings: 10,
      comparePlaces: 4,
      historyDays: 365,
    },
  },
  [Plan.VALUED]: {
    permissions: ['valuation:run'],
    quotas: { analysisDaily: null },
    limits: {
      savedPlaces: 200,
      activeListings: 10,
      comparePlaces: 4,
      historyDays: 365,
    },
  },
};

export const PLAN_RANK: Readonly<Record<Plan, number>> = {
  [Plan.FREE]: 0,
  [Plan.UNLIMITED]: 1,
  [Plan.VALUED]: 2,
};

export const ADMIN_EFFECTIVE_PLAN = Plan.VALUED;
export const QUOTA_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const RECENT_AUTH_SECONDS = 600;

export const ROLE_PERMISSIONS: Readonly<
  Record<UserRole, readonly Permission[]>
> = {
  [UserRole.GUEST]: [...GUEST_PERMISSIONS],
  [UserRole.USER]: [...GUEST_PERMISSIONS, ...USER_PERMISSIONS],
  [UserRole.ADMIN]: [
    ...GUEST_PERMISSIONS,
    ...USER_PERMISSIONS,
    ...ADMIN_PERMISSIONS,
  ],
};

export const RESOURCE_RULES: Readonly<
  Partial<Record<Permission, ResourceRule>>
> = {
  'listing:update': { ownerField: 'ownerId', denyAs: 403 },
  'listing:delete': {
    ownerField: 'ownerId',
    orPermission: 'listing:moderate',
    denyAs: 403,
  },
  'comment:delete': {
    ownerField: 'authorId',
    orPermission: 'listing:moderate',
    denyAs: 403,
  },
  'place:note': { ownerField: 'userId', denyAs: 404 },
  'place:save': { ownerField: 'userId', denyAs: 404 },
  'analysis:history:read': { ownerField: 'userId', denyAs: 404 },
};

export const REQUIRES_RECENT_AUTH: readonly Permission[] = [
  'account:delete',
  'user:lock',
  'user:session:revoke',
  'subscription:grant',
  'credit:grant',
  'quota:reset',
];

export function effectivePermissions(role: UserRole, plan: Plan): Permission[] {
  const granted = new Set<Permission>(ROLE_PERMISSIONS[role]);
  if (role === UserRole.GUEST) return [...granted];

  const entitlementPlan = role === UserRole.ADMIN ? ADMIN_EFFECTIVE_PLAN : plan;
  for (const permission of PLAN_ENTITLEMENTS[entitlementPlan].permissions) {
    granted.add(permission);
  }
  return [...granted];
}

export function effectivePlan(
  plan: Plan,
  planUntil: number | null,
  now = Date.now(),
): Plan {
  if (plan === Plan.FREE) return Plan.FREE;
  if (planUntil !== null && planUntil <= now) return Plan.FREE;
  return plan;
}

export function lowestPlanWith(permission: Permission): Plan | null {
  const plans = [Plan.FREE, Plan.UNLIMITED, Plan.VALUED];
  return (
    plans.find((plan) =>
      PLAN_ENTITLEMENTS[plan].permissions.includes(permission),
    ) ?? null
  );
}
