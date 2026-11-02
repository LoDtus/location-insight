import { apiRequest } from "@/features/auth/auth.api";
import { deviceId } from "@/features/pwa/pwa-state";

export function serviceWorkerDisabled(): boolean {
    try {
        if (new URLSearchParams(window.location.search).get("no-sw") === "1") {
            sessionStorage.setItem("pwa-no-sw", "1");
        }
        return sessionStorage.getItem("pwa-no-sw") === "1";
    } catch {
        return false;
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
