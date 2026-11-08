"use client";

import { useEffect } from "react";

import { recordArticleView } from "@/features/articles/articles.api";

/** Ghi một lượt đọc khi mở bài (máy chủ tự khử trùng mỗi người/bài/ngày, bỏ bot). Bản xem trước của admin không ghi. */
export default function ArticleViewBeacon({ slug }: { slug: string }): null {
    useEffect(() => {
        // Đợi một nhịp để không tranh băng thông với phần tải đầu trang; lỗi mạng bỏ qua (lượt đọc không quan trọng bằng bài).
        const timer = window.setTimeout(() => {
            void recordArticleView(slug).catch(() => undefined);
        }, 1500);
        return () => window.clearTimeout(timer);
    }, [slug]);
    return null;
}
