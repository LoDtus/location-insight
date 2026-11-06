"use client";

import { Flag, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";

import { REPORT_REASONS, type ReportReason } from "@/features/discussions/discussions.api";

/** Hộp báo cáo bài: chọn một lý do (bắt buộc), ghi chú thêm tùy chọn (bắt buộc khi chọn "Lý do khác"). */
export function ReportPostDialog({
    authorName,
    onSubmit,
    onClose,
}: {
    authorName: string;
    /** Trả về thông báo lỗi hoặc null khi đã gửi. */
    onSubmit: (input: { reason: ReportReason; note: string }) => Promise<string | null>;
    onClose: () => void;
}): JSX.Element | null {
    const ref = useRef<HTMLDialogElement>(null);
    const noteId = useId();
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [note, setNote] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    });

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        dialog.showModal();
        const onCancel = (event: Event): void => {
            event.preventDefault();
            closeRef.current();
        };
        dialog.addEventListener("cancel", onCancel);
        return () => dialog.removeEventListener("cancel", onCancel);
    }, []);

    const needsNote = reason === "other" && note.trim().length < 5;

    async function submit(): Promise<void> {
        if (!reason || needsNote) return;
        setPending(true);
        setError(null);
        const message = await onSubmit({ reason, note: note.trim() });
        setPending(false);
        if (message) setError(message);
    }

    if (typeof document === "undefined") return null;
    return createPortal(
        <dialog
            ref={ref}
            aria-labelledby="report-title"
            className="m-auto w-[min(30rem,calc(100%-2rem))] rounded-2xl border-0 bg-white p-0 text-charcoal shadow-[0_24px_64px_rgba(16,17,17,0.28)] backdrop:bg-charcoal/40"
        >
            <form
                className="grid gap-3 p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                }}
            >
                <div className="flex items-start gap-3">
                    <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
                        <Flag className="size-4" />
                    </span>
                    <div>
                        <h2 id="report-title" className="m-0 text-base font-semibold">
                            Báo cáo bài của {authorName}
                        </h2>
                        <p className="m-0 mt-0.5 text-xs text-charcoal/60">
                            Đội kiểm duyệt sẽ xem xét. Người đăng không biết ai đã báo cáo.
                        </p>
                    </div>
                </div>
                <fieldset className="m-0 grid gap-1 border-0 p-0">
                    <legend className="mb-1 p-0 text-sm font-semibold">Vì sao bài này có vấn đề?</legend>
                    {REPORT_REASONS.map((item) => (
                        <label
                            key={item.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 ring-1 ${reason === item.id ? "bg-green/5 ring-green/40" : "ring-transparent hover:bg-charcoal/[0.04]"}`}
                        >
                            <input
                                type="radio"
                                name="report-reason"
                                value={item.id}
                                checked={reason === item.id}
                                onChange={() => setReason(item.id)}
                                className="mt-1 size-4 accent-green"
                            />
                            <span>
                                <span className="block text-sm font-semibold">{item.label}</span>
                                <span className="block text-xs text-charcoal/60">{item.hint}</span>
                            </span>
                        </label>
                    ))}
                </fieldset>
                <div className="grid gap-1">
                    <label htmlFor={noteId} className="text-sm font-semibold">
                        Mô tả thêm {reason === "other" ? "" : <span className="font-normal text-charcoal/50">(không bắt buộc)</span>}
                    </label>
                    <textarea
                        id={noteId}
                        rows={3}
                        maxLength={500}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Chi tiết giúp kiểm duyệt xử lý nhanh hơn"
                        className="w-full resize-y rounded-xl border border-charcoal/15 px-3 py-2 text-sm outline-none placeholder:text-charcoal/40 focus:border-green focus:ring-2 focus:ring-green/20"
                    />
                    <span className="text-right text-[11px] text-charcoal/45 tabular-nums">{note.length}/500</span>
                </div>
                {error ? (
                    <p role="alert" className="m-0 text-sm text-red-700">
                        {error}
                    </p>
                ) : null}
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex min-h-10 items-center rounded-xl bg-transparent px-4 text-sm font-semibold text-charcoal/75 ring-1 ring-charcoal/15 hover:bg-charcoal/5"
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        disabled={!reason || needsNote || pending}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                    >
                        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Gửi báo cáo
                    </button>
                </div>
            </form>
        </dialog>,
        document.body,
    );
}
