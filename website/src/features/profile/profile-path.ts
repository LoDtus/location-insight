import type { ShellRoot } from "@/features/app/shell";

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STORED_AVATAR =
    /^\/api\/v1\/media\/avatars\/[0-9a-f-]{36}\/([0-9a-f-]{36})$/i;

export type ProfileTarget =
    | { kind: "username"; username: string }
    | { kind: "id"; userId: string };

export function isUuid(value: string): boolean {
    return UUID.test(value);
}

/** `@` là username. Phần còn lại chỉ nhận id. */
export function readProfileSegment(raw: string): ProfileTarget | null {
    const value = decodeURIComponent(raw).trim();
    if (value.startsWith("@")) {
        const username = value.slice(1).trim().toLowerCase();
        if (!username || username.includes("/")) return null;
        return { kind: "username", username };
    }
    if (UUID.test(value)) return { kind: "id", userId: value.toLowerCase() };
    return null;
}

/** Mọi liên kết hồ sơ dùng username. Id chỉ khi người dùng tự gõ lên thanh địa chỉ. */
export function profileHref(root: ShellRoot, username: string): string {
    return `${root}/profile/@${username}`;
}

export function avatarFileId(url: string | null | undefined): string | null {
    if (!url) return null;
    const match = STORED_AVATAR.exec(url.split("?")[0] ?? "");
    return match?.[1]?.toLowerCase() ?? null;
}
