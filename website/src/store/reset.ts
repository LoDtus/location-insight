import Cookies from "js-cookie";

import {
    PREFERENCE,
    preferenceActions,
} from "@/features/preference/preference.slice";
import LOCALE from "@/shared/constants/locale.constant";
import { persistor, resetAppState, store } from "@/store/store";

export type ClientCleaner = () => void | Promise<void>;

export type ResetClientStateOptions = {
    keepPreference?: boolean;
    extraCookieNames?: string[];
    extraStorageKeys?: string[];
};

const clientCleaners = new Map<string, ClientCleaner>();

export function registerClientCleaner(
    id: string,
    cleaner: ClientCleaner,
): () => void {
    clientCleaners.set(id, cleaner);

    return () => {
        clientCleaners.delete(id);
    };
}

function persistStorageKey(): string {
    return `persist:${PREFERENCE.PERSIST_KEY}`;
}

function clearWebStorage(webStorage: Storage, preserve: Set<string>): void {
    if (preserve.size === 0) {
        webStorage.clear();
        return;
    }

    Object.keys(webStorage).forEach((key) => {
        if (!preserve.has(key)) {
            webStorage.removeItem(key);
        }
    });
}

function clearClientCookies(preserve: Set<string>): void {
    const cookies = Cookies.get();

    Object.keys(cookies).forEach((name) => {
        if (preserve.has(name)) {
            return;
        }

        Cookies.remove(name, { path: "/" });
    });
}

async function runClientCleaners(): Promise<void> {
    const tasks = Array.from(clientCleaners.values()).map((cleaner) =>
        Promise.resolve().then(cleaner),
    );

    await Promise.all(tasks);
}

export async function resetClientState(
    options: ResetClientStateOptions = {},
): Promise<void> {
    if (typeof window === "undefined") {
        return;
    }

    const keepPreference = options.keepPreference !== false;

    await runClientCleaners();

    store.dispatch(resetAppState({ keepPreference }));

    if (!keepPreference) {
        await persistor.purge();
    }

    const preservedStorageKeys = new Set<string>(
        keepPreference ? [persistStorageKey()] : [],
    );
    const preservedCookies = new Set<string>(
        keepPreference ? [PREFERENCE.THEME_COOKIE, LOCALE.COOKIE_NAME] : [],
    );

    options.extraStorageKeys?.forEach((key) => {
        preservedStorageKeys.delete(key);
    });
    options.extraCookieNames?.forEach((name) => {
        preservedCookies.delete(name);
    });

    clearWebStorage(window.localStorage, preservedStorageKeys);
    clearWebStorage(window.sessionStorage, new Set());
    clearClientCookies(preservedCookies);

    if (!keepPreference) {
        store.dispatch(preferenceActions.rehydrateFromClient());
    }

    await persistor.flush();
}
