import type { JSX, ReactNode } from "react";

/** Cột đọc giới hạn max-w-960 của Tailwind (960 × 4px), giữa trang. Phần cuộn là chính khung này nên id dùng để nhớ vị trí cuộn. */
export default function FocusLayout({ children }: { children: ReactNode }): JSX.Element {
    return (
        <div className="flex h-full min-h-0 w-full flex-1 justify-center">
            <div
                id="noi-dung"
                className="flex h-full min-h-0 w-full max-w-960 flex-col overflow-x-hidden overflow-y-auto"
            >
                {children}
            </div>
        </div>
    );
}
