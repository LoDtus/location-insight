"use client";

import Link from "next/link";

import { useLocaleMessages } from "@/shared/hooks/useLocale";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const ITEM_KEYS = ["0", "1", "2"] as const;

const BUTTON_CLASS =
    "inline-flex min-h-12 items-center px-6 tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none";

export default function PricingGrid() {
    const messages = useLocaleMessages("landing");

    function text(path: string[]): string {
        return getLocaleValue(messages, path);
    }

    function items(plan: string): string[] {
        return ITEM_KEYS.map((key) => text(["pricing", plan, "items", key])).filter(
            (item) => item !== "",
        );
    }

    const paid = [
        { id: "unlimited", recommended: true },
        { id: "valued", recommended: false },
    ] as const;

    return (
        <div>
            <div className="mt-14 grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
                <article className="flex flex-col gap-4 bg-white p-8 text-charcoal">
                    <h3 className="m-0 font-display text-3xl font-semibold">
                        {text(["pricing", "free", "name"])}
                    </h3>
                    <p className="m-0 tabular-nums">
                        <strong className="font-serif text-5xl font-semibold tracking-tight">
                            {text(["pricing", "free", "price"])}
                        </strong>
                    </p>
                    <ul className="m-0 list-disc space-y-3 pl-5 text-base leading-relaxed marker:text-gold">
                        {items("free").map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                    <div className="mt-auto pt-2">
                        <Link
                            href="/auth/register"
                            className={`${BUTTON_CLASS} bg-charcoal font-semibold text-cream hover:bg-green`}
                        >
                            {text(["pricing", "free", "cta"])}
                        </Link>
                    </div>
                </article>
                {paid.map((plan) => (
                    <article
                        key={plan.id}
                        className={`flex flex-col gap-4 p-8 ${plan.recommended ? "bg-green text-cream xl:-my-4 xl:py-12" : "bg-white text-charcoal"}`}
                    >
                        <h3 className="m-0 font-display text-3xl font-semibold">
                            {text(["pricing", plan.id, "name"])}
                        </h3>
                        {plan.recommended ? (
                            <p className="m-0 text-base leading-relaxed text-cream/85">
                                {text(["pricing", plan.id, "hint"])}
                            </p>
                        ) : null}
                        <p className="m-0 tabular-nums">
                            <strong className={`font-serif text-5xl font-semibold tracking-tight ${plan.recommended ? "text-gold" : ""}`}>
                                {text(["pricing", plan.id, "month"])}
                            </strong>{" "}
                            <span className={`block text-base ${plan.recommended ? "text-cream/80" : "text-charcoal/70"}`}>
                                {text(["pricing", "perMonth"])}
                            </span>
                        </p>
                        <p className="m-0 tabular-nums">
                            <strong className="font-serif text-3xl font-semibold tracking-tight">
                                {text(["pricing", plan.id, "year"])}
                            </strong>{" "}
                            <span className={`block text-base ${plan.recommended ? "text-cream/80" : "text-charcoal/70"}`}>
                                {text(["pricing", "perYear"])}
                            </span>
                        </p>
                        <p className={`m-0 text-base ${plan.recommended ? "text-cream/80" : "text-charcoal/70"}`}>
                            {text(["pricing", "yearNote"])}
                        </p>
                        <ul className="m-0 list-disc space-y-3 pl-5 text-base leading-relaxed marker:text-gold">
                            {items(plan.id).map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                        <div className="mt-auto flex flex-wrap gap-2 pt-2">
                            <Link
                                href={`/app/payments?plan=${plan.id}&cycle=month`}
                                className={`${BUTTON_CLASS} font-semibold ${plan.recommended ? "bg-gold text-charcoal hover:bg-white" : "bg-charcoal text-cream hover:bg-green"}`}
                            >
                                {text(["pricing", "monthCta"])}
                            </Link>
                            <Link
                                href={`/app/payments?plan=${plan.id}&cycle=year`}
                                className={`${BUTTON_CLASS} font-semibold bg-white text-charcoal hover:bg-gold`}
                            >
                                {text(["pricing", "yearCta"])}
                            </Link>
                        </div>
                    </article>
                ))}
            </div>
            <p className="mt-12 mb-0 max-w-3xl text-base leading-relaxed text-charcoal/80">
                {text(["pricing", "note"])}{" "}
                <Link
                    href="/app/payments?plan=credit"
                    className="font-semibold text-green underline decoration-gold decoration-2 underline-offset-4"
                >{text(["pricing", "creditCta"])}</Link>
            </p>
        </div>
    );
}
