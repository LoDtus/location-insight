"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

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

            document.getElementById(id)?.scrollIntoView({
                behavior,
                block: "start",
            });
        }

        scrollToHash();
        window.addEventListener("hashchange", scrollToHash);
        window.addEventListener("popstate", scrollToHash);

        return () => {
            window.removeEventListener("hashchange", scrollToHash);
            window.removeEventListener("popstate", scrollToHash);
        };
    }, [pathname]);

    return null;
}
