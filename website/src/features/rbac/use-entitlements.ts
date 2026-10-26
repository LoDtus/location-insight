"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/features/auth/auth.api";
import { useAuth } from "@/features/auth/use-auth";

export type Entitlements = {
    role: "user" | "admin";
    plan: "free" | "unlimited" | "valued";
    permissions: string[];
};

export function useEntitlements(): Entitlements | null {
    const auth = useAuth();
    const userId = auth.user?.userId ?? null;
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

    useEffect(() => {
        if (auth.status !== "authenticated" || !userId) return;

        let active = true;
        void apiRequest<Entitlements>("/me/entitlements")
            .then((data) => {
                if (!active) return;
                setLoadedFor(userId);
                setEntitlements(data);
            })
            .catch(() => {
                if (!active) return;
                setLoadedFor(userId);
                setEntitlements(null);
            });

        return () => {
            active = false;
        };
    }, [auth.status, userId]);

    if (auth.status !== "authenticated" || loadedFor !== userId) return null;
    return entitlements;
}
