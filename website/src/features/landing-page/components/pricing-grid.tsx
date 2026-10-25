"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useLocaleMessages } from "@/shared/hooks/useLocale";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const ITEM_KEYS = ["0", "1", "2"] as const;

const BUTTON_CLASS =
    "inline-flex min-h-11 items-center rounded-full px-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

export default function PricingGrid() {
    const messages = useLocaleMessages("landing");
    const confirmRef = useRef<HTMLParagraphElement>(null);
    const [confirm, setConfirm] = useState("");

    useEffect(() => {
        if (confirm) {
            confirmRef.current?.focus();
        }
    }, [confirm]);

    function text(path: string[]): string {
        return getLocaleValue(messages, path);
    }

    function items(plan: string): string[] {
        return ITEM_KEYS.map((key) => text(["pricing", plan, "items", key])).filter(
            (item) => item !== "",
        );
    }

    function choose(plan: string, cycle: string, amount: string): void {
        setConfirm(
            text(["pricing", "confirm"])
                .replace("{plan}", plan)
                .replace("{cycle}", cycle)
                .replace("{amount}", amount),
        );
    }

    const paid = [
        { id: "unlimited", recommended: true },
        { id: "valued", recommended: false },
    ] as const;

    return (
        <div>
            <div className="mt-8 grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
                <article className="flex flex-col gap-3 rounded-2xl border border-charcoal/15 bg-white p-6">
                    <h3 className="m-0 text-lg font-semibold">
                        {text(["pricing", "free", "name"])}
                    </h3>
                    <p className="m-0 tabular-nums">
                        <strong className="text-2xl font-semibold tracking-tight">
                            {text(["pricing", "free", "price"])}
                        </strong>
                    </p>
                    <ul className="m-0 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                        {items("free").map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                    <div className="mt-auto pt-2">
                        <Link
                            href="/auth/register"
                            className={`${BUTTON_CLASS} border border-charcoal/20 bg-white font-semibold text-charcoal`}
                        >
                            {text(["pricing", "free", "cta"])}
                        </Link>
                    </div>
                </article>
                {paid.map((plan) => (
                    <article
                        key={plan.id}
                        className={`flex flex-col gap-3 rounded-2xl bg-white p-6 ${plan.recommended ? "border-2 border-green" : "border border-charcoal/15"}`}
                    >
                        <h3 className="m-0 text-lg font-semibold">
                            {text(["pricing", plan.id, "name"])}
                        </h3>
                        {plan.recommended ? (
                            <p className="m-0 text-sm leading-relaxed text-charcoal/70">
                                {text(["pricing", plan.id, "hint"])}
                            </p>
                        ) : null}
                        <p className="m-0 tabular-nums">
                            <strong className="text-2xl font-semibold tracking-tight">
                                {text(["pricing", plan.id, "month"])}
                            </strong>{" "}
                            <span className="text-sm text-charcoal/70">
                                {text(["pricing", "perMonth"])}
                            </span>
                        </p>
                        <p className="m-0 tabular-nums">
                            <strong className="text-2xl font-semibold tracking-tight">
                                {text(["pricing", plan.id, "year"])}
                            </strong>{" "}
                            <span className="text-sm text-charcoal/70">
                                {text(["pricing", "perYear"])}
                            </span>
                        </p>
                        <p className="m-0 text-sm text-charcoal/70">
                            {text(["pricing", "yearNote"])}
                        </p>
                        <ul className="m-0 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                            {items(plan.id).map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                        <div className="mt-auto flex flex-wrap gap-2 pt-2">
                            <button
                                type="button"
                                className={`${BUTTON_CLASS} ${plan.recommended ? "bg-green text-cream" : "border border-charcoal/20 bg-white text-charcoal"}`}
                                onClick={() =>
                                    choose(
                                        text(["pricing", plan.id, "name"]),
                                        text(["pricing", "cycleMonth"]),
                                        text(["pricing", plan.id, "month"]),
                                    )
                                }
                            >
                                {text(["pricing", "monthCta"])}
                            </button>
                            <button
                                type="button"
                                className={`${BUTTON_CLASS} border border-charcoal/20 bg-white text-charcoal`}
                                onClick={() =>
                                    choose(
                                        text(["pricing", plan.id, "name"]),
                                        text(["pricing", "cycleYear"]),
                                        text(["pricing", plan.id, "year"]),
                                    )
                                }
                            >
                                {text(["pricing", "yearCta"])}
                            </button>
                        </div>
                    </article>
                ))}
            </div>
            <p className="mt-6 mb-0 max-w-3xl text-sm leading-relaxed text-charcoal/75">
                {text(["pricing", "note"])}
            </p>
            {confirm ? (
                <p
                    ref={confirmRef}
                    tabIndex={-1}
                    role="status"
                    className="mt-4 max-w-3xl rounded-2xl border border-green bg-white px-4 py-3 text-sm leading-relaxed outline-none"
                >
                    {confirm}
                </p>
            ) : null}
        </div>
    );
}
