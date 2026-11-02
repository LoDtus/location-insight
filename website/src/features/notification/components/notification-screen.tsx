"use client";

import { Bell, Settings } from "lucide-react";
import { useEffect, useState, type JSX } from "react";

import { listNotifications, markReadAll, type NotificationItem } from "@/features/notification/notification.api";
import { setNotificationUnread, useNotificationUnread } from "@/features/notification/notification-badge";
import { NotificationItemRow } from "@/features/notification/components/notification-item";
import { NotificationSettings } from "@/features/notification/components/notification-settings";

export function NotificationScreen(): JSX.Element {
    const badge = useNotificationUnread();
    const [filter, setFilter] = useState<"all" | "unread">("all");
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [settings, setSettings] = useState(false);
    const [undo, setUndo] = useState<NotificationItem | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [offer, setOffer] = useState(false);

    async function load(nextFilter: "all" | "unread", nextCursor?: string | null): Promise<void> {
        setLoading(true);
        setError("");
        try {
            const page = await listNotifications(nextFilter, nextCursor);
            setItems((current) => (nextCursor ? [...current, ...page.items] : page.items).slice(0, 200));
            setCursor(page.nextCursor);
        } catch {
            setError("Không tải được thông báo. Hãy thử lại.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load(filter);
    }, [filter]);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        try {
            setOffer(localStorage.getItem("notification-push-later") !== "1");
        } catch {
            setOffer(true);
        }
        function onCreated(event: Event): void {
            const item = (event as CustomEvent<NotificationItem>).detail;
            if (!item) return;
            setItems((current) => [item, ...current.filter((row) => row.id !== item.id)].slice(0, 200));
        }
        window.addEventListener("notification:created", onCreated);
        return () => window.removeEventListener("notification:created", onCreated);
    }, []);

    function replace(next: NotificationItem | null, removed?: NotificationItem): void {
        if (removed) {
            setItems((current) => current.filter((row) => row.id !== removed.id));
            setUndo(removed);
            window.setTimeout(() => setUndo((current) => (current?.id === removed.id ? null : current)), 5000);
            if (!removed.readAt) setNotificationUnread(Math.max(0, badge.count - 1), badge.capped);
            return;
        }
        if (!next) return;
        setItems((current) => current.map((row) => (row.id === next.id ? next : row)));
    }

    return (
        <main className="h-full overflow-auto bg-white">
            <div className="mx-auto box-border flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-8">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="m-0 text-2xl font-semibold">Thông báo</h1>
                    <button
                        type="button"
                        className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-green disabled:opacity-40"
                        disabled={badge.count === 0}
                        onClick={() => {
                            const upToId = items[0]?.id;
                            setNotificationUnread(0, false);
                            setItems((current) => current.map((row) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() })));
                            void markReadAll(upToId).catch(() => void load(filter));
                        }}
                    >
                        Đánh dấu tất cả đã đọc
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${filter === "all" ? "bg-green text-cream" : ""}`} onClick={() => setFilter("all")}>
                        Tất cả
                    </button>
                    <button type="button" className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${filter === "unread" ? "bg-green text-cream" : ""}`} onClick={() => setFilter("unread")}>
                        Chưa đọc {badge.count > 0 ? badge.count : ""}
                    </button>
                    <button type="button" className="ml-auto inline-flex size-11 items-center justify-center rounded-full hover:bg-cream" aria-label="Cài đặt thông báo" onClick={() => setSettings(true)}>
                        <Settings className="size-5" aria-hidden="true" />
                    </button>
                </div>
                {offer && typeof Notification !== "undefined" && Notification.permission === "default" ? (
                    <aside className="rounded-2xl border border-charcoal/10 bg-cream/40 p-4 text-sm">
                        <p className="m-0">Bật thông báo đẩy để nhận tin khi Địa Thế không mở.</p>
                        <button type="button" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-green px-4 font-semibold text-cream" onClick={() => setSettings(true)}>
                            Bật thông báo đẩy
                        </button>
                        <button
                            type="button"
                            className="ml-2 inline-flex min-h-11 items-center px-3"
                            onClick={() => {
                                try {
                                    localStorage.setItem("notification-push-later", "1");
                                } catch {
                                    /* Bộ nhớ riêng tư có thể chặn. */
                                }
                                setOffer(false);
                            }}
                        >
                            Để sau
                        </button>
                    </aside>
                ) : null}
                {loading && items.length === 0 ? <p aria-busy="true">Đang tải thông báo…</p> : null}
                {error ? <p role="alert">{error} <button type="button" className="font-semibold text-green" onClick={() => void load(filter)}>Thử lại</button></p> : null}
                {!loading && items.length === 0 ? (
                    <div className="py-16 text-center">
                        <Bell className="mx-auto size-10 text-charcoal/30" aria-hidden="true" />
                        <p className="mt-3 font-semibold">{filter === "unread" ? "Bạn đã xem hết rồi" : "Chưa có thông báo"}</p>
                        {filter === "all" ? <p className="text-sm text-charcoal/70">Chúng tôi sẽ báo khi có điều mới.</p> : null}
                    </div>
                ) : (
                    <ul className="m-0 grid list-none gap-1 p-0">
                        {items.map((item) => (
                            <NotificationItemRow key={item.id} item={item} now={now} onChange={replace} />
                        ))}
                    </ul>
                )}
                {cursor ? (
                    <button type="button" className="inline-flex min-h-11 items-center self-center rounded-full px-4 font-semibold" onClick={() => void load(filter, cursor)}>
                        Tải thêm
                    </button>
                ) : null}
                {undo ? (
                    <p role="status" className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-charcoal px-4 py-3 text-sm text-cream">
                        Đã xóa
                        <button type="button" className="ml-3 font-semibold underline" onClick={() => { setItems((current) => [undo, ...current]); setUndo(null); }}>
                            Hoàn tác
                        </button>
                    </p>
                ) : null}
            </div>
            {settings ? <NotificationSettings onClose={() => setSettings(false)} /> : null}
        </main>
    );
}
