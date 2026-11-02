"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useAuth } from "@/features/auth/use-auth";
import { markRead, unreadCount, type NotificationItem } from "@/features/notification/notification.api";
import { setNotificationUnread, useNotificationUnread } from "@/features/notification/notification-badge";
import { safeLink } from "@/features/notification/notification-link";

export function NotificationProvider({ children }: { children: ReactNode }): ReactNode {
    const auth = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const badge = useNotificationUnread();
    const [toast, setToast] = useState<{ title: string; subtitle: string; link: string } | null>(null);
    const toastAt = useRef(0);
    const hiddenSince = useRef<number | null>(null);

    useEffect(() => {
        if (auth.status !== "authenticated") return;
        void unreadCount()
            .then((result) => setNotificationUnread(result.count, result.capped))
            .catch(() => undefined);
    }, [auth.status]);

    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get("n");
        if (!id) return;
        void markRead(id).catch(() => undefined);
    }, [pathname]);

    useEffect(() => {
        function onEvent(event: Event): void {
            const detail = (event as CustomEvent<{ name: string; payload: Record<string, unknown> }>).detail;
            if (!detail) return;
            if (detail.name === "notification.created") {
                const item = detail.payload.item as NotificationItem | undefined;
                const next = detail.payload.unread;
                if (typeof next === "number") setNotificationUnread(next, next >= 99);
                if (!item || item.type === "message.new") return;
                window.dispatchEvent(new CustomEvent("notification:created", { detail: item }));
                if (pathname.includes("/notification") || Date.now() - toastAt.current < 3000) return;
                toastAt.current = Date.now();
                setToast({ title: item.title, subtitle: item.subtitle ?? "", link: item.link });
            }
            if (detail.name === "notification.changed") {
                const next = detail.payload.unread;
                if (typeof next === "number") setNotificationUnread(next, next >= 99);
                window.dispatchEvent(new CustomEvent("notification:changed", { detail: detail.payload }));
            }
        }
        function onOpen(event: Event): void {
            const id = (event as CustomEvent<string>).detail;
            if (id) void markRead(id).catch(() => undefined);
        }
        window.addEventListener("notification:event", onEvent);
        window.addEventListener("notification:open", onOpen);
        return () => {
            window.removeEventListener("notification:event", onEvent);
            window.removeEventListener("notification:open", onOpen);
        };
    }, [pathname]);

    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), 6000);
        return () => window.clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
        const base = document.title.replace(/^\(\d+\+?\)\s/, "");
        function apply(): void {
            const hidden = document.visibilityState === "hidden";
            if (hidden && hiddenSince.current === null) hiddenSince.current = Date.now();
            if (!hidden && hiddenSince.current && Date.now() - hiddenSince.current > 30_000) {
                void unreadCount().then((result) => setNotificationUnread(result.count, result.capped)).catch(() => undefined);
            }
            if (!hidden) hiddenSince.current = null;
            document.title = badge.count > 0 && hidden ? `(${badge.capped ? "99+" : badge.count}) ${base}` : base;
        }
        apply();
        document.addEventListener("visibilitychange", apply);
        return () => document.removeEventListener("visibilitychange", apply);
    }, [badge.count, badge.capped]);

    return (
        <>
            {children}
            {toast ? (
                <button
                    type="button"
                    role="status"
                    className="fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-charcoal/15 bg-white p-4 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-green"
                    onClick={() => {
                        const link = safeLink(toast.link);
                        setToast(null);
                        if (link) router.push(link);
                    }}
                >
                    <span className="block text-sm font-semibold">{toast.title}</span>
                    {toast.subtitle ? <span className="mt-1 block text-sm text-charcoal/70">{toast.subtitle}</span> : null}
                </button>
            ) : null}
        </>
    );
}
