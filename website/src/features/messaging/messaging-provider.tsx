"use client";

import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/features/auth/use-auth";
import { NotificationProvider } from "@/features/notification/components/notification-provider";

import { resync, startMessaging, stopMessaging } from "./messaging.actions";
import { useMessagingState } from "./messaging.store";

const POLL_MS = 20_000;

/** Giữ một kết nối realtime cho cả khu /app, kèm thăm dò định kỳ khi socket không dùng được. */
export function MessagingProvider({ children }: { children: ReactNode }) {
    const auth = useAuth();
    const userId = auth.user?.userId ?? null;
    const enabled = auth.status === "authenticated";
    const status = useMessagingState((state) => state.realtime);

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

    return <NotificationProvider>{children}</NotificationProvider>;
}

export function useUnreadBadge(): number {
    const inbox = useMessagingState((state) => state.unread.inbox);
    const requests = useMessagingState((state) => state.unread.requests);
    return inbox + requests;
}
