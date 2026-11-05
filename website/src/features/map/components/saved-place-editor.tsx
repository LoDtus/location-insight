"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type JSX } from "react";

/** Khớp MAP_LABEL_MAX / MAP_NOTE_MAX ở backend. */
export const LABEL_MAX = 80;
export const NOTE_MAX = 1000;

interface SavedPlaceEditorProps {
    mode: "label" | "note";
    initial: string;
    /** Tên gốc, gợi ý trong ô tên gợi nhớ. */
    placeholder?: string;
    /** Trả về thông báo lỗi, hoặc null khi đã lưu. */
    onSave: (value: string) => Promise<string | null>;
    onCancel: () => void;
}

/** Ô sửa tại chỗ cho tên gợi nhớ (một dòng) hoặc ghi chú (nhiều dòng) của địa điểm đã lưu. */
export default function SavedPlaceEditor({ mode, initial, placeholder, onSave, onCancel }: SavedPlaceEditorProps): JSX.Element {
    const id = useId();
    const [value, setValue] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
    const max = mode === "label" ? LABEL_MAX : NOTE_MAX;
    const label = mode === "label" ? "Tên gợi nhớ" : "Ghi chú";

    useEffect(() => {
        const field = fieldRef.current;
        if (!field) return;
        field.focus();
        field.setSelectionRange(field.value.length, field.value.length);
    }, []);

    async function submit(): Promise<void> {
        if (saving) return;
        setSaving(true);
        setError(null);
        const message = await onSave(value.trim());
        setSaving(false);
        if (message) setError(message);
    }

    function onKeyDown(event: React.KeyboardEvent): void {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
        } else if (event.key === "Enter" && (mode === "label" || event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void submit();
        }
    }

    const field =
        "w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal outline-none placeholder:text-charcoal/40 focus:border-green focus:ring-2 focus:ring-green/20";

    return (
        <form
            className="grid gap-2 rounded-lg bg-charcoal/[0.03] p-2.5"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <label htmlFor={id} className="flex items-baseline justify-between text-xs font-semibold text-charcoal/75">
                {label}
                <span className="font-normal text-charcoal/45 tabular-nums">
                    {value.length}/{max}
                </span>
            </label>
            {mode === "label" ? (
                <input
                    ref={fieldRef}
                    id={id}
                    type="text"
                    value={value}
                    maxLength={max}
                    placeholder={placeholder ? `Ví dụ: Nhà bà ngoại (tên gốc: ${placeholder})` : "Ví dụ: Nhà bà ngoại"}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={onKeyDown}
                    className={field}
                />
            ) : (
                <textarea
                    ref={fieldRef}
                    id={id}
                    rows={3}
                    value={value}
                    maxLength={max}
                    placeholder="Ghi chú riêng của bạn về địa điểm này"
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={onKeyDown}
                    className={`${field} min-h-20 resize-y`}
                />
            )}
            {error ? (
                <p role="alert" className="m-0 text-xs text-red-700">
                    {error}
                </p>
            ) : null}
            <div className="flex items-center justify-end gap-1.5">
                {mode === "label" && initial ? (
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                            setValue("");
                            void onSave("").then((message) => message && setError(message));
                        }}
                        className="mr-auto rounded-md bg-transparent px-2 py-1.5 text-xs font-semibold text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal"
                    >
                        Dùng tên gốc
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md bg-transparent px-3 py-1.5 text-xs font-semibold text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal"
                >
                    Hủy
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-md bg-green px-3 py-1.5 text-xs font-semibold text-cream hover:bg-green/90 disabled:opacity-60"
                >
                    {saving ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null} Lưu
                </button>
            </div>
        </form>
    );
}
