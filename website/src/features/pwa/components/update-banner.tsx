"use client";

import type { JSX } from "react";

export function UpdateBanner({ onReload }: { onReload: () => void }): JSX.Element {
    return (
        <div
            role="status"
            className="fixed inset-x-0 top-0 z-50 flex min-h-11 items-center justify-center gap-3 bg-green px-4 pt-[env(safe-area-inset-top)] text-sm text-cream"
        >
            <span>Có phiên bản mới</span>
            <button
                type="button"
                className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
                onClick={onReload}
            >
                Tải lại
            </button>
        </div>
    );
}
