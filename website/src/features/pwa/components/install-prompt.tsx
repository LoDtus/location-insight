"use client";

import type { JSX } from "react";

export function InstallPrompt({ onInstall, onLater }: { onInstall: () => void; onLater: () => void }): JSX.Element {
    return (
        <aside
            aria-label="Cài đặt ứng dụng"
            className="fixed bottom-4 left-4 z-40 w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-charcoal/15 bg-white p-4 text-charcoal shadow-sm motion-safe:animate-none"
        >
            <p className="m-0 text-sm">Cài Địa Thế để mở nhanh và nhận thông báo.</p>
            <div className="mt-3 flex gap-2">
                <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-full bg-green px-4 text-sm font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    onClick={onInstall}
                >
                    Cài đặt
                </button>
                <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    onClick={onLater}
                >
                    Để sau
                </button>
            </div>
        </aside>
    );
}
