import type { JSX } from "react";

import { OfflineRetry } from "@/features/pwa/components/offline-retry";

export default function OfflinePage(): JSX.Element {
    return (
        <main className="flex h-full flex-col items-center justify-center gap-4 bg-cream px-6 text-center text-charcoal">
            {/* Ảnh tĩnh, không qua bộ tối ưu, để trang vẫn hiện khi mất mạng. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/diathe.svg" alt="" width={48} height={48} />
            <h1 className="m-0 text-2xl font-semibold">Không có kết nối</h1>
            <p className="m-0 max-w-sm text-sm text-charcoal/75">
                Địa Thế cần mạng để tải dữ liệu. Hãy kiểm tra kết nối rồi thử lại.
            </p>
            <OfflineRetry />
        </main>
    );
}
