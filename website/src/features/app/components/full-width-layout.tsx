import type { JSX, ReactNode } from "react";

/** Trải hết phần nội dung cạnh sidebar, cho bảng, bản đồ và số liệu. */
export function FullWidthLayout({ children }: { children: ReactNode }): JSX.Element {
    return (
        <div className="h-full min-h-0 w-full min-w-0 overflow-x-hidden overflow-y-auto bg-white">
            {children}
        </div>
    );
}
