"use client";

import { usePathname } from "next/navigation";
import type { JSX, ReactNode } from "react";

import { FocusLayout } from "@/features/app/components/focus-layout";
import { FullWidthLayout } from "@/features/app/components/full-width-layout";

/**
 * Đường dẫn dưới /app và /admin cần cột hẹp để mắt không phải quét quá xa.
 * Các tab còn lại (nhà đất, bản đồ, bảng số liệu) dùng hết chiều ngang.
 */
const FOCUS_PATHS = [
    "/notification",
    "/feed",
    "/discussions",
    "/feedback",
    "/settings",
];

export function isFocusPath(pathname: string): boolean {
    const rest = pathname.replace(/^\/(app|admin)(?=\/|$)/, "") || "/";
    return FOCUS_PATHS.some((path) => rest === path || rest.startsWith(`${path}/`));
}

export function ShellContent({ children }: { children: ReactNode }): JSX.Element {
    const pathname = usePathname();
    if (isFocusPath(pathname)) return <FocusLayout>{children}</FocusLayout>;
    return <FullWidthLayout>{children}</FullWidthLayout>;
}
