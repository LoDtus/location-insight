const SESSION_COUNT = "pwa-session-count";
const SESSION_MARK = "pwa-session-marked";
const INSTALL_LATER = "pwa-install-later";
const SAW_NOTIFICATION = "pwa-saw-notification";
const DEVICE_ID = "notification-device-id";
const LATER_MS = 30 * 24 * 60 * 60 * 1000;

function readStorage(storage: Storage, key: string): string | null {
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(storage: Storage, key: string, value: string): void {
    try {
        storage.setItem(key, value);
    } catch {
        /* Bộ nhớ riêng tư có thể chặn. */
    }
}

export function noteSession(): number {
    if (typeof window === "undefined") return 0;
    if (!readStorage(window.sessionStorage, SESSION_MARK)) {
        writeStorage(window.sessionStorage, SESSION_MARK, "1");
        const next = Number(readStorage(window.localStorage, SESSION_COUNT) ?? "0") + 1;
        writeStorage(window.localStorage, SESSION_COUNT, String(next));
    }
    return Number(readStorage(window.localStorage, SESSION_COUNT) ?? "0");
}

export function noteNotificationVisit(pathname: string): void {
    if (!pathname.includes("/notification")) return;
    writeStorage(window.localStorage, SAW_NOTIFICATION, "1");
}

export function installLater(): void {
    writeStorage(window.localStorage, INSTALL_LATER, String(Date.now()));
}

export function installAllowed(now = Date.now()): boolean {
    const raw = readStorage(window.localStorage, INSTALL_LATER);
    if (!raw) return true;
    const at = Number(raw);
    if (!Number.isFinite(at)) return true;
    return now - at > LATER_MS;
}

export function installEligible(): boolean {
    const sessions = Number(readStorage(window.localStorage, SESSION_COUNT) ?? "0");
    const saw = readStorage(window.localStorage, SAW_NOTIFICATION) === "1";
    return installAllowed() && (sessions >= 2 || saw);
}

export function standaloneDisplay(): boolean {
    if (typeof window === "undefined") return false;
    const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    return ios || window.matchMedia("(display-mode: standalone)").matches;
}

/** Điện thoại và máy tính bảng. Laptop, PC không hiện nút cài ứng dụng. */
export function isHandheld(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    if (/Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
    if (/iPad/.test(ua)) return true;
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function needsInstallGuide(): boolean {
    return isHandheld() && /iPad|iPhone|iPod|Mac/.test(navigator.userAgent + navigator.platform);
}

export function deviceId(): string {
    const current = readStorage(window.localStorage, DEVICE_ID);
    if (current) return current;
    const next = crypto.randomUUID();
    writeStorage(window.localStorage, DEVICE_ID, next);
    return next;
}

export function isSecureEnough(): boolean {
    return window.isSecureContext;
}

export function shouldRegisterHere(pathname: string): boolean {
    return pathname === "/app" || pathname.startsWith("/app/") || pathname === "/admin" || pathname.startsWith("/admin/");
}
