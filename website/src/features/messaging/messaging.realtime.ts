import { io, type Socket } from "socket.io-client";

import { AuthApiError, apiRequest } from "@/features/auth/auth.api";

import type { RealtimeStatus } from "./messaging.types";

const SOCKET_PATH = "/api/v1/ws";
const PING_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;

export const SERVER_EVENTS = [
    "message.created",
    "message.updated",
    "reaction.changed",
    "conversation.read",
    "conversation.updated",
    "typing",
    "unread.changed",
] as const;

export type ServerEvent = (typeof SERVER_EVENTS)[number];

export interface RealtimeHandlers {
    onStatus: (status: RealtimeStatus) => void;
    onOpen: () => void;
    onEvent: (name: ServerEvent, payload: unknown) => void;
}

/** Next không proxy WebSocket: ở dev nối thẳng cổng backend, ở production nginx chuyển /api/v1/ws về backend. */
export function realtimeUrl(): string {
    const configured = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (configured) return configured;
    const port = process.env.REALTIME_BACKEND_PORT;
    if (port) return `${window.location.protocol}//${window.location.hostname}:${port}`;
    return window.location.origin;
}

export function backoffMs(attempt: number, random: number = Math.random()): number {
    const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
    return Math.round(base * (0.8 + random * 0.4));
}

/**
 * Một kết nối cho mỗi tab. Vé chỉ dùng được một lần nên tự nối lại bằng vé mới
 * (không dùng cơ chế reconnect của Socket.IO).
 */
export class RealtimeClient {
    private socket: Socket | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private attempt = 0;
    private stopped = true;
    private closeCode: number | null = null;
    /** Tăng mỗi lần start/stop: kết nối đang chờ vé của lượt cũ phải tự bỏ. */
    private generation = 0;
    private handlers: RealtimeHandlers | null = null;
    private readonly wake = (): void => {
        if (this.stopped || this.socket?.connected) return;
        if (document.visibilityState === "hidden") return;
        this.clearTimer();
        void this.connect();
    };

    start(handlers: RealtimeHandlers): void {
        if (!this.stopped) return;
        this.stopped = false;
        this.generation += 1;
        this.handlers = handlers;
        document.addEventListener("visibilitychange", this.wake);
        window.addEventListener("online", this.wake);
        void this.connect();
    }

    stop(): void {
        this.stopped = true;
        this.generation += 1;
        document.removeEventListener("visibilitychange", this.wake);
        window.removeEventListener("online", this.wake);
        this.clearTimer();
        this.stopPing();
        this.socket?.removeAllListeners();
        this.socket?.close();
        this.socket = null;
        this.handlers?.onStatus("idle");
        this.handlers = null;
    }

    get connected(): boolean {
        return Boolean(this.socket?.connected);
    }

    sendTyping(conversationId: string, active: boolean): void {
        if (this.socket?.connected) this.socket.emit("typing", { conversationId, active });
    }

    private async connect(): Promise<void> {
        if (this.stopped) return;
        const generation = this.generation;
        this.handlers?.onStatus("connecting");
        this.closeCode = null;
        let ticket: string;
        try {
            const result = await apiRequest<{ ticket: string }>("/realtime/ticket", { method: "POST" });
            ticket = result.ticket;
        } catch (error) {
            if (generation !== this.generation) return;
            if (error instanceof AuthApiError && (error.status === 401 || error.status === 403)) {
                this.stopped = true;
                this.handlers?.onStatus("offline");
                return;
            }
            this.schedule();
            return;
        }
        if (this.stopped || generation !== this.generation) return;

        const socket = io(realtimeUrl(), {
            path: SOCKET_PATH,
            transports: ["websocket"],
            query: { ticket },
            reconnection: false,
        });
        this.socket = socket;
        socket.on("connect", () => {
            this.attempt = 0;
            this.handlers?.onStatus("online");
            this.startPing();
            this.emitPresence();
            this.handlers?.onOpen();
        });
        socket.on("realtime.close", (payload: { code?: number }) => {
            this.closeCode = payload.code ?? null;
        });
        socket.on("session.revoked", () => {
            this.closeCode = 4401;
        });
        socket.on("disconnect", () => this.lost());
        socket.on("connect_error", () => this.lost());
        for (const name of SERVER_EVENTS) {
            socket.on(name, (payload: unknown) => this.handlers?.onEvent(name, payload));
        }
        for (const name of ["notification.created", "notification.changed"] as const) {
            socket.on(name, (payload: unknown) => {
                window.dispatchEvent(new CustomEvent("notification:event", { detail: { name, payload } }));
            });
        }
    }

    private lost(): void {
        this.stopPing();
        this.socket?.removeAllListeners();
        this.socket?.close();
        this.socket = null;
        if (this.stopped) return;
        this.handlers?.onStatus("offline");
        // 4401: phiên bị thu hồi, 4403: bị socket khác thay thế. Không tự nối lại.
        if (this.closeCode === 4401 || this.closeCode === 4403) {
            this.stopped = true;
            return;
        }
        this.schedule(this.closeCode === 4429 ? 60_000 : undefined);
    }

    private schedule(delay?: number): void {
        if (this.stopped) return;
        this.clearTimer();
        const wait = delay ?? backoffMs(this.attempt);
        this.attempt += 1;
        this.timer = setTimeout(() => {
            void this.connect();
        }, wait);
    }

    private clearTimer(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    private startPing(): void {
        this.stopPing();
        this.pingTimer = setInterval(() => {
            this.socket?.emit("ping");
            this.emitPresence();
        }, PING_MS);
    }

    private emitPresence(): void {
        this.socket?.emit("presence.visible", { type: "presence.visible", visible: document.visibilityState === "visible" });
    }

    private stopPing(): void {
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = null;
    }
}

export const realtime = new RealtimeClient();
