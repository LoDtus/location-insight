import { apiRequest } from "@/features/auth/auth.api";
import { deviceId } from "@/features/pwa/pwa-state";

const NO_SW_KEY = "pwa-no-sw";
const DEV_SW_KEY = "pwa-dev-sw";

export type WorkerSwitch = { disabled: boolean; noSw: boolean; devSw: boolean };

/**
 * Quyết định có tắt service worker không.
 * - `?no-sw=1`: tắt, nhớ trong phiên (có sẵn từ trước).
 * - Ngoài production: tắt mặc định, vì Next dev đặt tên chunk không kèm mã băm nên worker
 *   cache-first sẽ phục vụ mãi mã cũ và chặn hot reload. `?sw=1` bật lại để thử PWA.
 */
export function resolveWorkerSwitch(input: { search: string; noSw: boolean; devSw: boolean; production: boolean }): WorkerSwitch {
    const params = new URLSearchParams(input.search);
    let { noSw, devSw } = input;
    if (params.get("sw") === "1") {
        devSw = true;
        noSw = false;
    }
    if (params.get("no-sw") === "1") {
        noSw = true;
        devSw = false;
    }
    const disabled = noSw || (!input.production && !devSw);
    return { disabled, noSw, devSw };
}

export function serviceWorkerDisabled(): boolean {
    const production = process.env.NODE_ENV === "production";
    try {
        const next = resolveWorkerSwitch({
            search: window.location.search,
            noSw: sessionStorage.getItem(NO_SW_KEY) === "1",
            devSw: sessionStorage.getItem(DEV_SW_KEY) === "1",
            production,
        });
        if (next.noSw) sessionStorage.setItem(NO_SW_KEY, "1");
        else sessionStorage.removeItem(NO_SW_KEY);
        if (next.devSw) sessionStorage.setItem(DEV_SW_KEY, "1");
        else sessionStorage.removeItem(DEV_SW_KEY);
        return next.disabled;
    } catch {
        return !production;
    }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return null;
    if (serviceWorkerDisabled()) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        return null;
    }
    return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export async function skipWaitingAndReload(): Promise<void> {
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    sessionStorage.setItem("pwa-reload", "1");
}

export async function syncBadge(count: number): Promise<void> {
    const nav = navigator as Navigator & {
        setAppBadge?: (contents?: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
    };
    if (count > 0 && nav.setAppBadge) {
        await nav.setAppBadge(count);
        return;
    }
    if (nav.clearAppBadge) await nav.clearAppBadge();
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.active?.postMessage({ type: "BADGE", count });
}

export async function preparePwaLogout(): Promise<void> {
    try {
        await apiRequest("/notifications/push/subscriptions/suspend", {
            method: "POST",
            body: JSON.stringify({ deviceId: deviceId() }),
        });
    } catch {
        /* API thông báo có thể chưa bật; đăng xuất vẫn tiếp tục. */
    }
    if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
        reg?.active?.postMessage({ type: "LOGOUT" });
    }
    const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    if (nav.clearAppBadge) await nav.clearAppBadge().catch(() => undefined);
}

export function recordPwaMetric(name: "push-support" | "push-permission" | "installed" | "sw-updated"): void {
    if (process.env.NODE_ENV !== "production") return;
    void name;
}
