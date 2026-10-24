"use client";

import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import LOCALE from "@/shared/constants/locale.constant";
import type { Locale } from "@/shared/types/locale.types";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const TABS = [
    { href: "/#gioi-thieu", key: "intro" },
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
        <div className="landing-header mx-auto w-full max-w-960">
            <nav aria-label={getLocaleValue(landing, ["nav"])}>
                {TABS.map((tab) => (
                    <a
                        key={tab.href}
                        href={tab.href}
                        onClick={(event) => handleClick(event, tab.href)}
                    >
                        {getLocaleValue(landing, ["tabs", tab.key])}
                    </a>
                ))}
            </nav>
            <div className="landing-header-actions">
                <div
                    className="lang-switch"
                    data-locale={locale}
                    role="radiogroup"
                    aria-label={getLocaleValue(shared, ["localeSwitcher", "label"])}
                >
                    <span className="lang-switch-thumb" aria-hidden="true" />
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
                            onClick={() => handleLocale(option.id)}
                        >
                            {option.code}
                        </button>
                    ))}
                </div>
                <a href="/auth/login">{getLocaleValue(landing, ["login"])}</a>
            </div>
        </div>
    );
}
