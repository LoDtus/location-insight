import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AuthUser = {
    userId: string;
    displayName: string;
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
    },
});

export const { sessionStarted, sessionCleared } = authSlice.actions;
export default authSlice.reducer;
