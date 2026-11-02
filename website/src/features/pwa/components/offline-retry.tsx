"use client";

import type { JSX } from "react";

export function OfflineRetry(): JSX.Element {
    return (
        <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full bg-green px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
            onClick={() => window.location.reload()}
        >
            Thử lại
        </button>
    );
}
