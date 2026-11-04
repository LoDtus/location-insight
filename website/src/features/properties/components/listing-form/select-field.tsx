"use client";

import type { JSX } from "react";

import { Field, INPUT_CLASS } from "@/shared/components/form/form-primitives";
import type { SectionProps } from "@/features/properties/components/listing-form/section-types";
import type { ListingForm } from "@/features/properties/listing-form";

type SelectName = {
    [K in keyof ListingForm]: ListingForm[K] extends string ? K : never;
}[keyof ListingForm];

/** Ô chọn gắn với một trường chuỗi của form. Giá trị rỗng là "chưa chọn". */
export default function SelectField({
    name,
    label,
    props,
    options,
    placeholder,
    required = false,
    hint,
}: {
    name: SelectName;
    label: string;
    props: SectionProps;
    options: readonly { value: string; label: string }[];
    placeholder: string;
    required?: boolean;
    hint?: string;
}): JSX.Element {
    const { form, errors, set, vi } = props;
    const id = `lf-${name}`;
    const error = errors[name];
    return (
        <Field id={id} label={label} required={required} hint={hint} error={error} vi={vi}>
            <select
                id={id}
                className={INPUT_CLASS}
                value={form[name]}
                aria-invalid={Boolean(error)}
                aria-required={required}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(event) => set(name, event.target.value as ListingForm[SelectName])}
            >
                <option value="">{placeholder}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </Field>
    );
}
