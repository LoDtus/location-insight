import type { JSX, ReactNode } from "react";

/** Trải hết phần nội dung cạnh sidebar, cho bảng, bản đồ và số liệu. */
export default function FullWidthLayout({ children }: { children: ReactNode }): JSX.Element {
    return (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
            <div
                id="noi-dung"
                className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-white"
            >
                {children}
            </div>
        </div>
    );
}
