"use client";

import { useEffect, useState, type JSX } from "react";

export function OfflineBar(): JSX.Element | null {
    const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
    const [restored, setRestored] = useState(false);

    useEffect(() => {
        function onOffline(): void {
            setRestored(false);
            setOffline(true);
        }
        function onOnline(): void {
            setOffline(false);
            setRestored(true);
            window.setTimeout(() => setRestored(false), 2000);
        }
        window.addEventListener("offline", onOffline);
        window.addEventListener("online", onOnline);
        return () => {
            window.removeEventListener("offline", onOffline);
            window.removeEventListener("online", onOnline);
        };
    }, []);

    if (!offline && !restored) return null;
    return (
        <div
            role="status"
            className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[env(safe-area-inset-bottom)]"
        >
            <p className="mx-auto mb-3 max-w-lg rounded-full bg-charcoal px-4 py-3 text-center text-sm text-cream">
                {offline ? "Đang ngoại tuyến · một số chức năng tạm thời không dùng được" : "Đã kết nối lại"}
            </p>
        </div>
    );
}
