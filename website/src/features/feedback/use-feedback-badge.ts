"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/features/auth/use-auth";

import { getOpenCount, getUnreadReplies } from "./feedback.api";

const REFRESH_MS = 60_000;

/** Số góp ý cần chú ý: với người dùng là trả lời chưa đọc, với admin là góp ý đang chờ trả lời. */
export function useFeedbackBadge(surface: "app" | "admin"): number {
    const auth = useAuth();
    const pathname = usePathname();
    const [count, setCount] = useState(0);
    const ready = auth.status === "authenticated";

    useEffect(() => {
        if (!ready) return;
        let active = true;
        const load = (): void => {
            const request = surface === "admin" ? getOpenCount() : getUnreadReplies();
            request
                .then((result) => {
                    if (active) setCount(result.count);
                })
                .catch(() => undefined);
        };
        load();
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") load();
        }, REFRESH_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [ready, surface, pathname]);

    return count;
}
