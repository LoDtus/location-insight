"use client";

import { useEffect, useRef, useState, type JSX } from "react";

import { AuthApiError } from "@/features/auth/auth.api";

import {
    CATEGORY_LABEL,
    LOCALES,
    getTemplate,
    listTemplates,
    previewTemplate,
    resetTemplate,
    saveTemplate,
    sendTest,
    type EmailLocale,
    type TemplateDetail,
    type TemplateSummary,
} from "../email.api";

const FIELD =
    "box-border w-full rounded-md border border-charcoal/25 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-green";
const BUTTON =
    "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-50";

function errorText(error: unknown): string {
    return error instanceof AuthApiError ? error.message : "Có lỗi xảy ra. Hãy thử lại.";
}

export function TemplateEditor(): JSX.Element {
    const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
    const [loadError, setLoadError] = useState("");
    const [selected, setSelected] = useState<string | null>(null);
    const [locale, setLocale] = useState<EmailLocale>("vi");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        void listTemplates()
            .then((list) => {
                if (!cancelled) setTemplates(list);
            })
            .catch((error: unknown) => {
                if (!cancelled) setLoadError(errorText(error));
            });
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    if (loadError) return <p role="alert" className="m-0 text-sm text-red-700">{loadError}</p>;
    if (!templates) return <p className="m-0 text-sm text-charcoal/70">Đang tải…</p>;
    const activeKey = selected ?? templates[0]?.key ?? null;

    return (
        <div className="flex flex-col gap-4 lg:flex-row">
            <nav aria-label="Loại email" className="flex shrink-0 gap-2 overflow-x-auto lg:w-64 lg:flex-col">
                {templates.map((item) => {
                    const custom = item.locales.some((l) => l.customized);
                    return (
                        <button
                            key={item.key}
                            type="button"
                            aria-current={item.key === activeKey ? "true" : undefined}
                            onClick={() => setSelected(item.key)}
                            className={`min-h-11 shrink-0 rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-green ${
                                item.key === activeKey ? "border-green bg-cream" : "border-charcoal/15 hover:bg-cream"
                            }`}
                        >
                            <span className="flex items-center justify-between gap-2 font-medium">
                                {item.name}
                                {custom ? <span className="rounded bg-gold/30 px-1.5 text-xs">Đã sửa</span> : null}
                            </span>
                            <span className="text-xs text-charcoal/60">{CATEGORY_LABEL[item.category]}</span>
                        </button>
                    );
                })}
            </nav>
            {activeKey ? (
                <div className="min-w-0 flex-1">
                    <div className="mb-3 flex items-center gap-2" role="group" aria-label="Ngôn ngữ">
                        {LOCALES.map((l) => (
                            <button
                                key={l}
                                type="button"
                                aria-pressed={locale === l}
                                onClick={() => setLocale(l)}
                                className={`${BUTTON} border ${locale === l ? "border-green bg-green text-white" : "border-charcoal/25"}`}
                            >
                                {l === "vi" ? "Tiếng Việt" : "English"}
                            </button>
                        ))}
                    </div>
                    <EditorForm
                        key={`${activeKey}:${locale}:${reloadKey}`}
                        templateKey={activeKey}
                        locale={locale}
                        onChanged={() => setReloadKey((n) => n + 1)}
                    />
                </div>
            ) : null}
        </div>
    );
}

