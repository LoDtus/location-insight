import { AuthApiError, apiRequest } from "@/features/auth/auth.api";

export type Profile = {
    userId: string;
    username: string | null;
    displayName: string;
    email?: string;
    avatarUrl: string | null;
    city: string | null;
    bio: string;
    role: "user" | "admin";
    joinedAt: string;
};

export type ProfileInput = {
    displayName: string;
    username: string;
    avatarUrl?: string;
    city?: string;
    bio?: string;
};

export function getOwnProfile(): Promise<Profile> {
    return apiRequest<Profile>("/profiles/me");
}

export function getPublicProfile(username: string): Promise<Profile> {
    return apiRequest<Profile>(`/profiles/${encodeURIComponent(username)}`);
}

export function updateOwnProfile(input: ProfileInput): Promise<Profile> {
    return apiRequest<Profile>("/profiles/me", {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

export async function uploadAvatar(file: Blob): Promise<Profile> {
    const contentType = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
    const created = await apiRequest<{ uploadUrl: string }>("/profiles/me/avatar", {
        method: "POST",
        body: JSON.stringify({ contentType, byteSize: file.size }),
    });
    const uploaded = await fetch(created.uploadUrl, {
        method: "PUT",
        headers: { "content-type": contentType },
        body: file,
    });
    if (!uploaded.ok) {
        throw new AuthApiError("Chưa tải được ảnh.", uploaded.status);
    }
    return apiRequest<Profile>("/profiles/me/avatar/complete", { method: "POST" });
}
