"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { activeSection, urlWithSection } from "@/features/articles/front-sections";

function reducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Khung cuộn của layout landing (`[data-scroll-root]`); trang đứng riêng thì là cửa sổ. */
function scrollRoot(node: HTMLElement): HTMLElement | null {
    return node.closest<HTMLElement>("[data-scroll-root]");
}

/**
 * Đồng bộ mục đang đọc với #hash trên URL và với thanh mục dính:
 * - Cuộn: mục có mép trên vượt vạch đọc (dưới thanh mục ~ 1/4 màn hình) thành mục hiện tại; URL đổi bằng
 *   `replaceState` (không thêm lịch sử, không bắn hashchange nên không giật trang).
 * - `sectionKey` là id các mục theo thứ tự trang, nối bằng dấu phẩy.
 * - Mở URL có #mục, đổi hash bằng tay, hoặc bấm liên kết mục: cuộn tới mục, chừa chỗ cho thanh mục dính.
 */
export function useSectionSpy<T extends string>(sectionKey: string, navRef: RefObject<HTMLElement | null>): { active: T | null; go: (id: T) => void } {
    const [active, setActive] = useState<T | null>(null);
    const current = useRef<T | null>(null);
    // Khi đang cuộn mượt tới một mục, bỏ qua cập nhật trung gian để thanh mục không nhấp nháy qua các mục ở giữa.
    const lockedUntil = useRef(0);

    const offset = useCallback((): number => (navRef.current?.getBoundingClientRect().height ?? 0) + 8, [navRef]);

    const scrollTo = useCallback(
        (id: string, behavior: ScrollBehavior): void => {
            const target = document.getElementById(id);
            if (!target) return;
            const root = scrollRoot(target);
            if (!root) {
                window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset(), behavior });
                return;
            }
            const top = target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - offset();
            root.scrollTo({ top, behavior });
        },
        [offset],
    );

    const go = useCallback(
        (id: T): void => {
            const smooth = !reducedMotion();
            lockedUntil.current = performance.now() + (smooth ? 900 : 0);
            scrollTo(id, smooth ? "smooth" : "instant");
            const url = urlWithSection(window.location.pathname, window.location.search, id);
            window.history.replaceState(window.history.state, "", url);
            current.current = id;
            setActive(id);
        },
        [scrollTo],
    );

    useEffect(() => {
        // `sectionKey`: id các mục nối bằng dấu phẩy, để effect chỉ chạy lại khi tập mục thật sự đổi.
        const ids = sectionKey.split(",").filter(Boolean) as T[];
        if (ids.length === 0) return;
        const first = document.getElementById(ids[0]);
        if (!first) return;
        const root = scrollRoot(first);
        const target: HTMLElement | Window = root ?? window;
        let frame = 0;

        const measure = (): void => {
            frame = 0;
            if (performance.now() < lockedUntil.current) {
                schedule();
                return;
            }
            const base = root ? root.getBoundingClientRect().top : 0;
            const height = root ? root.clientHeight : window.innerHeight;
            const tops = ids.map((id) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) - base);
            const next = activeSection(ids, tops, offset() + height * 0.25);
            if (next === current.current) return;
            current.current = next;
            setActive(next);
            const url = urlWithSection(window.location.pathname, window.location.search, next);
            if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
                window.history.replaceState(window.history.state, "", url);
            }
        };
        const schedule = (): void => {
            if (!frame) frame = requestAnimationFrame(measure);
        };

        const fromHash = (behavior: ScrollBehavior): void => {
            const id = decodeURIComponent(window.location.hash.slice(1));
            if (!ids.includes(id as T)) return;
            lockedUntil.current = performance.now() + (behavior === "smooth" ? 900 : 0);
            current.current = id as T;
            setActive(id as T);
            scrollTo(id, behavior);
        };

        // Mở trang bằng liên kết có #mục: đợi khung hình đầu (ảnh, font) rồi cuộn tức thì.
        const initial = requestAnimationFrame(() => {
            fromHash("instant");
            schedule();
        });
        const onHash = (): void => fromHash(reducedMotion() ? "instant" : "smooth");
        target.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        window.addEventListener("hashchange", onHash);
        return () => {
            cancelAnimationFrame(initial);
            if (frame) cancelAnimationFrame(frame);
            target.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            window.removeEventListener("hashchange", onHash);
        };
    }, [sectionKey, offset, scrollTo]);

    return { active, go };
}
