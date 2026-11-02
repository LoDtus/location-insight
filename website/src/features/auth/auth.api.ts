import { store } from "@/store/store";

import { sessionCleared, sessionStarted, type AuthUser } from "./auth.slice";

import { AUTH_REQUESTED_WITH } from "./auth.constant";

const REQUESTED_WITH = AUTH_REQUESTED_WITH;

type Envelope<T> = {
    success?: boolean;
    message?: string;
    data?: T;
    error?: { code?: string; message?: string };
};

export class AuthApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code?: string,
    ) {
        super(message);
    }
}

export type TokenPayload = {
    accessToken: string;
    tokenType: "Bearer";
    expiresIn: number;
    refreshToken?: string;
    user: AuthUser;
};

let refreshInFlight: Promise<boolean> | null = null;

export function accessToken(): string | null {
    return store.getState().auth.accessToken;
}

export async function apiRequest<T>(
    path: string,
    init: RequestInit = {},
    retry = true,
): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("x-requested-with", REQUESTED_WITH);
    if (init.body && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
    }

    const token = accessToken();
    if (token) headers.set("authorization", `Bearer ${token}`);

    const response = await fetch(`/api/v1${path}`, {
        ...init,
        headers,
        credentials: "include",
    });
    const body = (await response.json().catch(() => null)) as Envelope<T> | null;

    const skipRefresh =
        path === "/auth/refresh" ||
        path === "/auth/login" ||
        path === "/auth/register" ||
        path === "/auth/forgot-password" ||
        path === "/auth/reset-password";
    if (response.status === 401 && retry && !skipRefresh) {
        const refreshed = await refreshSession();
        if (refreshed) return apiRequest<T>(path, init, false);
    }

    if (!response.ok || body?.success === false) {
        throw new AuthApiError(
            body?.error?.message || body?.message || "Yêu cầu không thành công.",
            response.status,
            body?.error?.code,
        );
    }

    return body?.data as T;
}

export async function refreshSession(): Promise<boolean> {
    if (!refreshInFlight) {
        refreshInFlight = runRefresh().finally(() => {
            refreshInFlight = null;
        });
    }

    return refreshInFlight;
}

async function runRefresh(): Promise<boolean> {
    const execute = async () => {
        const response = await fetch("/api/v1/auth/refresh", {
            method: "POST",
            credentials: "include",
            headers: {
                "content-type": "application/json",
                "x-requested-with": REQUESTED_WITH,
            },
        });
        if (!response.ok) {
            store.dispatch(sessionCleared());
            return false;
        }

        const body = (await response.json()) as Envelope<TokenPayload>;
        if (!body.data?.accessToken) {
            store.dispatch(sessionCleared());
            return false;
        }

        store.dispatch(sessionStarted(body.data));
        return true;
    };

    if (typeof navigator !== "undefined" && navigator.locks) {
        return navigator.locks.request("dt-auth-refresh", execute);
    }

    return execute();
}

export async function login(email: string, password: string): Promise<TokenPayload> {
    const data = await apiRequest<TokenPayload>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
    store.dispatch(sessionStarted(data));
    return data;
}

export async function registerAccount(input: {
    email: string;
    password: string;
    displayName: string;
    acceptTerms: boolean;
}): Promise<void> {
    await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export async function forgotPassword(email: string): Promise<void> {
    await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
    });
}

export async function resetPassword(token: string, password: string): Promise<void> {
    await apiRequest("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
    });
}

export async function logout(): Promise<void> {
    try {
        const { preparePwaLogout } = await import("@/features/pwa/pwa-client");
        await preparePwaLogout();
        await apiRequest("/auth/logout", { method: "POST" }, false);
    } finally {
        store.dispatch(sessionCleared());
    }
}
