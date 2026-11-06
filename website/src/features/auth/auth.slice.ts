import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AuthUser = {
    userId: string;
    displayName: string;
    /** Không có khi người dùng chưa đặt username (hoặc phiên cũ trước khi trả trường này). */
    username?: string | null;
    email?: string;
    avatarUrl?: string | null;
    role: "user" | "admin";
    plan: "free" | "unlimited" | "valued";
};

export type AuthStatus = "unknown" | "anonymous" | "authenticated";

type AuthState = {
    status: AuthStatus;
    accessToken: string | null;
    expiresAt: number | null;
    user: AuthUser | null;
};

const initialState: AuthState = {
    status: "unknown",
    accessToken: null,
    expiresAt: null,
    user: null,
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        sessionStarted(
            state,
            action: PayloadAction<{
                accessToken: string;
                expiresIn: number;
                user: AuthUser;
            }>,
        ) {
            state.status = "authenticated";
            state.accessToken = action.payload.accessToken;
            state.expiresAt = Date.now() + action.payload.expiresIn * 1000;
            state.user = action.payload.user;
        },
        sessionCleared(state) {
            state.status = "anonymous";
            state.accessToken = null;
            state.expiresAt = null;
            state.user = null;
        },
        profileUpdated(
            state,
            action: PayloadAction<{
                displayName: string;
                avatarUrl: string | null;
                username?: string | null;
            }>,
        ) {
            if (!state.user) return;
            state.user.displayName = action.payload.displayName;
            state.user.avatarUrl = action.payload.avatarUrl;
            if (action.payload.username !== undefined) state.user.username = action.payload.username;
        },
    },
});

export const { sessionStarted, sessionCleared, profileUpdated } = authSlice.actions;
export default authSlice.reducer;
