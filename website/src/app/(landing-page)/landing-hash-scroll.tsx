"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { LANDING_SECTIONS, LANDING_SECTION_EVENT, scrollToSection } from "@/features/landing-page/landing-sections";

export default function LandingHashScroll() {
    const pathname = usePathname();

    useEffect(() => {
        if (pathname !== "/") {
            return;
        }

        function scrollToHash(): void {
            const id = window.location.hash.slice(1);
            if (!id) {
                return;
            }

            const behavior = window.matchMedia(
                "(prefers-reduced-motion: reduce)",
            ).matches
                ? "auto"
                : "smooth";

            scrollToSection(id, behavior);
        }

        scrollToHash();
        window.addEventListener("hashchange", scrollToHash);
        window.addEventListener("popstate", scrollToHash);

        return () => {
            window.removeEventListener("hashchange", scrollToHash);
            window.removeEventListener("popstate", scrollToHash);
        };
    }, [pathname]);

    // Cuộn tới section nào thì URL đổi sang #section đó. replaceState không tạo mục lịch sử
    // và không bắn hashchange, nên không kéo trang cuộn lại.
    useEffect(() => {
        if (pathname !== "/") {
            return;
        }
        const nodes = LANDING_SECTIONS.map((id) => document.getElementById(id)).filter(
            (node): node is HTMLElement => node !== null,
        );
        if (nodes.length === 0) {
            return;
        }
        let current = "";
        const visible = new Map<string, number>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
                }
                // Section đầu tiên (theo thứ tự trang) đang chiếm dải giữa màn hình.
                const next = LANDING_SECTIONS.find((id) => (visible.get(id) ?? 0) > 0);
                if (!next || next === current) {
                    return;
                }
                current = next;
                const url = next === LANDING_SECTIONS[0] ? "/" : `/#${next}`;
                if (`${window.location.pathname}${window.location.hash}` !== url) {
                    window.history.replaceState(window.history.state, "", url);
                }
                window.dispatchEvent(new CustomEvent(LANDING_SECTION_EVENT, { detail: next }));
            },
            { rootMargin: "-45% 0px -54% 0px", threshold: [0, 0.01] },
        );
        nodes.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, [pathname]);

    return null;
}
