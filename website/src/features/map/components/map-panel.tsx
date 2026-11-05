"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

interface MapPanelProps {
    title: string;
    titleId: string;
    onClose: () => void;
    children: ReactNode;
    /** `wide` cho khung nhiều thông tin (địa điểm + đánh giá). */
    size?: "default" | "wide";
}

/** Khung bên phải trên desktop, bottom sheet trên mobile. Viền nhạt, không dùng viền đen. */
export default function MapPanel({ title, titleId, onClose, children, size = "default" }: MapPanelProps) {
    const width = size === "wide" ? "lg:w-[30rem]" : "lg:w-[24rem]";
    return (
        <div className={`pointer-events-auto absolute inset-x-2 bottom-2 z-20 max-h-[70%] lg:static lg:inset-auto lg:z-auto lg:h-full lg:max-h-none ${width} lg:shrink-0 lg:p-2`}>
            <section
                aria-labelledby={titleId}
                className="flex h-full max-h-full flex-col overflow-hidden rounded-lg border border-charcoal/10 bg-white shadow-[0_8px_28px_rgba(16,17,17,0.14)] lg:shadow-[0_2px_10px_rgba(16,17,17,0.08)]"
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-charcoal/10 py-1.5 pr-1.5 pl-4">
                    <h2 id={titleId} className="m-0 text-base font-semibold">
                        {title}
                    </h2>
                    <button
                        type="button"
                        aria-label="Đóng"
                        className="inline-flex size-10 items-center justify-center rounded-md bg-transparent text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green"
                        onClick={onClose}
                    >
                        <X size={18} aria-hidden />
                    </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 [scrollbar-width:thin]">{children}</div>
            </section>
        </div>
    );
}
