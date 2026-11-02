"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

interface MapPanelProps {
    title: string;
    titleId: string;
    onClose: () => void;
    children: ReactNode;
}

/** Khung bên phải trên desktop, bottom sheet trên mobile. */
export default function MapPanel({ title, titleId, onClose, children }: MapPanelProps) {
    return (
        <div className="pointer-events-auto absolute inset-x-2 bottom-2 z-20 max-h-[60%] lg:static lg:inset-auto lg:z-auto lg:h-full lg:max-h-none lg:w-[24rem] lg:shrink-0 lg:p-2">
            <section
                aria-labelledby={titleId}
                className="flex h-full max-h-full flex-col rounded-lg border bg-white p-3 shadow-lg lg:shadow-none"
            >
                <div className="flex items-center justify-between gap-3">
                    <h2 id={titleId} className="m-0 text-base font-semibold">
                        {title}
                    </h2>
                    <button
                        type="button"
                        aria-label="Đóng"
                        className="inline-flex size-11 items-center justify-center rounded-lg border bg-white"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">{children}</div>
            </section>
        </div>
    );
}
