"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type JSX } from "react";

import { dismissToast, getServerToasts, getToasts, subscribeToasts, type ToastItem, type ToastTone } from "@/shared/components/toast/toast-store";

const ICON: Record<ToastTone, JSX.Element> = {
    success: <CheckCircle2 size={18} className="text-green" aria-hidden />,
    info: <Info size={18} className="text-charcoal/70" aria-hidden />,
    error: <XCircle size={18} className="text-red-700" aria-hidden />,
};

function Toast({ item }: { item: ToastItem }): JSX.Element {
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (paused) return;
        const timer = window.setTimeout(() => dismissToast(item.id), item.duration);
        return () => window.clearTimeout(timer);
    }, [item.id, item.duration, paused]);

    return (
        <li
            role={item.tone === "error" ? "alert" : "status"}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className={`toast-enter pointer-events-auto flex w-full ${item.description ? "items-start" : "items-center"} gap-3 rounded-lg border border-charcoal/10 bg-white p-3 pr-2 text-charcoal shadow-[0_10px_30px_rgba(16,17,17,0.16)]`}
        >
            {/* Có mô tả: icon thẳng hàng với dòng tiêu đề; không có: căn giữa theo chiều dọc cùng tiêu đề và nút đóng. */}
            <span className={`flex shrink-0 ${item.description ? "mt-0.5" : ""}`}>{ICON[item.tone]}</span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.title}</span>
                {item.description ? <span className="mt-0.5 block text-sm text-charcoal/70">{item.description}</span> : null}
            </span>
            <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => dismissToast(item.id)}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-charcoal/55 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-green"
            >
                <X size={15} aria-hidden />
            </button>
        </li>
    );
}

/** Vùng hiển thị toast ở góc trên bên phải; tạm dừng tự ẩn khi rê chuột hoặc focus vào toast. */
export default function ToastViewport(): JSX.Element {
    const items = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);
    return (
        <ol
            aria-label="Thông báo"
            className="pointer-events-none fixed top-3 right-3 z-[90] m-0 flex w-[min(24rem,calc(100%-1.5rem))] list-none flex-col gap-2 p-0"
        >
            {items.map((item) => (
                <Toast key={item.id} item={item} />
            ))}
        </ol>
    );
}
