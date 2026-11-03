"use client";

import { useSyncExternalStore } from "react";

/** Theo dõi một media query; phía máy chủ luôn trả false để tránh lệch khi hydrate. */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (notify) => {
            const list = window.matchMedia(query);
            list.addEventListener("change", notify);
            return () => list.removeEventListener("change", notify);
        },
        () => window.matchMedia(query).matches,
        () => false,
    );
}
