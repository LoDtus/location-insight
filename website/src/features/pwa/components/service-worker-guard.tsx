"use client";

import { useEffect } from "react";

import { removeDisabledServiceWorker } from "@/features/pwa/pwa-client";

/**
 * Chạy ở mọi trang (gắn trong layout gốc). PwaProvider chỉ có ở /app và /admin, nên nếu không có component này
 * thì worker cũ còn sót trên trang landing sẽ tiếp tục phục vụ mã cũ khi đang phát triển.
 * Gỡ xong thì tải lại một lần để lấy mã mới thay cho bản vừa lấy từ cache.
 */
export default function ServiceWorkerGuard(): null {
    useEffect(() => {
        void removeDisabledServiceWorker()
            .then((removed) => {
                if (!removed) return;
                try {
                    if (sessionStorage.getItem("sw-guard-reloaded") === "1") return;
                    sessionStorage.setItem("sw-guard-reloaded", "1");
                } catch {
                    return;
                }
                window.location.reload();
            })
            .catch(() => undefined);
    }, []);
    return null;
}
