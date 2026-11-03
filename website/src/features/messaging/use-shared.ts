"use client";

import { useEffect, useRef, useState } from "react";

import { errorText } from "./messaging.actions";
import { listShared, type SharedItem, type SharedKind } from "./messaging.api";

export interface SharedList<T> {
    items: T[];
    loading: boolean;
    loadingMore: boolean;
    error: string;
    hasMore: boolean;
    loadMore: () => void;
    reload: () => void;
}

/**
 * Danh sách ảnh, liên kết hoặc tệp đã gửi trong một hội thoại, mới nhất trước, phân trang theo con trỏ.
 * `version` đổi (có tin mới, tin bị thu hồi) thì tải lại trang đầu một cách âm thầm.
 */
export function useShared<K extends SharedKind>(
    conversationId: string,
    type: K,
    version: string,
    limit: number,
): SharedList<SharedItem<K>> {
    const [items, setItems] = useState<SharedItem<K>[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [hasMore, setHasMore] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const cursor = useRef<string | null>(null);
    /** Tăng mỗi lần tải lại trang đầu để bỏ kết quả của các yêu cầu cũ (kể cả "tải thêm" đang bay). */
    const epoch = useRef(0);

    useEffect(() => {
        epoch.current += 1;
        const mine = epoch.current;
        listShared(conversationId, type, { limit })
            .then((page) => {
                if (mine !== epoch.current) return;
                cursor.current = page.nextCursor;
                setItems(page.items);
                setHasMore(Boolean(page.nextCursor));
                setError("");
            })
            .catch((failure: unknown) => {
                if (mine === epoch.current) setError(errorText(failure, "Không tải được danh sách."));
            })
            .finally(() => {
                if (mine === epoch.current) setLoading(false);
            });
        return () => {
            // Đổi điều kiện hoặc gỡ component: yêu cầu đang bay không được ghi vào trạng thái nữa.
            epoch.current += 1;
        };
    }, [conversationId, type, limit, version, reloadKey]);

    function loadMore(): void {
        const next = cursor.current;
        if (!next || loadingMore) return;
        const mine = epoch.current;
        setLoadingMore(true);
        listShared(conversationId, type, { cursor: next, limit })
            .then((page) => {
                if (mine !== epoch.current) return;
                cursor.current = page.nextCursor;
                setItems((current) => [...current, ...page.items]);
                setHasMore(Boolean(page.nextCursor));
            })
            .catch((failure: unknown) => {
                if (mine === epoch.current) setError(errorText(failure, "Không tải thêm được."));
            })
            .finally(() => setLoadingMore(false));
    }

    function reload(): void {
        setLoading(true);
        setReloadKey((current) => current + 1);
    }

    return { items, loading, loadingMore, error, hasMore, loadMore, reload };
}
