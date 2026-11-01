"use client";

import { useSyncExternalStore } from "react";

import { initialState } from "./messaging.reducers";
import type { MessagingState } from "./messaging.types";

type Listener = () => void;

/** Kho nhỏ dùng chung cho toàn ứng dụng: một nguồn trạng thái, nhiều người nghe qua useSyncExternalStore. */
class MessagingStore {
    private state: MessagingState = initialState();
    private readonly listeners = new Set<Listener>();

    getState = (): MessagingState => this.state;

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    update(change: (state: MessagingState) => MessagingState): void {
        const next = change(this.state);
        if (next === this.state) return;
        this.state = next;
        for (const listener of this.listeners) listener();
    }

    reset(): void {
        this.state = initialState();
        for (const listener of this.listeners) listener();
    }
}

export const messagingStore = new MessagingStore();
const SERVER_STATE = initialState();

export function useMessagingState<T>(selector: (state: MessagingState) => T): T {
    return useSyncExternalStore(
        messagingStore.subscribe,
        () => selector(messagingStore.getState()),
        () => selector(SERVER_STATE),
    );
}
