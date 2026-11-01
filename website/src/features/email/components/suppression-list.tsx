"use client";

import { useEffect, useState, type JSX } from "react";

import { AuthApiError } from "@/features/auth/auth.api";

import { addSuppression, listSuppressions, removeSuppression, type Suppression } from "../email.api";

const REASON: Record<Suppression["reason"], string> = {
    hard_bounce: "Địa chỉ không tồn tại",
    complaint: "Khiếu nại spam",
    manual: "Thêm thủ công",
};

function errorText(error: unknown): string {
    return error instanceof AuthApiError ? error.message : "Có lỗi xảy ra. Hãy thử lại.";
}

export function SuppressionList(): JSX.Element {
    const [items, setItems] = useState<Suppression[] | null>(null);
    const [email, setEmail] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        void listSuppressions()
            .then((list) => {
                if (!cancelled) setItems(list);
            })
            .catch((failure: unknown) => {
                if (!cancelled) setError(errorText(failure));
            });
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    async function act(action: () => Promise<unknown>): Promise<void> {
        setError("");
        try {
            await action();
            setReloadKey((n) => n + 1);
        } catch (failure) {
            setError(errorText(failure));
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <p className="m-0 max-w-prose text-sm text-charcoal/70">
                Hệ thống không gửi email tới các địa chỉ dưới đây. Địa chỉ không tồn tại được thêm tự động khi máy chủ nhận từ chối.
            </p>
            <form
                className="flex flex-wrap gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    void act(async () => {
                        await addSuppression(email.trim(), note.trim());
                        setEmail("");
                        setNote("");
                    });
                }}
            >
                <label className="sr-only" htmlFor="sup-email">Email cần chặn</label>
                <input id="sup-email" type="email" required className="min-h-11 min-w-0 flex-1 rounded-md border border-charcoal/25 px-3 text-sm" placeholder="Email cần chặn" value={email} onChange={(event) => setEmail(event.target.value)} />
                <label className="sr-only" htmlFor="sup-note">Ghi chú</label>
                <input id="sup-note" maxLength={200} className="min-h-11 min-w-0 flex-1 rounded-md border border-charcoal/25 px-3 text-sm" placeholder="Ghi chú (tùy chọn)" value={note} onChange={(event) => setNote(event.target.value)} />
                <button type="submit" className="min-h-11 rounded-md bg-green px-4 text-sm font-medium text-white">Chặn</button>
            </form>
            {error ? <p role="alert" className="m-0 text-sm text-red-700">{error}</p> : null}
            {!items ? (
                <p className="m-0 text-sm text-charcoal/70">Đang tải…</p>
            ) : items.length === 0 ? (
                <p className="m-0 text-sm text-charcoal/70">Chưa có địa chỉ nào bị chặn.</p>
            ) : (
                <ul className="m-0 flex list-none flex-col divide-y divide-charcoal/10 p-0">
                    {items.map((item) => (
                        <li key={item.email} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <span className="min-w-0">
                                <span className="block break-all font-medium">{item.email}</span>
                                <span className="text-xs text-charcoal/60">
                                    {REASON[item.reason]}
                                    {item.note ? ` — ${item.note}` : ""} · {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                                </span>
                            </span>
                            <button type="button" className="min-h-9 shrink-0 rounded-md border border-charcoal/25 px-3 text-xs" onClick={() => void act(() => removeSuppression(item.email))}>
                                Bỏ chặn
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
