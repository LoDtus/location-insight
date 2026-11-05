"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";

import { LANDING_SECTION_EVENT, scrollToSection } from "@/features/landing-page/landing-sections";

import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import LOCALE from "@/shared/constants/locale.constant";
import type { Locale } from "@/shared/types/locale.types";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const TABS = [
    { href: "/#ban-do", key: "map" },
    { href: "/#nha-dat", key: "listings" },
    { href: "/#bang-gia", key: "pricing" },
    { href: "/#cach-hoat-dong", key: "how" },
    { href: "/#cau-hoi-thuong-gap", key: "faq" },
    { href: "/bai-viet", key: "articles" },
] as const;

const SWITCH_OPTIONS = [
    { id: LOCALE.LOCALES.VI, code: "VI" },
    { id: LOCALE.LOCALES.EN, code: "EN" },
] as const;

function scrollBehavior(): ScrollBehavior {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return "auto";
    }

    return "smooth";
}

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const landing = useLocaleMessages("landing");
    const shared = useLocaleMessages("shared");
    const { locale, setLocale, isPending } = useLocale();
    const [section, setSection] = useState("");
    const nextLocale: Locale = locale === LOCALE.LOCALES.EN ? LOCALE.LOCALES.VI : LOCALE.LOCALES.EN;

    useEffect(() => {
        function onSection(event: Event): void {
            setSection((event as CustomEvent<string>).detail);
        }
        window.addEventListener(LANDING_SECTION_EVENT, onSection);
        return () => window.removeEventListener(LANDING_SECTION_EVENT, onSection);
    }, []);

    function handleHome(event: MouseEvent<HTMLAnchorElement>): void {
        event.preventDefault();

        if (pathname !== "/") {
            router.push("/");
            return;
        }

        scrollToSection("gioi-thieu", scrollBehavior());
        window.history.pushState(null, "", "/");
    }

    function handleClick(
        event: MouseEvent<HTMLAnchorElement>,
        href: string,
    ): void {
        const id = href.slice(href.indexOf("#") + 1);
        event.preventDefault();

        if (pathname === "/") {
            scrollToSection(id, scrollBehavior());
            window.history.pushState(null, "", href);
            return;
        }

        router.push(href, { scroll: false });
    }


    return (
        <div className="relative mx-auto flex w-full max-w-960 flex-wrap items-center gap-x-3 px-5 sm:px-10 xl:px-24">
            <a
                href="/"
                className="inline-flex min-h-11 shrink-0 items-center py-3 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current"
                onClick={handleHome}
            >
                <img
                    src="/logos/diathe-text.svg"
                    alt={getLocaleValue(landing, ["tabs", "intro"])}
                    className="h-7 w-auto"
                />
            </a>
            <nav
                aria-label={getLocaleValue(landing, ["nav"])}
                className="order-last flex w-full min-w-0 items-center gap-x-2 overflow-x-auto pb-2 text-cream [scrollbar-width:none] min-[88rem]:order-none min-[88rem]:w-auto min-[88rem]:flex-1 min-[88rem]:justify-center min-[88rem]:pb-0"
            >
                {TABS.map((tab) => (
                    <a
                        key={tab.href}
                        href={tab.href}
                        aria-current={
                            tab.href === "/bai-viet" && pathname.startsWith("/bai-viet")
                                ? "page"
                                : pathname === "/" && tab.href === `/#${section}`
                                  ? "location"
                                  : undefined
                        }
                        className="inline-flex min-h-11 items-center px-3 py-1 text-[0.95rem] tracking-wide whitespace-nowrap text-cream/85 decoration-gold decoration-2 underline-offset-[0.45em] transition-colors hover:text-cream hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current aria-[current=page]:text-cream aria-[current=page]:underline aria-[current=location]:text-cream aria-[current=location]:underline motion-reduce:transition-none"
                        onClick={
                            tab.href.startsWith("/#")
                                ? (event) => handleClick(event, tab.href)
                                : undefined
                        }
                    >
                        {getLocaleValue(landing, ["tabs", tab.key])}
                    </a>
                ))}
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-x-3 py-2 min-[88rem]:ml-0">
                <a
                    href="/auth/login"
                    className="inline-flex min-h-11 items-center px-3 py-1 text-[0.95rem] tracking-wide text-cream decoration-gold decoration-2 underline-offset-[0.45em] hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                    {getLocaleValue(landing, ["login"])}
                </a>
                {/* Một nút duy nhất: bấm vào bất kỳ đâu trên công tắc là chuyển sang ngôn ngữ còn lại. */}
                <button
                    type="button"
                    role="switch"
                    aria-checked={locale === LOCALE.LOCALES.EN}
                    aria-label={`${getLocaleValue(shared, ["localeSwitcher", "label"])}: ${getLocaleValue(shared, ["localeSwitcher", nextLocale])}`}
                    disabled={isPending}
                    onClick={() => setLocale(nextLocale)}
                    className="relative m-0 inline-grid min-w-[6.75rem] cursor-pointer grid-cols-2 items-center rounded-full border border-current bg-transparent p-[3px] text-cream focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-wait"
                >
                    <span
                        className={`pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-current transition-transform duration-150 motion-reduce:transition-none ${locale === LOCALE.LOCALES.EN ? "translate-x-full" : ""}`}
                        aria-hidden="true"
                    />
                    {SWITCH_OPTIONS.map((option) => (
                        <span
                            key={option.id}
                            aria-hidden="true"
                            className={`relative z-[1] inline-flex min-h-9 items-center justify-center px-[0.7rem] text-xs font-semibold tracking-wide ${locale === option.id ? "text-green" : "text-cream"}`}
                        >
                            {option.code}
                        </span>
                    ))}
                </button>
            </div>
        </div>
    );
}
