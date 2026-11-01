"use client";

import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/features/auth/use-auth";

import { resync, startMessaging, stopMessaging } from "./messaging.actions";
import { useMessagingState } from "./messaging.store";

const POLL_MS = 20_000;

/** Giữ một kết nối realtime cho cả khu /app, kèm thăm dò định kỳ khi socket không dùng được. */
export function MessagingProvider({ children }: { children: ReactNode }) {
    const auth = useAuth();
    const userId = auth.user?.userId ?? null;
    const enabled = auth.status === "authenticated";
    const status = useMessagingState((state) => state.realtime);
    const inbox = useMessagingState((state) => state.unread.inbox);
    const requests = useMessagingState((state) => state.unread.requests);

    useEffect(() => {
        if (!enabled || !userId) return;
        startMessaging(userId);
        return () => {
            stopMessaging();
        };
    }, [enabled, userId]);

    useEffect(() => {
        if (!enabled || status === "online" || status === "idle") return;
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") void resync();
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [enabled, status]);

    useEffect(() => {
        const total = inbox + requests;
        const base = document.title.replace(/^\(\d+\+?\)\s/, "");
        function apply(): void {
            document.title = total > 0 && document.visibilityState === "hidden" ? `(${total}) ${base}` : base;
        }
        apply();
        document.addEventListener("visibilitychange", apply);
        return () => {
            document.removeEventListener("visibilitychange", apply);
            document.title = base;
        };
    }, [inbox, requests]);

    return children;
}

export function useUnreadBadge(): number {
    const inbox = useMessagingState((state) => state.unread.inbox);
    const requests = useMessagingState((state) => state.unread.requests);
    return inbox + requests;
}
