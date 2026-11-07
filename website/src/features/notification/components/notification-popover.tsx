"use client";

import { Bell, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type JSX } from "react";

import { NotificationItemRow } from "@/features/notification/components/notification-item";
import { listNotifications, markReadAll, type NotificationItem } from "@/features/notification/notification.api";
import { setNotificationUnread, useNotificationUnread } from "@/features/notification/notification-badge";

const PREVIEW = 10;

function badgeText(count: number, capped: boolean): string {
    return capped || count > 99 ? "99+" : String(count);
}

/**
 * Chuông thông báo trên header: bấm mở khung nổi với 10 thông báo mới nhất (đánh dấu đã đọc/chưa đọc, xóa như trang
 * Thông báo), "Đánh dấu tất cả đã đọc", lối tới cài đặt và trang đầy đủ. Thông báo mới (sự kiện notification:created
 * từ realtime) chèn vào đầu danh sách khi khung đang mở. Đóng khi bấm ra ngoài, Esc hoặc chuyển trang.
 */
export function NotificationPopover({ root, vi }: { root: "/app" | "/admin"; vi: boolean }): JSX.Element {
    const badge = useNotificationUnread();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [now, setNow] = useState(() => Date.now());
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();
    const [lastPath, setLastPath] = useState(pathname);

    // Chuyển trang (vd. bấm một thông báo) thì đóng khung.
    if (pathname !== lastPath) {
        setLastPath(pathname);
        if (open) setOpen(false);
    }

    const load = useCallback((): void => {
        setStatus("loading");
        listNotifications("all")
            .then((page) => {
                setItems(page.items.slice(0, PREVIEW));
                setStatus("ready");
            })
            .catch(() => setStatus("error"));
    }, []);

    function toggle(): void {
        setOpen((value) => {
            if (!value) {
                setNow(Date.now());
                load();
            }
            return !value;
        });
    }

    useEffect(() => {
        if (!open) return;
        const onPointer = (event: PointerEvent): void => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent): void => {
            if (event.key !== "Escape") return;
            setOpen(false);
            buttonRef.current?.focus();
        };
        const onCreated = (event: Event): void => {
            const item = (event as CustomEvent<NotificationItem>).detail;
            if (item) setItems((current) => [item, ...current.filter((row) => row.id !== item.id)].slice(0, PREVIEW));
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        window.addEventListener("notification:created", onCreated);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("notification:created", onCreated);
        };
    }, [open]);

    function replace(next: NotificationItem | null, removed?: NotificationItem): void {
        if (removed) {
            setItems((current) => current.filter((row) => row.id !== removed.id));
            if (!removed.readAt) setNotificationUnread(Math.max(0, badge.count - 1), badge.capped);
            return;
        }
        if (!next) return;
        setItems((current) => current.map((row) => (row.id === next.id ? next : row)));
        const before = items.find((row) => row.id === next.id);
        if (before && !before.readAt && next.readAt) setNotificationUnread(Math.max(0, badge.count - 1), badge.capped);
        if (before && before.readAt && !next.readAt) setNotificationUnread(badge.count + 1, badge.capped);
    }

    function readAll(): void {
        const upToId = items[0]?.id;
        setNotificationUnread(0, false);
        setItems((current) => current.map((row) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() })));
        void markReadAll(upToId).catch(load);
    }

    const label = vi ? "Thông báo" : "Notifications";
    const count = badge.count;
    return (
        <div ref={rootRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                title={label}
                aria-label={count > 0 ? `${label}, ${count} ${vi ? "chưa đọc" : "unread"}` : label}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={toggle}
                className={`relative inline-flex size-10 items-center justify-center rounded-full text-cream hover:bg-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${open ? "bg-cream/15" : ""}`}
            >
                <Bell size={20} aria-hidden />
                {count > 0 ? (
                    <span aria-hidden className="absolute -top-0.5 -right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 font-sans text-[10px] font-bold text-white ring-2 ring-header">
                        {badgeText(count, badge.capped)}
                    </span>
                ) : null}
            </button>
            {open ? (
                <div
                    id={panelId}
                    role="dialog"
                    aria-label={label}
                    className="fixed inset-x-2 top-16 z-[60] flex max-h-[min(36rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-2xl border border-charcoal/10 bg-white font-sans text-charcoal shadow-[0_20px_55px_rgba(16,17,17,0.18)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[26rem]"
                >
                    <div className="flex items-center justify-between gap-2 border-b border-charcoal/10 px-4 py-3">
                        <p className="m-0 text-base font-semibold">{label}</p>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={count === 0}
                                onClick={readAll}
                                className="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold text-green hover:bg-green/10 disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                                {vi ? "Đánh dấu tất cả đã đọc" : "Mark all as read"}
                            </button>
                            <Link
                                href={`${root}/settings`}
                                title={vi ? "Cài đặt thông báo" : "Notification settings"}
                                aria-label={vi ? "Cài đặt thông báo" : "Notification settings"}
                                className="inline-flex size-9 items-center justify-center rounded-full text-charcoal/70 hover:bg-charcoal/5"
                            >
                                <Settings size={17} aria-hidden />
                            </Link>
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                        {status === "loading" && items.length === 0 ? (
                            <p aria-busy="true" className="m-0 px-3 py-8 text-center text-sm text-charcoal/60">
                                {vi ? "Đang tải…" : "Loading…"}
                            </p>
                        ) : null}
                        {status === "error" ? (
                            <p role="alert" className="m-0 px-3 py-8 text-center text-sm">
                                {vi ? "Không tải được thông báo." : "Could not load notifications."}{" "}
                                <button type="button" className="font-semibold text-green" onClick={load}>
                                    {vi ? "Thử lại" : "Retry"}
                                </button>
                            </p>
                        ) : null}
                        {status === "ready" && items.length === 0 ? (
                            <div className="px-3 py-10 text-center">
                                <Bell className="mx-auto size-8 text-charcoal/30" aria-hidden />
                                <p className="m-0 mt-2 text-sm font-semibold">{vi ? "Chưa có thông báo" : "No notifications yet"}</p>
                            </div>
                        ) : null}
                        {items.length > 0 ? (
                            <ul className="m-0 grid list-none gap-0.5 p-0">
                                {items.map((item) => (
                                    <NotificationItemRow key={item.id} item={item} now={now} onChange={replace} />
                                ))}
                            </ul>
                        ) : null}
                    </div>
                    <Link
                        href={`${root}/notification`}
                        className="block border-t border-charcoal/10 px-4 py-3 text-center text-sm font-semibold text-green no-underline hover:bg-green/5"
                    >
                        {vi ? "Xem tất cả thông báo" : "See all notifications"}
                    </Link>
                </div>
            ) : null}
        </div>
    );
}
