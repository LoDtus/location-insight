"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { homeForRole } from "@/features/auth/role-home";
import { useAuth } from "@/features/auth/use-auth";

function loginPath(): string {
    const next = `${window.location.pathname}${window.location.search}`;
    return `/auth/login?next=${encodeURIComponent(next)}`;
}

function adminViewingProfile(pathname: string): boolean {
    return pathname === "/app/profile" || pathname.startsWith("/app/profile/");
}

export function RequireSession({ children }: { children: ReactNode }) {
    const auth = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const adminOnProfile = auth.user?.role === "admin" && adminViewingProfile(pathname);

    useEffect(() => {
        if (auth.status === "anonymous") {
            router.replace(loginPath());
        }
        if (auth.status === "authenticated" && auth.user?.role === "admin" && !adminViewingProfile(pathname)) {
            router.replace(homeForRole("admin"));
        }
    }, [auth.status, auth.user?.role, pathname, router]);

    if (auth.status !== "authenticated" || (auth.user?.role !== "user" && !adminOnProfile)) return null;
    return children;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
    const auth = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (auth.status === "anonymous") {
            router.replace(loginPath());
        }
        if (auth.status === "authenticated" && auth.user?.role !== "admin") {
            router.replace(homeForRole("user"));
        }
    }, [auth.status, auth.user?.role, router]);

    if (auth.status !== "authenticated" || auth.user?.role !== "admin") return null;
    return children;
}
