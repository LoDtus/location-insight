import { apiRequest } from "@/features/auth/auth.api";

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
