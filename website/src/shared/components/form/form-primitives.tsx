"use client";

import type { JSX, ReactNode } from "react";

/** Thông báo lỗi hai ngôn ngữ của một trường. */
export type FieldError = { vi: string; en: string };

export const INPUT_CLASS =
    "box-border min-h-11 w-full rounded-xl border border-charcoal/20 bg-white px-4 text-sm text-charcoal placeholder:text-charcoal/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green aria-[invalid=true]:border-red-600";

/** Thẻ nhóm mục, đánh số như trang đăng sản phẩm của các sàn thương mại điện tử. */
export function SectionCard({
    id,
    step,
    title,
    hint,
    children,
}: {
    id: string;
    step: number;
    title: string;
    hint?: string;
    children: ReactNode;
}): JSX.Element {
    return (
        <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 rounded-2xl border border-charcoal/15 bg-white p-5 sm:p-6">
            <header className="mb-5 flex items-start gap-3">
                <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-green text-sm font-semibold text-cream">
                    {step}
                </span>
                <div>
                    <h2 id={`${id}-title`} className="m-0 text-lg font-semibold">
                        {title}
                    </h2>
                    {hint ? <p className="mt-1 mb-0 text-sm text-charcoal/70">{hint}</p> : null}
                </div>
            </header>
            <div className="grid gap-5">{children}</div>
        </section>
    );
}

export function Field({
    id,
    label,
    required = false,
    hint,
    error,
    vi,
    counter,
    children,
}: {
    id: string;
    label: string;
    required?: boolean;
    hint?: string;
    error?: FieldError;
    vi: boolean;
    counter?: string;
    children: ReactNode;
}): JSX.Element {
    const message = error ? (vi ? error.vi : error.en) : "";
    return (
        <div className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={id} className="text-sm font-semibold">
                    {label}
                    {required ? (
                        <span aria-hidden="true" className="ml-0.5 text-red-600">
                            *
                        </span>
                    ) : null}
                </label>
                {counter ? <span className="text-xs text-charcoal/60">{counter}</span> : null}
            </div>
            {children}
            {hint ? (
                <p id={`${id}-hint`} className="m-0 text-xs text-charcoal/60">
                    {hint}
                </p>
            ) : null}
            {message ? (
                <p id={`${id}-error`} role="alert" className="m-0 text-xs text-red-700">
                    {message}
                </p>
            ) : null}
        </div>
    );
}

export function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: readonly { id: T; label: string }[];
    onChange: (value: T) => void;
}): JSX.Element {
    return (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
            {options.map((option) => {
                const active = option.id === value;
                return (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(option.id)}
                        className={`min-h-11 rounded-xl border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${active ? "border-green bg-green/10 text-green" : "border-charcoal/20 bg-white text-charcoal hover:border-charcoal/40"}`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export function Toggle({
    id,
    checked,
    label,
    onChange,
}: {
    id: string;
    checked: boolean;
    label: string;
    onChange: (value: boolean) => void;
}): JSX.Element {
    return (
        <label htmlFor={id} className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
            <input id={id} type="checkbox" className="size-4 accent-green" checked={checked} onChange={(event) => onChange(event.target.checked)} />
            {label}
        </label>
    );
}
