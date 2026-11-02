"use client";

import {
    AtSign,
    BadgeCheck,
    Bell,
    CircleCheck,
    CircleX,
    Clock,
    Flag,
    Inbox,
    KeyRound,
    Megaphone,
    MessageCircle,
    MessageSquareHeart,
    MessagesSquare,
    Scale,
    ShieldAlert,
    TriangleAlert,
    UserPlus,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type JSX } from "react";

import { markRead, markUnread, removeNotification, type NotificationItem } from "@/features/notification/notification.api";
import { absoluteTime, relativeTime, safeLink } from "@/features/notification/notification-link";

const ICONS: Record<string, LucideIcon> = {
    "user-plus": UserPlus,
    "message-circle": MessageCircle,
    "at-sign": AtSign,
    "messages-square": MessagesSquare,
    "badge-check": BadgeCheck,
    "triangle-alert": TriangleAlert,
    clock: Clock,
    "circle-check": CircleCheck,
    "circle-x": CircleX,
    "message-square-heart": MessageSquareHeart,
    "shield-alert": ShieldAlert,
    "key-round": KeyRound,
    flag: Flag,
    inbox: Inbox,
    scale: Scale,
    megaphone: Megaphone,
    bell: Bell,
};

const TONE: Record<NotificationItem["tone"], string> = {
    neutral: "bg-charcoal/10 text-charcoal",
    info: "bg-green/10 text-green",
    success: "bg-green/15 text-green",
    warning: "bg-gold/30 text-charcoal",
    danger: "bg-red-100 text-red-800",
};

export function NotificationItemRow({
    item,
    now,
    onChange,
}: {
    item: NotificationItem;
    now: number;
    onChange: (next: NotificationItem | null, undo?: NotificationItem) => void;
}): JSX.Element {
    const Icon = ICONS[item.icon] ?? Bell;
    const href = safeLink(item.link) ?? "/app/notification";
    const [menu, setMenu] = useState(false);
    const unread = !item.readAt;

    useEffect(() => {
        if (!menu) return;
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") setMenu(false);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [menu]);

    return (
        <li className={`relative flex items-start gap-3 rounded-2xl px-3 py-3 ${unread ? "bg-green/5" : "bg-white"}`}>
            {unread ? <span className="mt-4 size-2 shrink-0 rounded-full bg-green" aria-hidden="true" /> : <span className="mt-4 size-2 shrink-0" />}
            <span className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-full ${TONE[item.tone]}`}>
                <Icon className="size-5" aria-hidden="true" />
            </span>
            <Link
                href={href}
                className="min-w-0 flex-1 text-inherit no-underline focus-visible:outline-2 focus-visible:outline-green"
                onClick={() => {
                    if (unread) {
                        onChange({ ...item, readAt: new Date().toISOString() });
                        void markRead(item.id).catch(() => onChange(item));
                    }
                }}
            >
                <span className={`block truncate ${unread ? "font-semibold" : ""}`}>{item.title}</span>
                <span className="sr-only">{unread ? "Chưa đọc" : "Đã đọc"}</span>
                {item.subtitle ? <span className="mt-0.5 line-clamp-2 block text-sm text-charcoal/70">{item.subtitle}</span> : null}
                <time className="mt-1 block text-xs text-charcoal/60" dateTime={item.createdAt} title={absoluteTime(item.createdAt)}>
                    {relativeTime(item.createdAt, now)}
                </time>
            </Link>
            <div className="relative">
                <button
                    type="button"
                    className="inline-flex size-11 items-center justify-center rounded-full hover:bg-cream focus-visible:outline-2 focus-visible:outline-green"
                    aria-label="Thao tác thông báo"
                    aria-haspopup="menu"
                    aria-expanded={menu}
                    onClick={() => setMenu((open) => !open)}
                >
                    ⋯
                </button>
                {menu ? (
                    <div role="menu" className="absolute right-0 z-10 w-48 rounded-xl border border-charcoal/15 bg-white p-1 shadow-sm">
                        <button
                            type="button"
                            role="menuitem"
                            className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-cream"
                            onClick={() => {
                                setMenu(false);
                                if (unread) {
                                    onChange({ ...item, readAt: new Date().toISOString() });
                                    void markRead(item.id).catch(() => onChange(item));
                                } else {
                                    onChange({ ...item, readAt: null });
                                    void markUnread(item.id).catch(() => onChange(item));
                                }
                            }}
                        >
                            {unread ? "Đánh dấu đã đọc" : "Đánh dấu chưa đọc"}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-cream"
                            onClick={() => {
                                setMenu(false);
                                onChange(null, item);
                                window.setTimeout(() => void removeNotification(item.id).catch(() => onChange(item)), 5000);
                            }}
                        >
                            Xóa
                        </button>
                    </div>
                ) : null}
            </div>
        </li>
    );
}
