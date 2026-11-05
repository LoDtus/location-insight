"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type JSX, type ReactNode } from "react";

export function Dialog({
    title,
    onClose,
    children,
    wide = false,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    wide?: boolean;
}): JSX.Element {
    const panel = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusable = panel.current?.querySelector<HTMLElement>(
            'input, textarea, select, button:not([data-dialog-close])',
        );
        (focusable ?? panel.current)?.focus();
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                event.stopPropagation();
                onClose();
                return;
            }
            if (event.key !== "Tab" || !panel.current) return;
            const items = [
                ...panel.current.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ),
            ];
            if (!items.length) return;
            const first = items[0] as HTMLElement;
            const last = items[items.length - 1] as HTMLElement;
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            previous?.focus();
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-charcoal/45 p-0 sm:items-center sm:p-4">
            <button type="button" className="absolute inset-0 cursor-default" aria-label="Đóng" tabIndex={-1} onClick={onClose} />
            <div
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                className={`relative flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-white shadow-xl outline-none sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
            >
                <header className="flex items-center justify-between gap-3 border-b border-charcoal/10 px-5 py-3">
                    <h2 className="m-0 text-base font-semibold">{title}</h2>
                    <button
                        type="button"
                        data-dialog-close
                        className="inline-flex size-11 items-center justify-center rounded-full hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        aria-label="Đóng"
                        onClick={onClose}
                    >
                        <X className="size-5" aria-hidden="true" />
                    </button>
                </header>
                <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
            </div>
        </div>
    );
}
