"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";

/** Chỉ cần địa chỉ ảnh: dùng được cho ảnh tin nhắn, danh sách đã gửi và phản hồi. */
export interface LightboxFile {
    id: string;
    url: string;
}

export function Lightbox({
    files,
    start,
    onClose,
}: {
    files: LightboxFile[];
    start: number;
    onClose: () => void;
}): JSX.Element {
    const [index, setIndex] = useState(start);
    const closeButton = useRef<HTMLButtonElement>(null);
    const current = files[index];

    useEffect(() => {
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        closeButton.current?.focus();
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
            if (event.key === "ArrowRight") setIndex((value) => Math.min(files.length - 1, value + 1));
            if (event.key === "Tab") event.preventDefault();
        }
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            previous?.focus();
        };
    }, [files.length, onClose]);

    if (!current) return <></>;
    return (
        <div role="dialog" aria-modal="true" aria-label="Xem ảnh" className="fixed inset-0 z-[70] flex items-center justify-center bg-charcoal/90">
            <button type="button" className="absolute inset-0 cursor-default" aria-label="Đóng" tabIndex={-1} onClick={onClose} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={`Ảnh ${index + 1} trên ${files.length}`} className="relative max-h-[88vh] max-w-[92vw] rounded-lg object-contain" />
            <button
                ref={closeButton}
                type="button"
                className="absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-full bg-white/15 text-white focus-visible:outline-2 focus-visible:outline-white"
                aria-label="Đóng"
                onClick={onClose}
            >
                <X className="size-6" aria-hidden="true" />
            </button>
            {index > 0 ? (
                <button
                    type="button"
                    className="absolute left-4 inline-flex size-11 items-center justify-center rounded-full bg-white/15 text-white focus-visible:outline-2 focus-visible:outline-white"
                    aria-label="Ảnh trước"
                    onClick={() => setIndex(index - 1)}
                >
                    <ChevronLeft className="size-6" aria-hidden="true" />
                </button>
            ) : null}
            {index < files.length - 1 ? (
                <button
                    type="button"
                    className="absolute right-4 inline-flex size-11 items-center justify-center rounded-full bg-white/15 text-white focus-visible:outline-2 focus-visible:outline-white"
                    aria-label="Ảnh sau"
                    onClick={() => setIndex(index + 1)}
                >
                    <ChevronRight className="size-6" aria-hidden="true" />
                </button>
            ) : null}
        </div>
    );
}