function EditorForm({
    templateKey,
    locale,
    onChanged,
}: {
    templateKey: string;
    locale: EmailLocale;
    onChanged: () => void;
}): JSX.Element {
    const [detail, setDetail] = useState<TemplateDetail | null>(null);
    const [subject, setSubject] = useState("");
    const [bodyHtml, setBodyHtml] = useState("");
    const [bodyText, setBodyText] = useState("");
    const [enabled, setEnabled] = useState(true);
    const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
    const [previewError, setPreviewError] = useState("");
    const htmlRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        let cancelled = false;
        void getTemplate(templateKey, locale)
            .then((loaded) => {
                if (cancelled) return;
                setDetail(loaded);
                setSubject(loaded.subject);
                setBodyHtml(loaded.bodyHtml);
                setBodyText(loaded.bodyText ?? "");
                setEnabled(loaded.enabled);
            })
            .catch((error: unknown) => {
                if (!cancelled) setMessage({ kind: "error", text: errorText(error) });
            });
        return () => {
            cancelled = true;
        };
    }, [templateKey, locale]);

    // Xem trước: đợi 400 ms sau lần gõ cuối.
    useEffect(() => {
        if (!detail) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            void previewTemplate(templateKey, { locale, subject, bodyHtml, bodyText: bodyText.trim() ? bodyText : null })
                .then((result) => {
                    if (cancelled) return;
                    setPreview(result);
                    setPreviewError("");
                })
                .catch((error: unknown) => {
                    if (!cancelled) setPreviewError(errorText(error));
                });
        }, 400);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [detail, templateKey, locale, subject, bodyHtml, bodyText]);

    if (!detail) {
        return message ? (
            <p role="alert" className="m-0 text-sm text-red-700">{message.text}</p>
        ) : (
            <p className="m-0 text-sm text-charcoal/70">Đang tải…</p>
        );
    }

    const security = detail.category === "security";
    const dirty =
        subject !== detail.subject ||
        bodyHtml !== detail.bodyHtml ||
        bodyText !== (detail.bodyText ?? "") ||
        enabled !== detail.enabled;

    function insertVariable(name: string): void {
        const area = htmlRef.current;
        const token = `{{${name}}}`;
        if (!area) {
            setBodyHtml((current) => current + token);
            return;
        }
        const start = area.selectionStart;
        const end = area.selectionEnd;
        setBodyHtml(bodyHtml.slice(0, start) + token + bodyHtml.slice(end));
        requestAnimationFrame(() => {
            area.focus();
            area.setSelectionRange(start + token.length, start + token.length);
        });
    }

    async function run(action: () => Promise<string | void>): Promise<void> {
        setBusy(true);
        setMessage(null);
        try {
            const text = await action();
            if (text) setMessage({ kind: "ok", text });
        } catch (error) {
            setMessage({ kind: "error", text: errorText(error) });
        } finally {
            setBusy(false);
        }
    }

    return (
        <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                    await saveTemplate(templateKey, locale, { subject, bodyHtml, bodyText: bodyText.trim() ? bodyText : null, enabled });
                    onChanged();
                    return "Đã lưu mẫu email.";
                });
            }}
        >
            <p className="m-0 text-sm text-charcoal/70">
                {detail.customized ? `Đã tùy biến (phiên bản ${detail.version}).` : "Đang dùng mẫu mặc định."}
            </p>
            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={enabled}
                    disabled={security}
                    onChange={(event) => setEnabled(event.target.checked)}
                    className="size-4 accent-green"
                />
                Bật gửi loại email này{security ? " (email bảo mật luôn được gửi)" : ""}
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
                Tiêu đề
                <input className={FIELD} value={subject} maxLength={200} onChange={(event) => setSubject(event.target.value)} required />
            </label>
            <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Biến có thể chèn (bấm để chèn vào nội dung HTML)</span>
                <div className="flex flex-wrap gap-1.5">
                    {detail.variables.map((variable) => (
                        <button
                            key={variable.name}
                            type="button"
                            title={`${variable.description} — ví dụ: ${variable.example}`}
                            onClick={() => insertVariable(variable.name)}
                            className="min-h-8 rounded-full border border-charcoal/20 bg-cream px-3 font-mono text-xs hover:border-green focus-visible:outline-2 focus-visible:outline-green"
                        >
                            {`{{${variable.name}}}`}
                        </button>
                    ))}
                </div>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium">
                Nội dung (HTML)
                <textarea
                    ref={htmlRef}
                    className={`${FIELD} min-h-48 font-mono text-xs`}
                    value={bodyHtml}
                    maxLength={50000}
                    onChange={(event) => setBodyHtml(event.target.value)}
                    spellCheck={false}
                    required
                />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
                Bản văn bản thuần (để trống = tự sinh từ HTML)
                <textarea className={`${FIELD} min-h-24 font-mono text-xs`} value={bodyText} maxLength={20000} onChange={(event) => setBodyText(event.target.value)} spellCheck={false} />
            </label>

            <div className="flex flex-col gap-2">
                <h3 className="m-0 text-sm font-semibold">Xem trước{preview ? ` — ${preview.subject}` : ""}</h3>
                {previewError ? <p role="alert" className="m-0 text-sm text-red-700">{previewError}</p> : null}
                {preview ? (
                    <iframe title="Xem trước email" sandbox="" srcDoc={preview.html} className="h-96 w-full rounded-md border border-charcoal/15 bg-white" />
                ) : null}
            </div>

            {message ? (
                <p role={message.kind === "error" ? "alert" : "status"} className={`m-0 text-sm ${message.kind === "error" ? "text-red-700" : "text-green"}`}>
                    {message.text}
                </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy || !dirty} className={`${BUTTON} bg-green text-white`}>
                    Lưu
                </button>
                <button
                    type="button"
                    disabled={busy || dirty}
                    title={dirty ? "Lưu trước khi gửi thử" : undefined}
                    onClick={() => void run(async () => { await sendTest(templateKey, locale); return "Đã gửi thử tới email của bạn (có thể mất vài giây)."; })}
                    className={`${BUTTON} border border-charcoal/25`}
                >
                    Gửi thử cho tôi
                </button>
                <button
                    type="button"
                    disabled={busy || !detail.customized}
                    onClick={() => {
                        if (!window.confirm("Khôi phục mẫu mặc định? Bản tùy biến sẽ bị xóa.")) return;
                        void run(async () => { await resetTemplate(templateKey, locale); onChanged(); return "Đã khôi phục mặc định."; });
                    }}
                    className={`${BUTTON} border border-charcoal/25`}
                >
                    Khôi phục mặc định
                </button>
            </div>
        </form>
    );
}
