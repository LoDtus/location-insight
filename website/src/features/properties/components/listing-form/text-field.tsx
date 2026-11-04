"use client";

import type { JSX } from "react";

import { Field, INPUT_CLASS } from "@/features/properties/components/listing-form/form-primitives";
import type { SectionProps } from "@/features/properties/components/listing-form/section-types";
import type { ListingForm } from "@/features/properties/listing-form";

type StringField = {
    [K in keyof ListingForm]: ListingForm[K] extends string ? K : never;
}[keyof ListingForm];

/** Ô nhập chữ hoặc số gắn với một trường chuỗi của form, kèm nhãn, gợi ý và thông báo lỗi. */
export default function TextField({
    name,
    label,
    props,
    required = false,
    hint,
    maxLength,
    inputMode,
    placeholder,
    counter = false,
    transform,
    display,
}: {
    name: StringField;
    label: string;
    props: SectionProps;
    required?: boolean;
    hint?: string;
    maxLength?: number;
    inputMode?: "numeric" | "decimal" | "tel" | "text";
    placeholder?: string;
    counter?: boolean;
    transform?: (value: string) => string;
    display?: (value: string) => string;
}): JSX.Element {
    const { form, errors, set, vi } = props;
    const id = `lf-${name}`;
    const error = errors[name];
    const value = form[name];
    const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
    return (
        <Field id={id} label={label} required={required} hint={hint} error={error} vi={vi} counter={counter && maxLength ? `${value.length}/${maxLength}` : undefined}>
            <input
                id={id}
                className={INPUT_CLASS}
                value={display ? display(value) : value}
                maxLength={maxLength}
                inputMode={inputMode}
                placeholder={placeholder}
                aria-invalid={Boolean(error)}
                aria-required={required}
                aria-describedby={describedBy}
                onChange={(event) => set(name, (transform ? transform(event.target.value) : event.target.value) as ListingForm[StringField])}
            />
        </Field>
    );
}
