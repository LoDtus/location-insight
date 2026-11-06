"use client";

import { useEffect, useRef, type JSX, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Hộp xác nhận của bản đồ (dùng `<dialog>` gốc: khóa nền, Esc để hủy, focus vào nút hủy). */
export default function MapConfirmDialog({
    title,
    children,
    confirmLabel,
    danger = false,
    busy = false,
    onConfirm,
    onCancel,
}: {
    title: string;
    children: ReactNode;
    confirmLabel: string;
    danger?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}): JSX.Element | null {
    const ref = useRef<HTMLDialogElement>(null);
    const cancelRef = useRef(onCancel);
    useEffect(() => {
        cancelRef.current = onCancel;
    });

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        dialog.showModal();
        dialog.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
        const onCancelEvent = (event: Event): void => {
            event.preventDefault();
            cancelRef.current();
        };
        dialog.addEventListener("cancel", onCancelEvent);
        return () => dialog.removeEventListener("cancel", onCancelEvent);
    }, []);

    if (typeof document === "undefined") return null;
    return createPortal(
        <dialog
            ref={ref}
            aria-labelledby="map-confirm-title"
            className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border-0 bg-white p-0 text-charcoal shadow-[0_24px_64px_rgba(16,17,17,0.28)] backdrop:bg-charcoal/40"
        >
            <div className="grid gap-3 p-5">
                <h2 id="map-confirm-title" className="m-0 text-base font-semibold">
                    {title}
                </h2>
                <div className="text-sm leading-relaxed text-charcoal/80">{children}</div>
                <div className="mt-1 flex justify-end gap-2">
                    <button
                        type="button"
                        data-cancel
                        onClick={onCancel}
                        className="inline-flex min-h-10 items-center rounded-lg bg-transparent px-4 text-sm font-semibold text-charcoal/75 ring-1 ring-charcoal/15 hover:bg-charcoal/5"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onConfirm}
                        className={`inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60 ${danger ? "bg-red-700 hover:bg-red-800" : "bg-green hover:bg-green/90"}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </dialog>,
        document.body,
    );
}
