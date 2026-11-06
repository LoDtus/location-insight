"use client";

import Image from "next/image";
import {
    BadgeCheck,
    Bell,
    Database,
    Download,
    Flag,
    GitCompareArrows,
    House,
    Mail,
    LogOut,
    Map,
    Settings,
    UserRound,
    MessagesSquare,
    Newspaper,
    PanelLeftClose,
    MessageSquareHeart,
    PanelLeftOpen,
    Send,
    ShieldAlert,
    Users,
    Wallet,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";

import { logout } from "@/features/auth/auth.api";
import { confirmLogout } from "@/features/auth/confirm-logout";
import { usePwaInstall } from "@/features/pwa/components/pwa-provider";
import { useAuth } from "@/features/auth/use-auth";
import { useFeedbackBadge } from "@/features/feedback/use-feedback-badge";
import { useCompareCount } from "@/features/map/hooks/use-saved-places";
import { useUnreadBadge } from "@/features/messaging/messaging-provider";
import { useNotificationUnread } from "@/features/notification/notification-badge";
import { useLocale } from "@/shared/hooks/useLocale";

type NavItem = {
    kind: "item";
    href: string;
    icon: LucideIcon;
    label: string;
    badge?: number;
};

type NavDivider = {
    kind: "divider";
    id: string;
    label: string;
};

type NavEntry = NavItem | NavDivider;

function isItemActive(href: string, pathname: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

function isMapPath(pathname: string): boolean {
    return pathname === "/app/map" || pathname.startsWith("/app/map/") || pathname === "/admin/map" || pathname.startsWith("/admin/map/");
}

function accountMenuStyle(anchor: HTMLElement | null, compact: boolean): CSSProperties {
    const rect = anchor?.getBoundingClientRect();
    if (!rect) return { visibility: "hidden" };
    if (compact) {
        return {
            left: rect.right + 12,
            bottom: window.innerHeight - rect.bottom,
            width: 224,
        };
    }
    return {
        left: rect.left,
        bottom: window.innerHeight - rect.top + 12,
        width: rect.width,
    };
}

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
    if (parts.length === 0) return "?";
    const letters = parts.slice(0, 2).map((part) => part[0] ?? "");
    return letters.join("").toLocaleUpperCase("vi");
}

export default function AppSidebar({
    surface,
}: {
    surface: "app" | "admin";
}): JSX.Element {
    const pathname = usePathname();
    const router = useRouter();
    const { locale } = useLocale();
    const auth = useAuth();
    const unread = useUnreadBadge();
    const notices = useNotificationUnread();
    const pwa = usePwaInstall();
    const feedbackBadge = useFeedbackBadge(surface);
    const compareCount = useCompareCount(Boolean(auth.user));
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const accountRef = useRef<HTMLDivElement>(null);
    const closeAccountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onMap = isMapPath(pathname);
    const wasOnMap = useRef(onMap);
    const vi = locale === "vi";
    const user = auth.user;
    const home = surface === "admin" ? "/admin/properties" : "/app/properties";
    const accountRoot = user?.role === "admin" ? "/admin" : "/app";
    const profileHref = `${accountRoot}/profile`;
    const settingsHref = `${accountRoot}/settings`;

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

    useEffect(() => {
        if (onMap && !wasOnMap.current) setDrawerOpen(false);
        wasOnMap.current = onMap;
    }, [onMap]);

    useEffect(() => {
        if (!drawerOpen) return;
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") setDrawerOpen(false);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [drawerOpen]);

    function cancelAccountClose(): void {
        if (closeAccountTimer.current === null) return;
        clearTimeout(closeAccountTimer.current);
        closeAccountTimer.current = null;
    }

    function openAccountMenu(): void {
        cancelAccountClose();
        setAccountOpen(true);
    }

    function scheduleAccountClose(): void {
        cancelAccountClose();
        closeAccountTimer.current = setTimeout(() => {
            setAccountOpen(false);
            closeAccountTimer.current = null;
        }, 140);
    }

    useEffect(() => {
        return () => {
            if (closeAccountTimer.current !== null) clearTimeout(closeAccountTimer.current);
        };
    }, []);

    useEffect(() => {
        if (!accountOpen) return;
        function onPointer(event: PointerEvent): void {
            if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
        }
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") setAccountOpen(false);
        }
        document.addEventListener("pointerdown", onPointer);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            window.removeEventListener("keydown", onKey);
        };
    }, [accountOpen]);

    const compact = onMap ? !drawerOpen : collapsed;

    useEffect(() => {
        setAccountOpen(false);
    }, [pathname, compact]);

    const items: NavEntry[] =
        surface === "admin"
            ? [
                  {
                      kind: "item",
                      href: "/admin/properties",
                      icon: House,
                      label: vi ? "Tin rao bán" : "For sale",
                  },
                  {
                      kind: "item",
                      href: "/admin/map",
                      icon: Map,
                      label: vi ? "Bản đồ" : "Map",
                  },
                  {
                      kind: "item",
                      href: "/admin/compare",
                      icon: GitCompareArrows,
                      label: vi ? "So sánh" : "Compare",
                      badge: compareCount || undefined,
                  },
                  {
                      kind: "item",
                      href: "/admin/feed",
                      icon: MessagesSquare,
                      label: vi ? "Diễn đàn" : "Discussions",
                  },
                  {
                      kind: "item",
                      href: "/admin/messages",
                      icon: Send,
                      label: vi ? "Tin nhắn" : "Messages",
                      badge: unread,
                  },
                  {
                      kind: "item",
                      href: "/admin/notification",
                      icon: Bell,
                      label: vi ? "Thông báo" : "Notifications",
                      badge: notices.count || undefined,
                  },
                  {
                      kind: "item",
                      href: "/admin/feedback",
                      icon: MessageSquareHeart,
                      label: vi ? "Góp ý" : "Feedback",
                      badge: feedbackBadge,
                  },
                  {
                      kind: "item",
                      href: "/admin/email",
                      icon: Mail,
                      label: "Email",
                  },
                  {
                      kind: "divider",
                      id: "admin",
                      label: vi ? "Quản trị" : "Admin",
                  },
                  {
                      kind: "item",
                      href: "/admin/blogs",
                      icon: Newspaper,
                      label: vi ? "Bài viết" : "Articles",
                  },
                  {
                      kind: "item",
                      href: "/admin/datasets",
                      icon: Database,
                      label: vi ? "Dữ liệu đánh giá" : "Datasets",
                  },
                  {
                      kind: "item",
                      href: "/admin/users",
                      icon: Users,
                      label: vi ? "Người dùng" : "Users",
                  },
                  {
                      kind: "item",
                      href: "/admin/messaging",
                      icon: ShieldAlert,
                      label: vi ? "Báo cáo tin nhắn" : "Message reports",
                  },
                  {
                      kind: "item",
                      href: "/admin/discussions",
                      icon: Flag,
                      label: vi ? "Báo cáo bài viết" : "Post reports",
                  },
              ]
            : [
                  {
                      kind: "item",
                      href: "/app/properties",
                      icon: House,
                      label: vi ? "Tin rao bán" : "For sale",
                  },
                  {
                      kind: "item",
                      href: "/app/map",
                      icon: Map,
                      label: vi ? "Bản đồ" : "Map",
                  },
                  {
                      kind: "item",
                      href: "/app/compare",
                      icon: GitCompareArrows,
                      label: vi ? "So sánh" : "Compare",
                      badge: compareCount || undefined,
                  },
                  {
                      kind: "item",
                      href: "/app/feed",
                      icon: MessagesSquare,
                      label: vi ? "Diễn đàn" : "Discussions",
                  },
                  {
                      kind: "item",
                      href: "/app/messages",
                      icon: Send,
                      label: vi ? "Tin nhắn" : "Messages",
                      badge: unread,
                  },
                  {
                      kind: "item",
                      href: "/app/notification",
                      icon: Bell,
                      label: vi ? "Thông báo" : "Notifications",
                      badge: notices.count || undefined,
                  },
                  {
                      kind: "item",
                      href: "/app/feedback",
                      icon: MessageSquareHeart,
                      label: vi ? "Góp ý" : "Feedback",
                      badge: feedbackBadge,
                  },
                  {
                      kind: "item",
                      href: "/app/plans",
                      icon: BadgeCheck,
                      label: vi ? "Gói" : "Plan",
                  },
                  {
                      kind: "item",
                      href: "/app/payments",
                      icon: Wallet,
                      label: vi ? "Thanh toán" : "Payment",
                  },
              ];

    async function handleLogout(): Promise<void> {
        setAccountOpen(false);
        if (!(await confirmLogout(vi))) return;
        setSigningOut(true);
        try {
            await logout();
        } finally {
            router.replace("/auth/login");
        }
    }

    return (
        <>
        {onMap ? <div className="w-[72px] shrink-0" aria-hidden="true" /> : null}
        {onMap && drawerOpen ? (
            <button
                type="button"
                className="fixed inset-0 z-40 bg-charcoal/40"
                aria-label={vi ? "Đóng menu" : "Close menu"}
                onClick={() => setDrawerOpen(false)}
            />
        ) : null}
        <aside
            className={`flex shrink-0 flex-col border-r border-charcoal/15 bg-white transition-[width] duration-200 motion-reduce:transition-none ${onMap ? "fixed inset-y-0 left-0 z-50" : "relative z-20 h-full"} ${compact ? "w-[72px]" : "w-[272px]"}`}
            role={onMap && drawerOpen ? "dialog" : undefined}
            aria-modal={onMap && drawerOpen ? true : undefined}
            aria-label={onMap && drawerOpen ? (vi ? "Menu" : "Menu") : undefined}
        >
            <div
                className={`flex h-[76px] items-center border-b border-charcoal/15 ${compact ? "justify-center px-3" : "gap-3 px-4"}`}
            >
                {compact ? null : (
                    <Link
                        href={home}
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
                    aria-label={compact ? (vi ? "Mở rộng menu" : "Expand menu") : vi ? "Thu gọn menu" : "Collapse menu"}
                    onClick={() => {
                        if (onMap) setDrawerOpen((open) => !open);
                        else setCollapsed((current) => !current);
                    }}
                >
                    {compact ? (
                        <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
                    ) : (
                        <PanelLeftClose className="size-[18px]" aria-hidden="true" />
                    )}
                </button>
            </div>

            <nav
                aria-label={
                    surface === "admin"
                        ? vi
                            ? "Quản trị"
                            : "Admin"
                        : vi
                          ? "Trong ứng dụng"
                          : "In the app"
                }
                className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
            >
                {items.map((item) => {
                    if (item.kind === "divider") {
                        return (
                            <div key={item.id} className="my-2 px-2">
                                {compact ? null : (
                                    <p className="m-0 pb-2 text-xs font-semibold text-charcoal/60">
                                        {item.label}
                                    </p>
                                )}
                                <div className="h-px bg-charcoal/15" />
                            </div>
                        );
                    }

                    const active = isItemActive(item.href, pathname);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            aria-current={active ? "page" : undefined}
                            className={`flex min-h-11 items-center rounded-xl text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${compact ? "justify-center px-2" : "gap-3 px-3"} ${active ? "bg-green font-semibold text-cream" : "text-charcoal/80 hover:bg-green/10 hover:text-green"}`}
                        >
                            <span className="relative inline-flex shrink-0">
                                <Icon className="size-[18px]" aria-hidden="true" />
                                {compact && item.badge ? (
                                    // Thu gọn vẫn hiện đủ số như khi mở rộng (tràn sang phải icon, có viền để tách nền).
                                    <span
                                        className={`absolute -top-2 left-3 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums ring-2 ${active ? "bg-cream text-green ring-green" : "bg-green text-cream ring-white"}`}
                                        aria-label={`${item.badge} mục mới`}
                                    >
                                        {item.badge >= 99 ? "99+" : item.badge}
                                    </span>
                                ) : null}
                            </span>
                            {compact ? null : <span className="truncate">{item.label}</span>}
                            {!compact && item.badge ? (
                                <span
                                    className={`ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${active ? "bg-cream text-green" : "bg-green text-cream"}`}
                                    aria-label={`${item.badge} mục mới`}
                                >
                                    {item.badge >= 99 ? "99+" : item.badge}
                                </span>
                            ) : null}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-charcoal/15 p-3">
                <div
                    ref={accountRef}
                    className="relative"
                    onMouseEnter={openAccountMenu}
                    onMouseLeave={scheduleAccountClose}
                    onFocusCapture={openAccountMenu}
                    onBlurCapture={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            scheduleAccountClose();
                        }
                    }}
                >
                    <button
                        type="button"
                        className={`flex min-h-14 w-full items-center rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${
                            compact ? "justify-center" : "gap-3 px-1"
                        } ${
                            pathname === profileHref || pathname === settingsHref
                                ? "bg-green/10 text-green"
                                : "text-charcoal hover:bg-green/10"
                        }`}
                        aria-haspopup="menu"
                        aria-expanded={accountOpen}
                        aria-controls={accountOpen ? "menu-tai-khoan" : undefined}
                        onClick={openAccountMenu}
                    >
                        {user?.avatarUrl ? (
                            // Ảnh đại diện đã lưu của chính người dùng.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={user.avatarUrl}
                                alt=""
                                className="size-10 shrink-0 rounded-full object-cover"
                            />
                        ) : (
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green text-xs font-semibold text-cream">
                                {initialsOf(user?.displayName ?? "")}
                            </span>
                        )}
                        {compact ? null : (
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">
                                    {user?.displayName}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-charcoal/70">
                                    {user?.email}
                                </span>
                            </span>
                        )}
                    </button>
                    {accountOpen ? (
                        <div
                            id="menu-tai-khoan"
                            role="menu"
                            className="fixed z-[70] rounded-2xl border border-charcoal/15 bg-white p-2 shadow-[0_20px_55px_rgba(16,17,17,0.16)]"
                            style={accountMenuStyle(accountRef.current, compact)}
                            onMouseEnter={openAccountMenu}
                        >
                            <Link
                                href={profileHref}
                                role="menuitem"
                                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-charcoal no-underline hover:bg-green/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                onClick={() => setAccountOpen(false)}
                            >
                                <UserRound className="size-4 shrink-0" aria-hidden="true" />
                                <span>{vi ? "Trang cá nhân" : "Profile"}</span>
                            </Link>
                            <Link
                                href={settingsHref}
                                role="menuitem"
                                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-charcoal no-underline hover:bg-green/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                onClick={() => setAccountOpen(false)}
                            >
                                <Settings className="size-4 shrink-0" aria-hidden="true" />
                                <span>{vi ? "Cài đặt" : "Settings"}</span>
                            </Link>
                            <div className="my-1 h-px bg-charcoal/15" />
                            <button
                                type="button"
                                role="menuitem"
                                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-red-700 hover:bg-red-700/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60"
                                disabled={signingOut}
                                onClick={() => {
                                    void handleLogout();
                                }}
                            >
                                <LogOut className="size-4 shrink-0" aria-hidden="true" />
                                <span>{vi ? "Đăng xuất" : "Log out"}</span>
                            </button>
                        </div>
                    ) : null}
                </div>
                {pwa.canInstall || pwa.showGuide ? (
                    <button
                        type="button"
                        className={`mt-2 flex min-h-11 w-full items-center rounded-xl text-sm text-charcoal hover:bg-green/10 hover:text-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${compact ? "justify-center px-2" : "gap-3 px-3"}`}
                        aria-label="Cài ứng dụng"
                        title="Cài ứng dụng"
                        onClick={pwa.requestInstall}
                    >
                        <Download className="size-[18px] shrink-0" aria-hidden="true" />
                        {compact ? null : <span>Cài ứng dụng</span>}
                    </button>
                ) : null}
            </div>
        </aside>
        </>
    );
}
