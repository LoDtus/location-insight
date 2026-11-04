import type { JSX, ReactNode } from "react";

/** Cột đọc, cùng bề ngang với max-w-960 của bố cục tham chiếu. */
export function FocusLayout({ children }: { children: ReactNode }): JSX.Element {
    return (
        <div className="flex h-full min-h-0 w-full justify-center">
            <div className="h-full min-h-0 w-full max-w-[960px] overflow-x-hidden overflow-y-auto">
                {children}
            </div>
        </div>
    );
}
