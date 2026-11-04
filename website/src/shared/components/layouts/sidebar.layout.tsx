"use client";

import { usePathname } from "next/navigation";
import type { JSX, ReactNode } from "react";

import FocusLayout from "@/shared/components/layouts/focus.layout";
import FullWidthLayout from "@/shared/components/layouts/full-width.layout";

/**
 * Đường dẫn dưới /app và /admin cần cột hẹp để mắt không phải quét quá xa.
 * Các tab còn lại (nhà đất, bản đồ, bảng số liệu) dùng hết chiều ngang.
 */
export const FOCUS_PATHS = [
    "/notification",
    "/feed",
    "/discussions",
    "/feedback",
    "/settings",
    "/properties/new",
] as const;

export function isFocusPath(pathname: string): boolean {
    const rest = pathname.replace(/^\/(app|admin)(?=\/|$)/, "") || "/";
    return FOCUS_PATHS.some((path) => rest === path || rest.startsWith(`${path}/`));
}

/** Khung có sidebar bên trái; phần nội dung chọn focus hoặc full-width theo đường dẫn. */
export default function SidebarLayout({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }): JSX.Element {
    const pathname = usePathname();
    return (
        <div className="flex h-full min-h-0 w-full bg-white pb-[env(safe-area-inset-bottom)] text-charcoal">
            {sidebar}
            <div className="h-full min-h-0 min-w-0 flex-1">
                {isFocusPath(pathname) ? <FocusLayout>{children}</FocusLayout> : <FullWidthLayout>{children}</FullWidthLayout>}
            </div>
        </div>
    );
}
