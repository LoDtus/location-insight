"use client";

import type { ReactNode } from "react";

import { useEntitlements } from "./use-entitlements";

export function Can({
    permission,
    children,
    fallback = null,
}: {
    permission: string;
    children: ReactNode;
    fallback?: ReactNode;
}) {
    const entitlements = useEntitlements();
    if (!entitlements?.permissions.includes(permission)) return fallback;
    return children;
}
