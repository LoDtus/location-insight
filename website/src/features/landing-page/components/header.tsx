"use client";

import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";

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

    function handleHome(event: MouseEvent<HTMLAnchorElement>): void {
        event.preventDefault();

        if (pathname !== "/") {
            router.push("/");
            return;
        }

        document.getElementById("gioi-thieu")?.scrollIntoView({
            behavior: scrollBehavior(),
            block: "start",
        });
        window.history.pushState(null, "", "/");
    }

    function handleClick(
        event: MouseEvent<HTMLAnchorElement>,
        href: string,
    ): void {
        const id = href.slice(href.indexOf("#") + 1);
        event.preventDefault();

        if (pathname === "/") {
            document.getElementById(id)?.scrollIntoView({
                behavior: scrollBehavior(),
                block: "start",
            });
            window.history.pushState(null, "", href);
            return;
        }

        router.push(href, { scroll: false });
    }

    function handleLocale(nextLocale: Locale): void {
        setLocale(nextLocale);
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
                                : undefined
                        }
                        className="inline-flex min-h-11 items-center px-3 py-1 text-[0.95rem] tracking-wide whitespace-nowrap text-cream/85 decoration-gold decoration-2 underline-offset-[0.45em] transition-colors hover:text-cream hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current aria-[current=page]:text-cream aria-[current=page]:underline motion-reduce:transition-none"
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
                <div
                    className="relative inline-grid min-w-[6.75rem] grid-cols-2 items-center rounded-full border border-current bg-transparent p-[3px]"
                    role="radiogroup"
                    aria-label={getLocaleValue(shared, ["localeSwitcher", "label"])}
                >
                    <span
                        className={`pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-current transition-transform duration-150 motion-reduce:transition-none ${locale === LOCALE.LOCALES.EN ? "translate-x-full" : ""}`}
                        aria-hidden="true"
                    />
                    {SWITCH_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={locale === option.id}
                            aria-label={getLocaleValue(shared, [
                                "localeSwitcher",
                                option.id,
                            ])}
                            disabled={isPending}
                            className={`relative z-[1] m-0 min-h-9 cursor-pointer rounded-full border-0 bg-transparent px-[0.7rem] text-xs font-semibold tracking-wide text-cream focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-wait ${locale === option.id ? "text-green" : ""}`}
                            onClick={() => handleLocale(option.id)}
                        >
                            {option.code}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
