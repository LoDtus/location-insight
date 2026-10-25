"use client";

import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import LOCALE from "@/shared/constants/locale.constant";
import type { Locale } from "@/shared/types/locale.types";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const TABS = [
    { href: "/#ban-do", key: "map" },
    { href: "/#mua-ban-nha-dat", key: "listings" },
    { href: "/#bang-gia", key: "pricing" },
    { href: "/#cach-hoat-dong", key: "how" },
    { href: "/#cau-hoi-thuong-gap", key: "faq" },
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
        <div className="relative mx-auto flex w-full max-w-960 items-center justify-between px-50">
            <a
                href="/"
                className="relative z-10 inline-flex min-h-11 items-center py-3 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current"
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
                className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-x-2 text-cream"
            >
                {TABS.map((tab) => (
                    <a
                        key={tab.href}
                        href={tab.href}
                        className="inline-flex min-h-11 items-center px-2 py-1 text-cream underline-offset-[0.2em] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current"
                        onClick={(event) => handleClick(event, tab.href)}
                    >
                        {getLocaleValue(landing, ["tabs", tab.key])}
                    </a>
                ))}
            </nav>
            <div className="relative z-10 flex shrink-0 items-center gap-x-3 py-2">
                <a
                    href="/auth/login"
                    className="inline-flex min-h-11 items-center px-2 py-1 text-cream underline-offset-[0.2em] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current"
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
