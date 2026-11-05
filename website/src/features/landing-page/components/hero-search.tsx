"use client";

import { Search } from "lucide-react";
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
            className="mt-10 flex max-w-xl flex-col gap-2 sm:flex-row"
            onSubmit={handleSubmit}
        >
            <input
                name="address"
                type="text"
                placeholder={placeholder}
                aria-label={placeholder}
                className="m-0 min-h-14 min-w-0 flex-1 bg-white px-5 text-base text-charcoal placeholder:text-charcoal/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            />
            <button
                type="submit"
                className="inline-flex min-h-14 items-center justify-center gap-2 bg-gold px-8 text-base font-semibold tracking-wide text-charcoal transition-colors hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
            >
                <Search size={18} aria-hidden="true" />
                {submit}
            </button>
        </form>
    );
}
