"use client";

import { useState, type JSX } from "react";

import { errorText } from "../messaging.actions";
import { reportMessage } from "../messaging.api";
import type { Message } from "../messaging.types";
import { Dialog } from "./dialog";

const REASONS: Array<{ code: string; label: string }> = [
    { code: "spam", label: "Spam hoặc quảng cáo" },
    { code: "scam", label: "Lừa đảo" },
    { code: "harassment", label: "Quấy rối hoặc đe dọa" },
    { code: "sexual", label: "Nội dung nhạy cảm" },
    { code: "other", label: "Lý do khác" },
];

export function ReportDialog({
    conversationId,
    message,
    onClose,
    onDone,
}: {
    conversationId: string;
    message: Message;
    onClose: () => void;
    onDone: (text: string) => void;
}): JSX.Element {
    const [reason, setReason] = useState("spam");
    const [note, setNote] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");

    async function submit(): Promise<void> {
        setPending(true);
        setError("");
        try {
            await reportMessage(conversationId, message.id, { reasonCode: reason, note: note.trim() || undefined });
            onDone("Đã gửi báo cáo. Người vận hành sẽ xem tin này và vài tin quanh nó.");
        } catch (failure) {
            setError(errorText(failure));
            setPending(false);
        }
    }

    return (
        <Dialog title="Báo cáo tin nhắn" onClose={onClose}>
            <p className="m-0 text-sm text-charcoal/75">
                Tin nhắn không được mã hóa đầu cuối. Khi bạn báo cáo, người vận hành có thể xem tin này và tối đa 10 tin xung quanh.
            </p>
            <fieldset className="mt-4 grid gap-1 border-0 p-0">
                <legend className="mb-1 text-sm font-semibold">Lý do</legend>
                {REASONS.map((item) => (
                    <label key={item.code} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-cream">
                        <input
                            type="radio"
                            name="reason"
                            value={item.code}
                            checked={reason === item.code}
                            onChange={() => setReason(item.code)}
                            className="size-4 accent-green"
                        />
                        {item.label}
                    </label>
                ))}
            </fieldset>
            <label className="mt-3 block text-sm font-semibold">
                Ghi chú (không bắt buộc)
                <textarea
                    value={note}
                    maxLength={500}
                    rows={3}
                    onChange={(event) => setNote(event.target.value)}
                    className="mt-1 w-full resize-none rounded-xl border border-charcoal/25 p-3 text-base font-normal focus-visible:outline-2 focus-visible:outline-green"
                />
            </label>
            {error ? (
                <p role="alert" className="mt-3 mb-0 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
                <button
                    type="button"
                    className="min-h-11 rounded-full border border-charcoal/25 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-green"
                    onClick={onClose}
                >
                    Hủy
                </button>
                <button
                    type="button"
                    className="min-h-11 rounded-full bg-green px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-60"
                    disabled={pending}
                    onClick={() => void submit()}
                >
                    {pending ? "Đang gửi…" : "Gửi báo cáo"}
                </button>
            </div>
        </Dialog>
    );
}
