"use client";

import { useEffect, useState } from "react";

import { getAuthorPresence } from "@/features/discussions/discussions.api";

const REFRESH_MS = 60_000;

/**
 * Làm mới chấm trực tuyến của các tác giả đang hiện mỗi phút, chỉ khi tab đang mở (ẩn tab thì dừng, quay lại thì
 * làm mới ngay). Trả về null khi chưa làm mới lần nào: dùng `authorOnline` có sẵn trong bài.
 */
export function useAuthorPresence(authorIds: readonly string[]): Set<string> | null {
    const [online, setOnline] = useState<Set<string> | null>(null);
    const key = [...new Set(authorIds)].sort().join(",");

    useEffect(() => {
        if (!key) return;
        const ids = key.split(",");
        let controller: AbortController | null = null;
        const refresh = (): void => {
            if (document.visibilityState !== "visible") return;
            controller?.abort();
            controller = new AbortController();
            getAuthorPresence(ids, controller.signal)
                .then((result) => setOnline(new Set(result.online)))
                .catch(() => undefined);
        };
        const timer = setInterval(refresh, REFRESH_MS);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", refresh);
            controller?.abort();
        };
    }, [key]);

    return online;
}
