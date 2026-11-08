"use client";

import { useCallback, useRef, useState } from "react";

import { listHomeSection } from "@/features/articles/articles.api";
import type { ArticleCard, HomeSection } from "@/features/articles/articles";

export type PagedSection = {
    items: ArticleCard[];
    page: number;
    pages: number;
    pageSize: number;
    /** Trang đang tải (null nếu không tải). */
    loading: number | null;
    error: boolean;
    goTo: (page: number) => void;
    /** Tải trước một trang (rê chuột vào nút) để bấm là hiện ngay. */
    prefetch: (page: number) => void;
};

/**
 * Phân trang một mục của /bai-viet ngay trong trang (không đổi URL, không rời mục): trang 1 có sẵn từ máy chủ, các trang
 * sau tải khi bấm và giữ trong bộ nhớ; đang tải thì vẫn hiện trang cũ (mờ đi) để bố cục không nhảy.
 */
export function usePagedSection(
    section: HomeSection,
    initial: ArticleCard[],
    paging: { total: number; pageSize: number } | undefined,
    onPageShown?: () => void,
): PagedSection {
    const pageSize = paging?.pageSize ?? Math.max(1, initial.length);
    const [total, setTotal] = useState(paging?.total ?? initial.length);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const cache = useRef(new Map<number, Promise<ArticleCard[]>>([[1, Promise.resolve(initial)]]));
    const [state, setState] = useState<{ page: number; items: ArticleCard[] }>({ page: 1, items: initial });
    const [loading, setLoading] = useState<number | null>(null);
    const [error, setError] = useState(false);
    const latest = useRef(0);

    const load = useCallback(
        (page: number): Promise<ArticleCard[]> => {
            const hit = cache.current.get(page);
            if (hit) return hit;
            const request = listHomeSection(section, page).then((result) => {
                setTotal(result.total);
                return result.items;
            });
            cache.current.set(page, request);
            request.catch(() => cache.current.delete(page));
            return request;
        },
        [section],
    );

    const goTo = useCallback(
        (page: number): void => {
            if (page < 1 || page > pages) return;
            const ticket = ++latest.current;
            setLoading(page);
            setError(false);
            load(page)
                .then((items) => {
                    if (ticket !== latest.current) return;
                    setState({ page, items });
                    onPageShown?.();
                })
                .catch(() => {
                    if (ticket === latest.current) setError(true);
                })
                .finally(() => {
                    if (ticket === latest.current) setLoading(null);
                });
        },
        [load, pages, onPageShown],
    );

    const prefetch = useCallback(
        (page: number): void => {
            if (page >= 1 && page <= pages) load(page).catch(() => undefined);
        },
        [load, pages],
    );

    return { items: state.items, page: state.page, pages, pageSize, loading, error, goTo, prefetch };
}
