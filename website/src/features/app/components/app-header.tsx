"use client";

import { BadgeCheck, Download, GitCompareArrows, House, MessageCircle, MessageSquareHeart, Settings, UserRound, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX } from "react";

import { useAuth } from "@/features/auth/use-auth";
import HeaderAccount, { type AccountMenuItem } from "@/features/landing-page/components/header-account";
import { useCompareCount } from "@/features/map/hooks/use-saved-places";
import { useUnreadBadge } from "@/features/messaging/messaging-provider";
import { NotificationPopover } from "@/features/notification/components/notification-popover";
import { usePwaInstall } from "@/features/pwa/components/pwa-provider";
import { useLocale } from "@/shared/hooks/useLocale";

const TABS = [
    { href: "/app/properties", match: ["/app/properties"], vi: "Rao bán", en: "For sale" },
    { href: "/app/map", match: ["/app/map"], vi: "Bản đồ", en: "Map" },
    { href: "/app/feed", match: ["/app/feed", "/app/discussions"], vi: "Diễn đàn", en: "Discussions" },
] as const;

const FOCUS = "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current";

function isActive(pathname: string, prefixes: readonly string[]): boolean {
    return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Nút icon trên header (không chữ; có title khi rê chuột và aria-label), kèm số đếm nếu có. */
function IconLink({ href, label, icon: Icon, count, active }: { href: string; label: string; icon: LucideIcon; count: number; active: boolean }): JSX.Element {
    return (
        <Link
            href={href}
            title={label}
            aria-label={count > 0 ? `${label}, ${count}` : label}
            aria-current={active ? "page" : undefined}
            className={`relative inline-flex size-10 items-center justify-center rounded-full text-cream no-underline hover:bg-cream/10 ${active ? "bg-cream/15" : ""} ${FOCUS}`}
        >
            <Icon size={20} aria-hidden />
            {count > 0 ? (
                <span
                    aria-hidden
                    className="absolute -top-0.5 -right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 font-sans text-[10px] font-bold text-white ring-2 ring-header"
                >
                    {count > 99 ? "99+" : count}
                </span>
            ) : null}
        </Link>
    );
}

/**
 * Header của khu /app (thay sidebar): logo, ba tab chính (Rao bán, Bản đồ, Diễn đàn) và bên phải các nút icon
 * So sánh, Tin nhắn, Thông báo (khung nổi) cùng nút tài khoản như trang công khai. Các trang còn lại của sidebar cũ
 * (Gói, Thanh toán, Góp ý, Cài đặt, Trang cá nhân, Cài ứng dụng) nằm trong menu tài khoản.
 */
export default function AppHeader(): JSX.Element {
    const pathname = usePathname();
    const auth = useAuth();
    const { locale } = useLocale();
    const vi = locale !== "en";
    const unread = useUnreadBadge();
    const compareCount = useCompareCount(Boolean(auth.user));
    const pwa = usePwaInstall();

    const accountItems = ({ profile }: { profile: string }): AccountMenuItem[] => [
        { href: profile, icon: UserRound, label: vi ? "Trang cá nhân" : "Profile" },
        { href: "/app/settings", icon: Settings, label: vi ? "Cài đặt" : "Settings" },
        "divider",
        { href: "/app/plans", icon: BadgeCheck, label: vi ? "Gói" : "Plan" },
        { href: "/app/payments", icon: Wallet, label: vi ? "Thanh toán" : "Payments" },
        { href: "/app/feedback", icon: MessageSquareHeart, label: vi ? "Góp ý" : "Feedback" },
        ...(pwa.canInstall || pwa.showGuide ? [{ icon: Download, label: vi ? "Cài ứng dụng" : "Install app", onSelect: pwa.requestInstall }] : []),
        "divider",
        { href: "/", icon: House, label: vi ? "Trang chủ Địa Thế" : "Địa Thế home" },
    ];

    return (
        <header className="shrink-0 bg-header text-cream">
            <div className="flex w-full flex-wrap items-center gap-x-3 px-3 sm:px-6">
                <Link href="/app/properties" className={`inline-flex min-h-11 shrink-0 items-center py-2.5 ${FOCUS}`} aria-label={vi ? "Địa Thế, trang Rao bán" : "Địa Thế, for-sale listings"}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG tĩnh */}
                    <img src="/logos/diathe-text.svg" alt="" className="h-7 w-auto" />
                </Link>
                <nav
                    aria-label={vi ? "Khu chính" : "Main sections"}
                    className="order-last -mx-1 flex w-full min-w-0 items-center gap-x-1 overflow-x-auto pb-1.5 [scrollbar-width:none] md:order-none md:mx-0 md:w-auto md:flex-1 md:pb-0 md:pl-4"
                >
                    {TABS.map((tab) => {
                        const active = isActive(pathname, tab.match);
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                aria-current={active ? "page" : undefined}
                                className={`inline-flex min-h-11 items-center px-3 text-[0.95rem] tracking-wide whitespace-nowrap text-cream/85 no-underline decoration-gold decoration-2 underline-offset-[0.45em] hover:text-cream hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-cream aria-[current=page]:underline ${FOCUS}`}
                            >
                                {vi ? tab.vi : tab.en}
                            </Link>
                        );
                    })}
                </nav>
                <div className="ml-auto flex shrink-0 items-center gap-1 py-1.5 md:ml-0">
                    <IconLink href="/app/compare" label={vi ? "So sánh địa điểm" : "Compare places"} icon={GitCompareArrows} count={compareCount} active={isActive(pathname, ["/app/compare"])} />
                    <IconLink href="/app/messages" label={vi ? "Tin nhắn" : "Messages"} icon={MessageCircle} count={unread} active={isActive(pathname, ["/app/messages"])} />
                    <NotificationPopover root="/app" vi={vi} />
                    <span aria-hidden className="mx-1 h-6 w-px bg-cream/25" />
                    <HeaderAccount loginLabel={vi ? "Đăng nhập" : "Sign in"} vi={vi} items={accountItems} afterSignOut="login" />
                </div>
            </div>
        </header>
    );
}
