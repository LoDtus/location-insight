import { AuthApiError, apiRequest } from "@/features/auth/auth.api";

export interface FollowState {
    following: boolean;
    followedBy: boolean;
    followerCount: number;
    followingCount: number;
    self: boolean;
}

export interface FollowEntry {
    id: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    followedByMe: boolean;
    followsMe: boolean;
    followedAt: string;
}

export interface FollowPage {
    items: FollowEntry[];
    nextCursor: string | null;
}

export function getFollowState(userId: string): Promise<FollowState> {
    return apiRequest(`/users/${userId}/follow`);
}

export function followUser(userId: string): Promise<FollowState> {
    return apiRequest(`/users/${userId}/follow`, { method: "PUT" });
}

export function unfollowUser(userId: string): Promise<FollowState> {
    return apiRequest(`/users/${userId}/follow`, { method: "DELETE" });
}

export function listFollowers(userId: string, cursor?: string | null): Promise<FollowPage> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return apiRequest(`/users/${userId}/followers${query}`);
}

export function listFollowing(userId: string, cursor?: string | null): Promise<FollowPage> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return apiRequest(`/users/${userId}/following${query}`);
}

export function followError(error: unknown): string {
    if (error instanceof AuthApiError) {
        if (error.status === 403) return "Bạn không thể theo dõi người này.";
        if (error.status === 429) return "Bạn thao tác hơi nhanh, hãy thử lại sau.";
        return error.message || "Chưa thực hiện được.";
    }
    return "Chưa thực hiện được. Hãy thử lại.";
}
