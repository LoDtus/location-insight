"use client";

import { usePathname } from "next/navigation";
import type { JSX, ReactNode } from "react";

import FocusLayout from "@/shared/components/layouts/focus.layout";
import FullWidthLayout from "@/shared/components/layouts/full-width.layout";
import { isFocusPath } from "@/shared/components/layouts/sidebar.layout";

/**
 * Khung có header ngang ở trên (khu /app, giống trang công khai): header cố định, phần dưới là vùng cuộn duy nhất,
 * chọn focus (cột đọc) hoặc full-width (bản đồ, bảng, danh sách) theo đường dẫn như SidebarLayout.
 */
export default function TopNavLayout({ header, subheader, children }: { header: ReactNode; subheader?: ReactNode; children: ReactNode }): JSX.Element {
    const pathname = usePathname();
    return (
        <div className="flex h-full min-h-0 w-full flex-col bg-white pb-[env(safe-area-inset-bottom)] text-charcoal">
            {header}
            <div className="relative min-h-0 min-w-0 flex-1">
                {isFocusPath(pathname) ? (
                    <FocusLayout>
                        {subheader}
                        {children}
                    </FocusLayout>
                ) : (
                    <FullWidthLayout>
                        {subheader}
                        {children}
                    </FullWidthLayout>
                )}
            </div>
        </div>
    );
}
