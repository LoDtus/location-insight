const worker = self as unknown as ServiceWorkerGlobalScope;

const BUILD_ID = "__BUILD_ID__";
const CACHE_NAME = `static-${BUILD_ID}`;
/**
 * Bản build cho `next dev`: worker tự xóa cache và tự gỡ đăng ký. Next dev đặt tên chunk không kèm mã băm,
 * nên một worker cache-first còn sót sẽ phục vụ mãi mã cũ ở mọi trang (kể cả trang không gắn PwaProvider).
 */
const DEV_SELF_DESTRUCT_FLAG: string = "__DEV_SELF_DESTRUCT__";
const DEV_SELF_DESTRUCT = DEV_SELF_DESTRUCT_FLAG === "true";
const DB_NAME = "diathe-pwa";
const DB_STORE = "flags";

worker.addEventListener("install", (event) => {
    if (DEV_SELF_DESTRUCT) {
        event.waitUntil(worker.skipWaiting());
        return;
    }
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_PATH).catch(() => undefined)));
});

worker.addEventListener("activate", (event) => {
    if (DEV_SELF_DESTRUCT) {
        event.waitUntil(
            (async () => {
                const keys = await caches.keys();
                await Promise.all(keys.map((key) => caches.delete(key)));
                await worker.registration.unregister();
                const windows = await worker.clients.matchAll({ type: "window" });
                for (const client of windows) void (client as WindowClient).navigate(client.url);
            })(),
        );
        return;
    }
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(keys.filter((key) => key.startsWith("static-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
            await worker.clients.claim();
        })(),
    );
});

worker.addEventListener("message", (event) => {
    const data = event.data as { type?: string; count?: number } | null;
    if (!data || typeof data.type !== "string") return;
    if (data.type === "SKIP_WAITING") {
        event.waitUntil(worker.skipWaiting());
        return;
    }
    if (data.type === "LOGOUT") {
        event.waitUntil(clearPrivateState());
        return;
    }
    if (data.type === "BADGE") {
        event.waitUntil(applyBadge(typeof data.count === "number" ? data.count : 0));
    }
});

worker.addEventListener("fetch", (event) => {
    if (DEV_SELF_DESTRUCT) return;
    const request = event.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin !== worker.location.origin) return;
    if (request.headers.has("range")) return;
    if (url.pathname.startsWith("/api/")) return;

    if (request.mode === "navigate") {
        event.respondWith(networkOrOffline(request));
        return;
    }

    if (!isStaticAsset(url.pathname)) return;
    event.respondWith(cacheFirst(request));
});

worker.addEventListener("push", (event) => {
    event.waitUntil(showPush(event));
});

worker.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const data = event.notification.data as { id?: string; url?: string } | null;
    const target = withNotificationId(notificationTarget(data?.url, worker.location.origin), data?.id);
    event.waitUntil(openOrFocus(target, data?.id));
});

worker.addEventListener("notificationclose", () => {
    /* Không theo dõi nội dung đã đóng. */
});

worker.addEventListener("pushsubscriptionchange", (event) => {
    event.waitUntil(markResubscribe());
});

async function showPush(event: PushEvent): Promise<void> {
    const raw = event.data ? event.data.text() : "";
    const view = raw ? parsePushPayload(raw, worker.location.origin) : genericFallback();
    const options: NotificationOptions & { timestamp?: number; renotify?: boolean } = {
        body: view.body,
        icon: view.icon,
        badge: view.badge,
        tag: view.tag,
        timestamp: view.timestamp,
        renotify: view.renotify,
        data: { id: view.id, url: view.url },
        requireInteraction: false,
        silent: false,
    };
    await worker.registration.showNotification(view.title, options);
    const windows = await worker.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (typeof view.unread === "number") await applyBadge(view.unread);
    else if (windows.length === 0) await bumpBadge();
    for (const client of windows) {
        client.postMessage({ type: "push-received", id: view.id, pushType: view.type });
    }
}

async function openOrFocus(url: string, id: string | undefined): Promise<void> {
    const windows = await worker.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === worker.location.origin);
    if (existing) {
        await existing.focus();
        existing.postMessage({ type: "navigate", url, id });
        return;
    }
    await worker.clients.openWindow(url);
}

async function networkOrOffline(request: Request): Promise<Response> {
    try {
        return await fetch(request);
    } catch {
        const cached = await caches.match(OFFLINE_PATH);
        if (cached) return cached;
        return new Response("Không có kết nối", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
        });
    }
}

async function cacheFirst(request: Request): Promise<Response> {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (!response.ok || responseIsPrivate(response.headers) || !(await underCacheLimit())) return response;
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
        return response;
    } catch {
        return new Response("", { status: 504 });
    }
}

async function underCacheLimit(): Promise<boolean> {
    if (!worker.navigator.storage?.estimate) return true;
    const estimate = await worker.navigator.storage.estimate();
    return (estimate.usage ?? 0) < CACHE_LIMIT_BYTES;
}

async function clearPrivateState(): Promise<void> {
    const notes = await worker.registration.getNotifications();
    for (const note of notes) note.close();
    await applyBadge(0);
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("private-")).map((key) => caches.delete(key)));
}

async function applyBadge(count: number): Promise<void> {
    const nav = worker.navigator as WorkerNavigator & {
        setAppBadge?: (contents?: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
    };
    if (count > 0 && nav.setAppBadge) {
        await nav.setAppBadge(count);
        return;
    }
    if (nav.clearAppBadge) await nav.clearAppBadge();
}

async function bumpBadge(): Promise<void> {
    const current = await readFlag("badge");
    const next = (typeof current === "number" ? current : 0) + 1;
    await writeFlag("badge", next);
    await applyBadge(next);
}

async function markResubscribe(): Promise<void> {
    await writeFlag("resubscribe", 1);
    const windows = await worker.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: "resubscribe" });
}

function genericFallback(): PushView {
    return parsePushPayload("{}", worker.location.origin);
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function writeFlag(key: string, value: number): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function readFlag(key: string): Promise<number | undefined> {
    const db = await openDb();
    const value = await new Promise<number | undefined>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readonly");
        const request = tx.objectStore(DB_STORE).get(key);
        request.onsuccess = () => resolve(typeof request.result === "number" ? request.result : undefined);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
}
