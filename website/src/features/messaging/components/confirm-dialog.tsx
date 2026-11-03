"use client";

import { useState, type JSX, type ReactNode } from "react";

import { errorText } from "../messaging.actions";
import { Dialog } from "./dialog";

/** Hộp xác nhận cho thao tác khó hoàn tác; giữ nguyên hộp và báo lỗi nếu thao tác thất bại. */
export function ConfirmDialog({
    title,
    children,
    confirmLabel,
    cancelLabel = "Hủy",
    danger = false,
    onConfirm,
    onClose,
}: {
    title: string;
    children: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
    onClose: () => void;
}): JSX.Element {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function confirm(): Promise<void> {
        setBusy(true);
        setError("");
        try {
            await onConfirm();
            onClose();
        } catch (failure) {
            setError(errorText(failure));
            setBusy(false);
        }
    }

    return (
        <Dialog title={title} onClose={busy ? () => undefined : onClose}>
            <div className="text-sm text-charcoal/80">{children}</div>
            {error ? (
                <p role="alert" className="m-0 mt-3 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
                <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 rounded-full border border-charcoal/25 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-green disabled:opacity-50"
                    onClick={onClose}
                >
                    {cancelLabel}
                </button>
                <button
                    type="button"
                    disabled={busy}
                    className={`min-h-11 rounded-full px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-60 ${danger ? "bg-red-700" : "bg-charcoal"}`}
                    onClick={() => void confirm()}
                >
                    {busy ? "Đang xử lý…" : confirmLabel}
                </button>
            </div>
        </Dialog>
    );
}
