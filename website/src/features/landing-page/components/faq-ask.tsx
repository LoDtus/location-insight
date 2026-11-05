"use client";

import { useId, useRef, useState, type FormEvent } from "react";

import { useLocaleMessages } from "@/shared/hooks/useLocale";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const RULES = [
    { id: "flood", test: /ngập|mưa|sông|flood|rain|river/i },
    {
        id: "price",
        test: /giá bán|khung giá|định giá|10\.?000|10k|price range|valuation|sale price/i,
    },
    {
        id: "plan",
        test: /gói|tháng|năm|miễn phí|lượt|\bplan\b|month|year|\bfree\b|quota/i,
    },
    { id: "pin", test: /ghim|lệch|địa chỉ|\bpin\b|offset|address/i },
    {
        id: "missing",
        test: /thiếu|phủ|quy hoạch|missing|coverage|planning|zoning/i,
    },
] as const;

export default function FaqAsk() {
    const messages = useLocaleMessages("landing");
    const fieldId = useId();
    const errorId = useId();
    const answerRef = useRef<HTMLHeadingElement>(null);
    const fieldRef = useRef<HTMLTextAreaElement>(null);
    const [question, setQuestion] = useState("");
    const [error, setError] = useState("");
    const [answer, setAnswer] = useState("");

    function text(path: string[]): string {
        return getLocaleValue(messages, path);
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        const value = question.trim();

        if (!value) {
            setAnswer("");
            setError(text(["faq", "empty"]));
            fieldRef.current?.focus();
            return;
        }

        const matched = RULES.find((rule) => rule.test.test(value));
        setError("");
        setAnswer(text(["faq", "match", matched?.id ?? "fallback"]));
        window.requestAnimationFrame(() => answerRef.current?.focus());
    }

    return (
        <div>
            <h2 className="m-0 font-display text-4xl leading-none font-semibold tracking-[-0.01em]">
                {text(["faq", "askTitle"])}
            </h2>
            <p className="mt-3 max-w-prose text-base leading-relaxed text-cream/85">
                {text(["faq", "askLede"])}
            </p>
            <form className="mt-6" noValidate onSubmit={handleSubmit}>
                <label htmlFor={fieldId} className="text-base font-semibold">
                    {text(["faq", "questionLabel"])}
                </label>
                <textarea
                    ref={fieldRef}
                    id={fieldId}
                    name="question"
                    value={question}
                    required
                    aria-invalid={error !== ""}
                    aria-describedby={error ? errorId : undefined}
                    className="mt-1 box-border min-h-32 w-full bg-white px-4 py-3 text-base text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    onChange={(event) => setQuestion(event.target.value)}
                />
                {error ? (
                    <p id={errorId} role="alert" className="mt-2 mb-0 text-base font-semibold text-gold">
                        {error}
                    </p>
                ) : null}
                <button
                    type="submit"
                    className="mt-4 inline-flex min-h-12 items-center bg-gold px-8 font-semibold tracking-wide text-charcoal transition-colors hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                >
                    {text(["faq", "submit"])}
                </button>
            </form>
            {answer ? (
                <div className="mt-8 bg-white p-6 text-charcoal">
                    <h3
                        ref={answerRef}
                        tabIndex={-1}
                        className="m-0 font-display text-2xl font-semibold outline-none"
                    >
                        {text(["faq", "answerTitle"])}
                    </h3>
                    <p className="mt-2 mb-0 max-w-prose text-base leading-relaxed">
                        {answer}
                    </p>
                </div>
            ) : null}
        </div>
    );
}
