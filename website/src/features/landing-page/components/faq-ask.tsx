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
            <h2 className="m-0 text-2xl leading-tight font-semibold tracking-tight">
                {text(["faq", "askTitle"])}
            </h2>
            <p className="mt-3 max-w-prose text-base leading-relaxed text-charcoal/75">
                {text(["faq", "askLede"])}
            </p>
            <form className="mt-6" noValidate onSubmit={handleSubmit}>
                <label htmlFor={fieldId} className="text-sm font-medium">
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
                    className="mt-1 box-border min-h-32 w-full rounded-2xl border border-charcoal/20 bg-white px-4 py-3 text-base text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    onChange={(event) => setQuestion(event.target.value)}
                />
                {error ? (
                    <p id={errorId} role="alert" className="mt-2 mb-0 text-sm">
                        {error}
                    </p>
                ) : null}
                <button
                    type="submit"
                    className="mt-4 inline-flex min-h-11 items-center rounded-full bg-green px-6 text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                >
                    {text(["faq", "submit"])}
                </button>
            </form>
            {answer ? (
                <div className="mt-6 border-t border-charcoal/15 pt-4">
                    <h3
                        ref={answerRef}
                        tabIndex={-1}
                        className="m-0 text-base font-semibold outline-none"
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
