"use client";

import { notFound, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/features/auth/use-auth";

export function RequireSession({ children }: { children: ReactNode }) {
    const auth = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (auth.status === "anonymous") router.replace("/auth/login");
    }, [auth.status, router]);

    if (auth.status !== "authenticated") return null;
    return children;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
    const auth = useAuth();

    if (auth.status === "unknown") return null;
    if (auth.status !== "authenticated" || auth.user?.role !== "admin") {
        notFound();
    }

    return children;
}
