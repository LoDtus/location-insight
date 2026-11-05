"use client";

import type { JSX } from "react";

export const WEIGHT_LEVELS = [0, 1, 2, 3, 4, 5] as const;

/** Mô tả ngắn cho từng mức (đọc màn hình và tooltip). */
export function weightLabel(weight: number): string {
    if (weight === 0) return "Không tính";
    if (weight === 1) return "Ít quan trọng";
    if (weight <= 3) return "Quan trọng vừa";
    return "Rất quan trọng";
}

/**
 * Chọn trọng số 0–5 bằng một dãy nút (radiogroup, ←/→ để đổi). Mức mặc định có chấm nhỏ bên dưới để biết
 * mình đã lệch khỏi mặc định chưa.
 */
export default function WeightPicker({
    value,
    defaultValue,
    label,
    disabled = false,
    onChange,
}: {
    value: number;
    defaultValue: number;
    /** Tên tiêu chí, dùng cho nhãn đọc màn hình. */
    label: string;
    disabled?: boolean;
    onChange: (weight: number) => void;
}): JSX.Element {
    return (
        <div
            role="radiogroup"
            aria-label={`Trọng số: ${label}`}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-charcoal/[0.05] p-0.5"
            onKeyDown={(event) => {
                if (disabled) return;
                if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                    event.preventDefault();
                    onChange(Math.min(5, value + 1));
                } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                    event.preventDefault();
                    onChange(Math.max(0, value - 1));
                }
            }}
        >
            {WEIGHT_LEVELS.map((level) => {
                const checked = level === value;
                return (
                    <button
                        key={level}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-label={`${level} – ${weightLabel(level)}${level === defaultValue ? " (mặc định)" : ""}`}
                        title={`${weightLabel(level)}${level === defaultValue ? " · mặc định" : ""}`}
                        tabIndex={checked ? 0 : -1}
                        disabled={disabled}
                        onClick={() => onChange(level)}
                        className={`relative inline-flex size-7 items-center justify-center rounded-md text-xs font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green disabled:opacity-50 ${
                            !checked
                                ? "bg-transparent text-charcoal/55 hover:bg-white/70 hover:text-charcoal"
                                : value !== defaultValue
                                  ? "bg-gold/25 text-charcoal shadow-sm ring-1 ring-gold/70"
                                  : "bg-white text-charcoal shadow-sm ring-1 ring-charcoal/15"
                        }`}
                    >
                        {level}
                        {level === defaultValue ? <span aria-hidden className="absolute bottom-0.5 size-1 rounded-full bg-charcoal/35" /> : null}
                    </button>
                );
            })}
        </div>
    );
}
