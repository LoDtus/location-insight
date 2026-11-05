"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useLocaleMessages } from "@/shared/hooks/useLocale";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const ITEM_KEYS = ["0", "1", "2"] as const;
type Cycle = "month" | "year";

const BUTTON_CLASS =
    "inline-flex min-h-11 w-full items-center justify-center rounded-md px-5 text-sm font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none";

const CARD_CLASS = "flex flex-col gap-4 rounded-lg border p-6 shadow-[0_1px_2px_rgba(16,17,17,0.06),0_8px_24px_rgba(16,17,17,0.08)]";

export default function PricingGrid() {
    const messages = useLocaleMessages("landing");
    const [cycle, setCycle] = useState<Cycle>("month");

    function text(path: string[]): string {
        return getLocaleValue(messages, path);
    }

    function items(plan: string): string[] {
        return ITEM_KEYS.map((key) => text(["pricing", plan, "items", key])).filter((item) => item !== "");
    }

    const paid = [
        { id: "unlimited", recommended: true },
        { id: "valued", recommended: false },
    ] as const;

    return (
        <div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
                <div role="radiogroup" aria-label={text(["pricing", "cycleLabel"])} className="inline-flex rounded-md border border-charcoal/20 bg-white p-1">
                    {(["month", "year"] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={cycle === option}
                            onClick={() => setCycle(option)}
                            className={`min-h-9 rounded px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${cycle === option ? "bg-charcoal text-white" : "text-charcoal/75 hover:text-charcoal"}`}
                        >
                            {option === "month" ? text(["pricing", "monthCta"]) : text(["pricing", "yearCta"])}
                        </button>
                    ))}
                </div>
                <span className="rounded-md bg-gold/25 px-2 py-1 text-xs font-semibold text-charcoal">{text(["pricing", "saveYear"])}</span>
            </div>

            <div className="mt-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
                <article className={`${CARD_CLASS} border-charcoal/15 bg-white text-charcoal`}>
                    <h3 className="m-0 font-display text-2xl font-semibold">{text(["pricing", "free", "name"])}</h3>
                    <p className="m-0 tabular-nums">
                        <strong className="font-serif text-4xl font-semibold tracking-tight">{text(["pricing", "free", "price"])}</strong>
                    </p>
                    <PlanItems list={items("free")} tone="light" />
                    <div className="mt-auto pt-2">
                        <Link href="/auth/register" className={`${BUTTON_CLASS} bg-charcoal text-white hover:bg-green`}>
                            {text(["pricing", "free", "cta"])}
                        </Link>
                    </div>
                </article>
                {paid.map((plan) => {
                    const dark = plan.recommended;
                    return (
                        <article
                            key={plan.id}
                            className={`${CARD_CLASS} ${dark ? "border-green bg-green text-cream md:-my-3 md:py-9" : "border-charcoal/15 bg-white text-charcoal"}`}
                        >
                            <h3 className="m-0 font-display text-2xl font-semibold">{text(["pricing", plan.id, "name"])}</h3>
                            {dark ? <p className="m-0 -mt-2 text-sm leading-relaxed text-cream/85">{text(["pricing", plan.id, "hint"])}</p> : null}
                            <p className="m-0 tabular-nums">
                                <strong className={`font-serif text-4xl font-semibold tracking-tight ${dark ? "text-gold" : ""}`}>
                                    {text(["pricing", plan.id, cycle])}
                                </strong>
                                <span className={`ml-1 text-sm ${dark ? "text-cream/80" : "text-charcoal/70"}`}>
                                    / {cycle === "month" ? text(["pricing", "cycleMonth"]) : text(["pricing", "cycleYear"])}
                                </span>
                            </p>
                            {cycle === "year" ? (
                                <p className={`m-0 -mt-2 text-sm ${dark ? "text-cream/80" : "text-charcoal/70"}`}>{text(["pricing", "yearNote"])}</p>
                            ) : null}
                            <PlanItems list={items(plan.id)} tone={dark ? "dark" : "light"} />
                            <div className="mt-auto pt-2">
                                <Link
                                    href={`/app/payments?plan=${plan.id}&cycle=${cycle}`}
                                    className={`${BUTTON_CLASS} ${dark ? "bg-gold text-charcoal hover:bg-white" : "bg-charcoal text-white hover:bg-green"}`}
                                >
                                    {cycle === "month" ? text(["pricing", "monthCta"]) : text(["pricing", "yearCta"])}
                                </Link>
                            </div>
                        </article>
                    );
                })}
            </div>
            <p className="mt-8 mb-0 max-w-3xl text-sm leading-relaxed text-charcoal/80">
                {text(["pricing", "note"])}{" "}
                <Link href="/app/payments?plan=credit" className="font-semibold text-green underline decoration-gold decoration-2 underline-offset-4">
                    {text(["pricing", "creditCta"])}
                </Link>
            </p>
        </div>
    );
}

function PlanItems({ list, tone }: { list: string[]; tone: "light" | "dark" }) {
    return (
        <ul className="m-0 grid list-none gap-2 p-0 text-sm leading-relaxed">
            {list.map((item) => (
                <li key={item} className="flex gap-2">
                    <Check size={16} aria-hidden className={`mt-0.5 shrink-0 ${tone === "dark" ? "text-gold" : "text-green"}`} />
                    {item}
                </li>
            ))}
        </ul>
    );
}
