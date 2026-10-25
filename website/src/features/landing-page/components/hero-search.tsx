"use client";

import type { FormEvent } from "react";

export default function HeroSearch({
    placeholder,
    submit,
}: {
    placeholder: string;
    submit: string;
}) {
    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
    }

    return (
        <form
            className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row"
            onSubmit={handleSubmit}
        >
            <input
                name="address"
                type="text"
                placeholder={placeholder}
                aria-label={placeholder}
                className="m-0 min-w-0 flex-1 rounded-full border border-charcoal/20 bg-cream px-5 py-3 text-charcoal"
            />
            <button
                type="submit"
                className="rounded-full bg-green px-6 py-3 text-cream"
            >
                {submit}
            </button>
        </form>
    );
}
