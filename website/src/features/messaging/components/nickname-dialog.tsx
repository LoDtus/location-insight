"use client";

import { useState, type FormEvent, type JSX } from "react";

import { errorText, saveNickname } from "../messaging.actions";
import { Dialog } from "./dialog";

const NICKNAME_MAX = 50;

export function NicknameDialog({
    conversationId,
    realName,
    current,
    onClose,
}: {
    conversationId: string;
    realName: string;
    current: string | null;
    onClose: () => void;
}): JSX.Element {
    const [value, setValue] = useState(current ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function save(next: string | null): Promise<void> {
        setBusy(true);
        setError("");
        try {
            await saveNickname(conversationId, next);
            onClose();
        } catch (failure) {
            setError(errorText(failure));
            setBusy(false);
        }
    }

    function submit(event: FormEvent): void {
        event.preventDefault();
        const trimmed = value.trim();
        void save(trimmed === "" ? null : trimmed);
    }

    return (
        <Dialog title="Đổi biệt danh" onClose={onClose}>
            <form onSubmit={submit} className="grid gap-3">
                <p className="m-0 text-sm text-charcoal/75">
                    Biệt danh chỉ mình bạn nhìn thấy. {realName} sẽ không biết bạn đặt tên này.
                </p>
                <label className="grid gap-1.5 text-sm font-semibold">
                    Biệt danh cho {realName}
                    <input
                        type="text"
                        value={value}
                        maxLength={NICKNAME_MAX}
                        autoComplete="off"
                        placeholder={realName}
                        className="min-h-11 rounded-xl border border-charcoal/25 px-3 text-base font-normal outline-none focus-visible:border-green focus-visible:outline-2 focus-visible:outline-green"
                        onChange={(event) => setValue(event.target.value)}
                    />
                    <span className="text-xs font-normal text-charcoal/60">
                        {Array.from(value).length}/{NICKNAME_MAX}
                    </span>
                </label>
                {error ? (
                    <p role="alert" className="m-0 text-sm text-red-700">
                        {error}
                    </p>
                ) : null}
                <div className="flex flex-wrap justify-between gap-2">
                    {current ? (
                        <button
                            type="button"
                            disabled={busy}
                            className="min-h-11 rounded-full px-4 font-semibold underline focus-visible:outline-2 focus-visible:outline-green disabled:opacity-50"
                            onClick={() => void save(null)}
                        >
                            Xóa biệt danh
                        </button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            className="min-h-11 rounded-full border border-charcoal/25 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-green disabled:opacity-50"
                            onClick={onClose}
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="min-h-11 rounded-full bg-green px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-60"
                        >
                            {busy ? "Đang lưu…" : "Lưu"}
                        </button>
                    </div>
                </div>
            </form>
        </Dialog>
    );
}
