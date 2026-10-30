"use client";

import Image from "next/image";
import {
    BadgeCheck,
    House,
    LogOut,
    Map,
    PanelLeftClose,
    PanelLeftOpen,
    Shield,
    Undo2,
    Wallet,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type JSX } from "react";

import { logout } from "@/features/auth/auth.api";
import { useAuth } from "@/features/auth/use-auth";
import { useLocale } from "@/shared/hooks/useLocale";

type NavItem = {
    href: string;
    icon: LucideIcon;
    label: string;
};

function isItemActive(href: string, pathname: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
    if (parts.length === 0) return "?";
    const letters = parts.slice(0, 2).map((part) => part[0] ?? "");
    return letters.join("").toLocaleUpperCase("vi");
}

export default function AppSidebar(): JSX.Element {
    const pathname = usePathname();
    const router = useRouter();
    const { locale } = useLocale();
    const auth = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const vi = locale === "vi";
    const user = auth.user;

    useEffect(() => {
        const compact = window.matchMedia("(max-width: 767px)");
        const sync = (): void => {
            setCollapsed(compact.matches);
        };
        sync();
        compact.addEventListener("change", sync);
        return () => {
            compact.removeEventListener("change", sync);
        };
    }, []);

    const items: NavItem[] = [
        {
            href: "/app/properties",
            icon: House,
            label: vi ? "Tin rao bán" : "For sale",
        },
        {
            href: "/app/map",
            icon: Map,
            label: vi ? "Bản đồ" : "Map",
        },
        {
            href: "/app/goi",
            icon: BadgeCheck,
            label: vi ? "Gói" : "Plan",
        },
        {
            href: "/app/thanh-toan",
            icon: Wallet,
            label: vi ? "Thanh toán" : "Payment",
        },
        {
            href: "/app/hoan-tien",
            icon: Undo2,
            label: vi ? "Hoàn tiền" : "Refund",
        },
    ];

    if (user?.role === "admin") {
        items.push({
            href: "/admin/blogs",
            icon: Shield,
            label: vi ? "Quản trị" : "Admin",
        });
    }

    async function handleLogout(): Promise<void> {
        setSigningOut(true);
        await logout();
        router.replace("/auth/login");
    }

    return (
        <aside
            className={`flex h-full shrink-0 flex-col border-r border-charcoal/15 bg-cream transition-[width] duration-200 motion-reduce:transition-none ${collapsed ? "w-[72px]" : "w-[272px]"}`}
        >
            <div
                className={`flex h-[76px] items-center border-b border-charcoal/15 ${collapsed ? "justify-center px-3" : "gap-3 px-4"}`}
            >
                {collapsed ? null : (
                    <Link
                        href="/app/properties"
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    >
                        <Image src="/logos/diathe.svg" alt="" width={32} height={32} className="size-8 shrink-0" />
                        <span className="truncate text-sm font-semibold">
                            {vi ? "Địa Thế" : "Location Insight"}
                        </span>
                    </Link>
                )}
                <button
                    type="button"
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-charcoal hover:bg-green/10 hover:text-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    aria-label={collapsed ? (vi ? "Mở rộng menu" : "Expand menu") : vi ? "Thu gọn menu" : "Collapse menu"}
                    onClick={() => setCollapsed((current) => !current)}
                >
                    {collapsed ? (
                        <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
                    ) : (
                        <PanelLeftClose className="size-[18px]" aria-hidden="true" />
                    )}
                </button>
            </div>

            <nav
                aria-label={vi ? "Trong ứng dụng" : "In the app"}
                className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
            >
                {items.map((item) => {
                    const active = isItemActive(item.href, pathname);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            aria-current={active ? "page" : undefined}
                            className={`flex min-h-11 items-center rounded-xl text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${collapsed ? "justify-center px-2" : "gap-3 px-3"} ${active ? "bg-green font-semibold text-cream" : "text-charcoal/80 hover:bg-green/10 hover:text-green"}`}
                        >
                            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                            {collapsed ? null : <span className="truncate">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-charcoal/15 p-3">
                <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3 px-1"}`}>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green text-xs font-semibold text-cream">
                        {initialsOf(user?.displayName ?? "")}
                    </span>
                    {collapsed ? null : (
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                                {user?.displayName}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-charcoal/70">
                                {user?.email}
                            </span>
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    className={`mt-2 flex min-h-11 w-full items-center rounded-xl text-sm text-charcoal hover:bg-green/10 hover:text-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:cursor-wait disabled:opacity-60 ${collapsed ? "justify-center px-2" : "gap-3 px-3"}`}
                    disabled={signingOut}
                    aria-label={vi ? "Đăng xuất" : "Log out"}
                    title={vi ? "Đăng xuất" : "Log out"}
                    onClick={() => {
                        void handleLogout();
                    }}
                >
                    <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
                    {collapsed ? null : <span>{vi ? "Đăng xuất" : "Log out"}</span>}
                </button>
            </div>
        </aside>
    );
}
