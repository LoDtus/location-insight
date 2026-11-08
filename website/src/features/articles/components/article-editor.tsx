"use client";

import { Check, Circle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { AuthApiError } from "@/features/auth/auth.api";
import {
    BODY_MAX,
    LEDE_RANGE,
    SEO_DESCRIPTION_MAX,
    SEO_TITLE_MAX,
    TITLE_RANGE,
    articleChecklist,
    blockingIssues,
    slugifyTitle,
} from "@/features/articles/article-rules";
import { ARTICLE_FORMATS } from "@/features/articles/articles";
import {
    ARTICLE_FORMAT_LABEL,
    ARTICLE_STATUS_LABEL,
    ARTICLE_TOPICS,
    createAdminArticle,
    deleteAdminArticle,
    publishAdminArticle,
    restoreAdminArticle,
    updateAdminArticle,
    type AdminArticle,
    type ArticleStatus,
    type ArticleWrite,
} from "@/features/articles/articles.api";
import { Field, INPUT_CLASS, SectionCard, Segmented } from "@/shared/components/form/form-primitives";
import RichTextEditor from "@/shared/components/editor/rich-text-editor";
import { markdownToDoc, withHeadingIds } from "@/shared/components/editor/rich-text-markdown";
import type { RichTextChange } from "@/shared/components/editor/rich-text.types";

const TOPIC_LABEL: Record<(typeof ARTICLE_TOPICS)[number], string> = {
    "cach-doc": "Cách đọc",
    "khu-vuc": "Khu vực",
    gia: "Khung giá",
    "du-lieu": "Dữ liệu",
};

const DEFAULT_LIST_HREF = "/admin/blogs?page=1&sort=updated_desc";
const SITE_HOST = "diathe.vn";

function storedBlogListHref(): string {
    const stored = sessionStorage.getItem("admin-blogs-return");
    if (!stored) return DEFAULT_LIST_HREF;
    if (!stored.startsWith("{")) return `/admin/blogs?${stored}`;
    try {
        const parsed = JSON.parse(stored) as { id?: string; q?: string; status?: string; sort?: string };
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("sort", parsed.sort || "updated_desc");
        if (parsed.status) params.set("status", parsed.status);
        if (parsed.q) params.set("q", parsed.q);
        if (parsed.id) params.set("focus", parsed.id);
        return `/admin/blogs?${params.toString()}`;
    } catch {
        return DEFAULT_LIST_HREF;
    }
}

function toLocalInput(iso: string | null): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyWrite(): ArticleWrite {
    return {
        title: "",
        slug: "",
        lede: "",
        body: "",
        topic: "cach-doc",
        status: "draft",
        publishedAt: null,
        coverImage: null,
        seoTitle: null,
        seoDescription: null,
        format: "standard",
        videoUrl: null,
    };
}

function fromArticle(article: AdminArticle): ArticleWrite {
    return {
        title: article.title,
        slug: article.slug,
        lede: article.lede,
        body: article.body,
        topic: article.topic,
        status: article.status,
        publishedAt: article.publishedAt,
        coverImage: article.coverImage,
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        format: article.format ?? "standard",
        videoUrl: article.videoUrl ?? null,
    };
}

function formatDate(iso: string | null): string {
    if (!iso) return "Chưa đặt";
    return new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export default function ArticleEditor({ article }: { article: AdminArticle | null }): JSX.Element {
    const router = useRouter();
    const [form, setForm] = useState<ArticleWrite>(() => (article ? fromArticle(article) : emptyWrite()));
    const [publishedLocal, setPublishedLocal] = useState(() => toLocalInput(article?.publishedAt ?? null));
    const [saved, setSaved] = useState(() => JSON.stringify(article ? fromArticle(article) : emptyWrite()));
    const [slugTouched, setSlugTouched] = useState(Boolean(article));
    const [message, setMessage] = useState(article?.reviewNote ?? "");
    const [pending, setPending] = useState(false);
    const [listHref, setListHref] = useState(DEFAULT_LIST_HREF);
    const [attempted, setAttempted] = useState(false);
    const dirty = JSON.stringify(form) !== saved;
    const deleted = Boolean(article?.deletedAt);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage chỉ đọc được trên client
        setListHref(storedBlogListHref());
    }, []);

    useEffect(() => {
        function warn(event: BeforeUnloadEvent): void {
            if (dirty) event.preventDefault();
        }
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const set = useCallback(<K extends keyof ArticleWrite>(key: K, value: ArticleWrite[K]): void => {
        setForm((current) => ({ ...current, [key]: value }));
    }, []);

    const onBody = useCallback((change: RichTextChange): void => {
        setForm((current) => ({ ...current, body: change.markdown ?? current.body }));
    }, []);

    function onTitle(value: string): void {
        setForm((current) => ({ ...current, title: value, slug: slugTouched ? current.slug : slugifyTitle(value) }));
    }

    const checklist = useMemo(() => articleChecklist(form), [form]);
    const outline = useMemo(() => withHeadingIds(markdownToDoc(form.body)).headings, [form.body]);
    const done = checklist.filter((item) => item.done).length;
    const percent = Math.round((done / checklist.length) * 100);
    const missing = (key: string): boolean => attempted && checklist.some((item) => item.key === key && !item.done && item.required);

    function payload(status: ArticleStatus): ArticleWrite {
        const now = new Date();
        let publishedAt = publishedLocal ? new Date(publishedLocal) : null;
        if (status === "published" && (!publishedAt || publishedAt.getTime() > now.getTime())) publishedAt = now;
        return {
            ...form,
            status,
            title: form.title.trim(),
            slug: form.slug.trim(),
            lede: form.lede.trim(),
            publishedAt: status === "draft" || status === "hidden" ? (publishedAt?.toISOString() ?? null) : (publishedAt?.toISOString() ?? null),
            coverImage: form.coverImage?.trim() || null,
            seoTitle: form.seoTitle?.trim() || null,
            seoDescription: form.seoDescription?.trim() || null,
            videoUrl: form.format === "video" ? form.videoUrl?.trim() || null : null,
        };
    }

    async function save(status: ArticleStatus): Promise<void> {
        setAttempted(true);
        const body = payload(status);
        const issues = blockingIssues(body, status);
        if (issues.length > 0) {
            setMessage(`Còn thiếu: ${issues.join("; ")}.`);
            return;
        }
        setPending(true);
        setMessage("");
        try {
            const savedArticle = article ? await updateAdminArticle(article.id, body) : await createAdminArticle(body);
            const next = fromArticle(savedArticle);
            setForm(next);
            setPublishedLocal(toLocalInput(savedArticle.publishedAt));
            setSaved(JSON.stringify(next));
            setMessage(status === "published" ? "Đã lưu và đăng tải." : "Đã lưu.");
            if (!article) router.replace(`/admin/blogs/${savedArticle.id}`);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa lưu được bài.");
        } finally {
            setPending(false);
        }
    }

    async function publishNow(): Promise<void> {
        if (dirty || !article) {
            await save("published");
            return;
        }
        setPending(true);
        try {
            const next = fromArticle(await publishAdminArticle(article.id));
            setForm(next);
            setPublishedLocal(toLocalInput(next.publishedAt));
            setSaved(JSON.stringify(next));
            setMessage("Đã đăng tải.");
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa đăng tải được.");
        } finally {
            setPending(false);
        }
    }

    async function discard(): Promise<void> {
        if (!article) return;
        if (!window.confirm(`Bỏ "${article.title}" vào thùng? Bài sẽ rời khỏi trang công khai.`)) return;
        setPending(true);
        try {
            await deleteAdminArticle(article.id);
            sessionStorage.removeItem("admin-blogs-return");
            router.push("/admin/blogs?page=1&sort=updated_desc&status=deleted", { scroll: false });
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa bỏ được bài.");
            setPending(false);
        }
    }

    async function restore(): Promise<void> {
        if (!article) return;
        setPending(true);
        try {
            const next = fromArticle(await restoreAdminArticle(article.id));
            setForm(next);
            setSaved(JSON.stringify(next));
            setMessage("Đã khôi phục về trạng thái trước khi xóa.");
            router.refresh();
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa khôi phục được.");
        } finally {
            setPending(false);
        }
    }

    const titleLength = form.title.trim().length;
    const ledeLength = form.lede.trim().length;
    const previewTitle = form.seoTitle?.trim() || form.title.trim() || "Tiêu đề bài";
    const previewDescription = form.seoDescription?.trim() || form.lede.trim() || "Đoạn dẫn sẽ hiện dưới tiêu đề trên trang tìm kiếm.";
    const isPublished = form.status === "published";
    const needsDate = form.status === "scheduled" || form.status === "published";

    return (
        <div className="flex min-h-full w-full flex-col bg-white">
            <div className="flex-1 px-4 pt-6 sm:px-6">
                <Link
                    href={listHref}
                    scroll={false}
                    className="text-sm font-semibold text-green no-underline"
                    onClick={(event) => {
                        event.preventDefault();
                        router.push(storedBlogListHref(), { scroll: false });
                    }}
                >
                    Danh sách bài
                </Link>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="m-0 text-2xl font-semibold">{article ? form.title || "Sửa bài" : "Viết bài mới"}</h1>
                        <p className="mt-1 mb-0 text-sm text-charcoal/75">
                            {ARTICLE_STATUS_LABEL[form.status]}
                            {article ? ` · ${article.source === "ai" ? "Do AI tạo" : "Soạn tay"}` : ""}
                            {" · Các mục xếp theo đúng thứ tự trang bài viết."}
                        </p>
                    </div>
                    {article && isPublished && !deleted ? (
                        <Link href={`/bai-viet/${form.slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-green no-underline">
                            Xem trang công khai <ExternalLink size={14} aria-hidden />
                        </Link>
                    ) : null}
                </div>

                <div className="mt-5 flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
                    <div className="grid min-w-0 gap-5">
                        <SectionCard id="anh-bia" step={1} title="Ảnh bìa" hint="Hiện đầu bài, trong danh sách và khi chia sẻ. Dùng đường dẫn /images/… hoặc một URL https.">
                            <Field id="ab-cover" label="Địa chỉ ảnh bìa" vi hint="Tỉ lệ 16:9, tối thiểu 1200 × 675.">
                                <input
                                    id="ab-cover"
                                    className={INPUT_CLASS}
                                    value={form.coverImage ?? ""}
                                    placeholder="/images/ten-anh.jpg"
                                    onChange={(event) => set("coverImage", event.target.value || null)}
                                />
                            </Field>
                            {form.coverImage?.trim() ? (
                                // eslint-disable-next-line @next/next/no-img-element -- xem trước địa chỉ tùy ý của quản trị viên
                                <img src={form.coverImage.trim()} alt="" className="aspect-video w-full rounded-xl border border-charcoal/15 object-cover" />
                            ) : null}
                            <Field id="ab-format" label="Định dạng bài" vi hint="Bài Ảnh hoặc Video lên mục “Video / Ảnh” của trang Bài viết. Bài Video hiện video thay ảnh bìa ở đầu bài.">
                                <Segmented
                                    label="Định dạng bài"
                                    value={form.format}
                                    options={ARTICLE_FORMATS.map((format) => ({ id: format, label: ARTICLE_FORMAT_LABEL[format] }))}
                                    onChange={(value) => set("format", value)}
                                />
                            </Field>
                            {form.format === "video" ? (
                                <Field id="ab-video" label="Liên kết video" required vi hint="YouTube (youtube.com/watch?v=…, youtu.be/…, shorts) hoặc Vimeo, bắt đầu bằng https://.">
                                    <input
                                        id="ab-video"
                                        type="url"
                                        inputMode="url"
                                        className={INPUT_CLASS}
                                        value={form.videoUrl ?? ""}
                                        placeholder="https://www.youtube.com/watch?v=…"
                                        maxLength={300}
                                        onChange={(event) => set("videoUrl", event.target.value || null)}
                                    />
                                </Field>
                            ) : null}
                        </SectionCard>

                        <SectionCard id="thong-tin" step={2} title="Thông tin chính" hint="Chủ đề, tiêu đề và đoạn dẫn nằm ngay đầu bài.">
                            <Field id="ab-topic" label="Chủ đề" required vi>
                                <Segmented
                                    label="Chủ đề"
                                    value={form.topic}
                                    options={ARTICLE_TOPICS.map((topic) => ({ id: topic, label: TOPIC_LABEL[topic] }))}
                                    onChange={(value) => set("topic", value)}
                                />
                            </Field>
                            <Field
                                id="ab-title"
                                label="Tiêu đề bài"
                                required
                                vi
                                counter={`${titleLength}/${TITLE_RANGE.max}`}
                                hint={`Từ ${TITLE_RANGE.min} ký tự. Nêu đúng điều người đọc sẽ biết sau khi đọc.`}
                                error={missing("title") ? { vi: "Tiêu đề chưa đủ độ dài.", en: "" } : undefined}
                            >
                                <input
                                    id="ab-title"
                                    className={INPUT_CLASS}
                                    value={form.title}
                                    maxLength={TITLE_RANGE.max}
                                    aria-invalid={missing("title")}
                                    onChange={(event) => onTitle(event.target.value)}
                                />
                            </Field>
                            <Field
                                id="ab-lede"
                                label="Đoạn dẫn"
                                required
                                vi
                                counter={`${ledeLength}/${LEDE_RANGE.max}`}
                                hint={`Từ ${LEDE_RANGE.min} ký tự. Hiện dưới tiêu đề và làm mô tả mặc định trên tìm kiếm.`}
                                error={missing("lede") ? { vi: "Đoạn dẫn chưa đủ độ dài.", en: "" } : undefined}
                            >
                                <textarea
                                    id="ab-lede"
                                    className={`${INPUT_CLASS} min-h-24 py-3`}
                                    value={form.lede}
                                    maxLength={LEDE_RANGE.max}
                                    aria-invalid={missing("lede")}
                                    onChange={(event) => set("lede", event.target.value)}
                                />
                            </Field>
                            <dl className="m-0 grid gap-x-6 gap-y-1 rounded-xl border border-charcoal/15 p-4 text-sm sm:grid-cols-2">
                                <div className="flex justify-between gap-3">
                                    <dt className="text-charcoal/70">Tác giả</dt>
                                    <dd className="m-0 font-semibold">{article?.source === "ai" ? "Địa Thế (AI)" : "Địa Thế"}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-charcoal/70">Ngày đăng</dt>
                                    <dd className="m-0 font-semibold">{formatDate(publishedLocal ? new Date(publishedLocal).toISOString() : null)}</dd>
                                </div>
                            </dl>
                        </SectionCard>

                        <SectionCard id="noi-dung" step={3} title="Nội dung bài" hint="Viết như trong Word. Lưu dưới dạng Markdown nên AI và người cùng sửa được.">
                            <Field
                                id="ab-body"
                                label="Nội dung"
                                required
                                vi
                                counter={`${form.body.length}/${BODY_MAX}`}
                                hint="Cần một liên kết nội bộ tới /nha-dat, /phap-ly hoặc /bai-viet/…"
                                error={missing("body") || missing("link") ? { vi: "Nội dung cần đủ dài và có liên kết nội bộ.", en: "" } : undefined}
                            >
                                <RichTextEditor
                                    markdown
                                    initialMarkdown={article?.body ?? ""}
                                    onChange={onBody}
                                    ariaLabel="Nội dung bài viết"
                                    placeholder="Viết nội dung bài…"
                                    minHeightClass="min-h-96"
                                    invalid={missing("body") || missing("link")}
                                />
                            </Field>
                            {outline.length > 0 ? (
                                <nav aria-label="Mục lục tự động" className="rounded-xl border border-charcoal/15 p-4">
                                    <p className="m-0 text-sm font-semibold">Mục lục hiện bên trái bài</p>
                                    <ol className="m-0 mt-2 grid list-none gap-1 p-0 text-sm">
                                        {outline.map((heading) => (
                                            <li key={heading.id} className={heading.level === 3 ? "pl-4 text-charcoal/75" : ""}>
                                                {heading.text}
                                            </li>
                                        ))}
                                    </ol>
                                </nav>
                            ) : null}
                        </SectionCard>

                        <SectionCard id="tim-kiem" step={4} title="Tối ưu tìm kiếm (SEO)" hint="Để trống thì dùng tiêu đề và đoạn dẫn của bài.">
                            <Field id="ab-slug" label="Đường dẫn (slug)" required vi hint={`${SITE_HOST}/bai-viet/${form.slug || "…"}`} error={missing("slug") ? { vi: "Slug chỉ gồm chữ thường, số và dấu gạch.", en: "" } : undefined}>
                                <input
                                    id="ab-slug"
                                    className={INPUT_CLASS}
                                    value={form.slug}
                                    maxLength={80}
                                    aria-invalid={missing("slug")}
                                    onChange={(event) => {
                                        setSlugTouched(true);
                                        set("slug", event.target.value);
                                    }}
                                />
                            </Field>
                            <Field id="ab-seo-title" label="Tiêu đề tìm kiếm" vi counter={`${form.seoTitle?.length ?? 0}/${SEO_TITLE_MAX}`}>
                                <input id="ab-seo-title" className={INPUT_CLASS} value={form.seoTitle ?? ""} maxLength={SEO_TITLE_MAX} onChange={(event) => set("seoTitle", event.target.value || null)} />
                            </Field>
                            <Field id="ab-seo-desc" label="Mô tả tìm kiếm" vi counter={`${form.seoDescription?.length ?? 0}/${SEO_DESCRIPTION_MAX}`}>
                                <textarea id="ab-seo-desc" className={`${INPUT_CLASS} min-h-20 py-3`} value={form.seoDescription ?? ""} maxLength={SEO_DESCRIPTION_MAX} onChange={(event) => set("seoDescription", event.target.value || null)} />
                            </Field>
                            <div className="rounded-xl border border-charcoal/15 p-4">
                                <p className="m-0 text-xs text-charcoal/60">Kết quả trên Google</p>
                                <p className="mt-1 mb-0 text-xs text-charcoal/70">{`${SITE_HOST} › bai-viet › ${form.slug || "…"}`}</p>
                                <p className="mt-0.5 mb-0 text-lg leading-snug text-blue-800">{previewTitle}</p>
                                <p className="mt-0.5 mb-0 text-sm text-charcoal/80">{previewDescription}</p>
                            </div>
                        </SectionCard>
                    </div>

                    <aside className="grid gap-5 lg:sticky lg:top-4">
                        <SectionCard id="dang-bai" step={5} title="Đăng bài">
                            <Field id="ab-status" label="Trạng thái" vi>
                                <select id="ab-status" className={INPUT_CLASS} value={form.status} onChange={(event) => set("status", event.target.value as ArticleStatus)}>
                                    {(Object.keys(ARTICLE_STATUS_LABEL) as ArticleStatus[]).map((status) => (
                                        <option key={status} value={status}>
                                            {ARTICLE_STATUS_LABEL[status]}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            {needsDate ? (
                                <Field id="ab-date" label={form.status === "scheduled" ? "Giờ hẹn đăng" : "Thời điểm đăng"} vi hint={form.status === "published" ? "Để trống thì lấy giờ hiện tại." : undefined}>
                                    <input id="ab-date" className={INPUT_CLASS} type="datetime-local" value={publishedLocal} onChange={(event) => setPublishedLocal(event.target.value)} />
                                </Field>
                            ) : null}
                            {article?.source === "ai" ? (
                                <p className="m-0 rounded-xl bg-white p-3 text-xs text-charcoal/80">
                                    Bài do AI tạo{article.reviewNote ? `. Ghi chú duyệt: ${article.reviewNote}` : ". Hãy đọc lại trước khi đăng."}
                                </p>
                            ) : null}
                        </SectionCard>

                        <section aria-label="Độ hoàn thiện của bài" className="rounded-2xl border border-charcoal/15 bg-white p-5">
                            <h2 className="m-0 text-base font-semibold">Chất lượng bài</h2>
                            <div className="mt-3 flex items-center gap-3">
                                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Độ hoàn thiện" className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal/10">
                                    <div className="h-full rounded-full bg-green transition-[width]" style={{ width: `${percent}%` }} />
                                </div>
                                <span className="text-sm font-semibold">{percent}%</span>
                            </div>
                            <ul className="m-0 mt-4 grid list-none gap-2 p-0">
                                {checklist.map((item) => (
                                    <li key={item.key} className="flex items-start gap-2 text-sm">
                                        {item.done ? <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-green" /> : <Circle size={16} aria-hidden className="mt-0.5 shrink-0 text-charcoal/30" />}
                                        <span className={item.done ? "" : "text-charcoal/70"}>
                                            {item.label}
                                            {item.required ? "" : " (nên có)"}
                                        </span>
                                        <span className="sr-only">{item.done ? "(đã xong)" : "(chưa xong)"}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </aside>
                </div>
            </div>

            <div className="sticky bottom-0 z-10 mt-6 border-t border-charcoal/15 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p role={message ? "status" : undefined} className="m-0 min-h-5 text-sm text-charcoal/80">
                        {message || (dirty ? "Có thay đổi chưa lưu." : "")}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                        {article && !deleted ? (
                            <button type="button" disabled={pending} onClick={() => void discard()} className="inline-flex min-h-11 items-center rounded-xl border border-charcoal/25 bg-white px-5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
                                Bỏ vào thùng
                            </button>
                        ) : null}
                        {deleted ? (
                            <button type="button" disabled={pending} onClick={() => void restore()} className="inline-flex min-h-11 items-center rounded-xl border border-charcoal/25 bg-white px-5 text-sm font-semibold hover:bg-charcoal/5 disabled:opacity-60">
                                Khôi phục
                            </button>
                        ) : null}
                        <button type="button" disabled={pending || deleted} onClick={() => void save(form.status)} className="inline-flex min-h-11 items-center rounded-xl border border-charcoal/25 bg-white px-5 text-sm font-semibold hover:bg-charcoal/5 disabled:opacity-60">
                            {pending ? "Đang lưu…" : "Lưu"}
                        </button>
                        {!isPublished ? (
                            <button type="button" disabled={pending || deleted} onClick={() => void publishNow()} className="inline-flex min-h-11 items-center rounded-xl bg-green px-6 text-sm font-semibold text-cream disabled:opacity-60">
                                Đăng tải
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
