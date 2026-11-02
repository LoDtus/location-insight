"use client";

import { useSyncExternalStore } from "react";

const serverSnapshot = { count: 0, capped: false };
let snapshot = serverSnapshot;
const listeners = new Set<() => void>();

export function notificationUnread(): { count: number; capped: boolean } {
    return snapshot;
}

export function setNotificationUnread(count: number, nextCapped = false): void {
    if (snapshot.count === count && snapshot.capped === nextCapped) return;
    snapshot = { count, capped: nextCapped };
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useNotificationUnread(): { count: number; capped: boolean } {
    return useSyncExternalStore(subscribe, notificationUnread, () => serverSnapshot);
}
