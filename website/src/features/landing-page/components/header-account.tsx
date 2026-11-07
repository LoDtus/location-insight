"use client";

import { ChevronDown, LayoutDashboard, LogOut, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import { logout } from "@/features/auth/auth.api";
import { confirmLogout } from "@/features/auth/confirm-logout";
import { useAuth } from "@/features/auth/use-auth";
import { profileHref } from "@/features/profile/profile-path";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current";

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
    if (parts.length === 0) return "?";
    return parts
        .slice(-2)
        .map((part) => part[0] ?? "")
        .join("")
        .toLocaleUpperCase("vi");
}

/** Một mục trong menu tài khoản: liên kết, hoặc hành động (vd. cài ứng dụng). "divider" là đường kẻ ngăn nhóm. */
export type AccountMenuItem = { label: string; icon: LucideIcon; href: string } | { label: string; icon: LucideIcon; onSelect: () => void } | "divider";

/** Mục mặc định ở trang công khai: Trang quản lý (/app, admin là /admin), Trang cá nhân. */
function landingItems({ root, profile, vi }: { root: ShellRoot; profile: string; vi: boolean }): AccountMenuItem[] {
    return [
        { href: root, icon: LayoutDashboard, label: vi ? "Trang quản lý" : "Dashboard" },
        { href: profile, icon: UserRound, label: vi ? "Trang cá nhân" : "Profile" },
    ];
}

/**
 * Nút tài khoản trên header nền xanh (trang công khai và khu /app): khách thấy "Đăng nhập"; đã đăng nhập thấy ảnh đại diện
 * + tên hiển thị + @username, bấm mở menu gồm các mục của từng nơi (`items`) và luôn có Đăng xuất (hỏi xác nhận) ở cuối.
 */
export default function HeaderAccount({
    loginLabel,
    vi,
    items = landingItems,
    afterSignOut = "refresh",
}: {
    loginLabel: string;
    vi: boolean;
    items?: (context: { root: ShellRoot; profile: string; vi: boolean }) => AccountMenuItem[];
    /** Trang công khai: ở lại và làm mới; khu /app: về trang đăng nhập. */
    afterSignOut?: "refresh" | "login";
}): JSX.Element {
    const auth = useAuth();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) return;
        const onPointer = (event: PointerEvent): void => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent): void => {
            if (event.key !== "Escape") return;
            setOpen(false);
            buttonRef.current?.focus();
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        // Mở bằng bàn phím: đưa focus vào mục đầu tiên.
        rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    if (auth.status === "unknown") {
        // Giữ chỗ để header không nhảy khi phiên vừa khôi phục xong.
        return <span aria-hidden className="inline-block size-10 rounded-full bg-cream/15" />;
    }

    const user = auth.user;
    if (auth.status !== "authenticated" || !user) {
        return (
            <a
                href="/auth/login"
                className={`inline-flex min-h-11 items-center px-3 py-1 text-[0.95rem] tracking-wide text-cream decoration-gold decoration-2 underline-offset-[0.45em] hover:underline ${FOCUS}`}
            >
                {loginLabel}
            </a>
        );
    }

    const root: ShellRoot = user.role === "admin" ? "/admin" : "/app";
    const profile = user.username ? profileHref(root, user.username) : `${root}/profile`;

    async function signOut(): Promise<void> {
        setOpen(false);
        if (!(await confirmLogout(vi))) return;
        setSigningOut(true);
        try {
            await logout();
        } finally {
            setSigningOut(false);
            setOpen(false);
            if (afterSignOut === "login") router.replace("/auth/login");
            else router.refresh();
        }
    }

    function moveFocus(step: 1 | -1): void {
        const items = [...(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const at = items.indexOf(document.activeElement as HTMLElement);
        items[(at + step + items.length) % items.length]?.focus();
    }

    const item = `flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[0.95rem] text-charcoal no-underline hover:bg-charcoal/[0.06] focus-visible:bg-charcoal/[0.06] focus-visible:outline-none disabled:opacity-60`;

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen((value) => !value)}
                className={`flex min-h-11 items-center gap-2.5 rounded-full py-1 pr-2 pl-1 text-left text-cream hover:bg-cream/10 ${FOCUS}`}
            >
                {user.avatarUrl ? (
                    // Ảnh đại diện đã lưu của chính người dùng.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
                ) : (
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cream font-sans text-xs font-semibold text-green">
                        {initialsOf(user.displayName)}
                    </span>
                )}
                <span className="hidden max-w-[11rem] min-w-0 flex-col leading-tight sm:flex">
                    <span className="truncate text-[0.95rem] font-semibold">{user.displayName}</span>
                    {user.username ? <span className="truncate font-sans text-xs text-cream/75">@{user.username}</span> : null}
                </span>
                <span className="sr-only sm:hidden">{user.displayName}</span>
                <ChevronDown size={16} aria-hidden className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
            </button>
            {open ? (
                <div
                    id={menuId}
                    role="menu"
                    aria-label={vi ? "Tài khoản" : "Account"}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            moveFocus(1);
                        } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            moveFocus(-1);
                        }
                    }}
                    className="absolute top-full right-0 z-[60] mt-2 w-64 rounded-xl border border-charcoal/10 bg-white p-1.5 font-sans shadow-lg"
                >
                    <div className="border-b border-charcoal/10 px-3 pt-1.5 pb-2.5">
                        <p className="m-0 truncate text-sm font-semibold text-charcoal">{user.displayName}</p>
                        {user.username ? <p className="m-0 truncate text-xs text-charcoal/60">@{user.username}</p> : null}
                    </div>
                    <div className="pt-1.5">
                        {items({ root, profile, vi }).map((entry, index) => {
                            if (entry === "divider") return <div key={`d${index}`} role="separator" className="my-1 h-px bg-charcoal/10" />;
                            const Icon = entry.icon;
                            return "href" in entry ? (
                                <Link key={entry.href} role="menuitem" href={entry.href} className={item} onClick={() => setOpen(false)}>
                                    <Icon size={18} aria-hidden className="text-charcoal/70" />
                                    {entry.label}
                                </Link>
                            ) : (
                                <button
                                    key={entry.label}
                                    role="menuitem"
                                    type="button"
                                    className={item}
                                    onClick={() => {
                                        setOpen(false);
                                        entry.onSelect();
                                    }}
                                >
                                    <Icon size={18} aria-hidden className="text-charcoal/70" />
                                    {entry.label}
                                </button>
                            );
                        })}
                        <div role="separator" className="my-1 h-px bg-charcoal/10" />
                        <button role="menuitem" type="button" disabled={signingOut} onClick={() => void signOut()} className={`${item} text-red-700`}>
                            <LogOut size={18} aria-hidden className="text-red-700" />
                            {signingOut ? (vi ? "Đang đăng xuất…" : "Signing out…") : vi ? "Đăng xuất" : "Sign out"}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
