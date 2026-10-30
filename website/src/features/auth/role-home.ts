import type { AuthUser } from "@/features/auth/auth.slice";

export function homeForRole(role: AuthUser["role"]): string {
    return role === "admin" ? "/admin/properties" : "/app/properties";
}

export function destinationFor(role: AuthUser["role"], next: string): string {
    const root = role === "admin" ? "/admin" : "/app";
    const safe =
        (next === root || next.startsWith(`${root}/`)) &&
        !next.startsWith("//") &&
        !next.includes("\\") &&
        !next.includes("://");

    return safe ? next : homeForRole(role);
}
