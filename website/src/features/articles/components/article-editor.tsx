"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS } from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import ArticleMarkdown from "@/features/articles/components/article-markdown";
import {
    ARTICLE_STATUS_LABEL,
    ARTICLE_TOPICS,
    createAdminArticle,
    deleteAdminArticle,
    restoreAdminArticle,
    updateAdminArticle,
    type AdminArticle,
    type ArticleStatus,
    type ArticleWrite,
} from "@/features/articles/articles.api";

const TOPIC_LABEL: Record<(typeof ARTICLE_TOPICS)[number], string> = {
    "cach-doc": "Cách đọc",
    "khu-vuc": "Khu vực",
    gia: "Khung giá",
    "du-lieu": "Dữ liệu",
};

const DEFAULT_LIST_HREF = "/admin/blogs?page=1&sort=updated_desc";

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
    const pad = (value: number) => String(value).padStart(2, "0");
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
    };
}

export default function ArticleEditor({ article }: { article: AdminArticle | null }) {
    const router = useRouter();
    const [form, setForm] = useState<ArticleWrite>(article ? fromArticle(article) : emptyWrite());
    const [publishedLocal, setPublishedLocal] = useState(toLocalInput(article?.publishedAt ?? null));
    const [saved, setSaved] = useState(JSON.stringify(article ? fromArticle(article) : emptyWrite()));
    const [message, setMessage] = useState(article?.reviewNote ?? "");
    const [pending, setPending] = useState(false);
    const [listHref, setListHref] = useState(DEFAULT_LIST_HREF);
    const dirty = JSON.stringify(form) !== saved;

    useEffect(() => {
        setListHref(storedBlogListHref());
    }, []);

    useEffect(() => {
        function warn(event: BeforeUnloadEvent): void {
            if (!dirty) return;
            event.preventDefault();
        }
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    function set<K extends keyof ArticleWrite>(key: K, value: ArticleWrite[K]): void {
        setForm((current) => ({ ...current, [key]: value }));
    }

    async function save(): Promise<void> {
        setPending(true);
        setMessage("");
        const body: ArticleWrite = {
            ...form,
            title: form.title.trim(),
            slug: form.slug.trim(),
            lede: form.lede.trim(),
            publishedAt: publishedLocal ? new Date(publishedLocal).toISOString() : null,
            coverImage: form.coverImage?.trim() || null,
            seoTitle: form.seoTitle?.trim() || null,
            seoDescription: form.seoDescription?.trim() || null,
        };
        try {
            const savedArticle = article
                ? await updateAdminArticle(article.id, body)
                : await createAdminArticle(body);
            const next = fromArticle(savedArticle);
            setForm(next);
            setPublishedLocal(toLocalInput(savedArticle.publishedAt));
            setSaved(JSON.stringify(next));
            setMessage("Đã lưu.");
            if (!article) router.replace(`/admin/blogs/${savedArticle.id}`);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa lưu được bài.");
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
            const restored = await restoreAdminArticle(article.id);
            const next = fromArticle(restored);
            setForm(next);
            setSaved(JSON.stringify(next));
            setMessage("Đã khôi phục về nháp hoặc trạng thái trước khi xóa.");
            router.refresh();
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa khôi phục được.");
        } finally {
            setPending(false);
        }
    }

    const previewTitle = form.seoTitle?.trim() || form.title.trim() || "Tiêu đề bài";
    const previewDescription = form.seoDescription?.trim() || form.lede.trim() || "Đoạn dẫn sẽ hiện dưới tiêu đề trên trang tìm kiếm.";
    const deleted = Boolean(article?.deletedAt);

    return (
        <div className="box-border flex flex-col gap-6 px-4 py-8 sm:px-8">
            <p className="m-0">
                <Link
                    href={listHref}
                    scroll={false}
                    className="inline-flex min-h-11 items-center underline underline-offset-4"
                    onClick={(event) => {
                        event.preventDefault();
                        router.push(storedBlogListHref(), { scroll: false });
                    }}
                >
                    Danh sách bài
                </Link>
            </p>
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="m-0 text-2xl font-semibold">{article ? form.title || "Sửa bài" : "Viết bài"}</h1>
                    <p className="mt-1 mb-0 text-sm">
                        {ARTICLE_STATUS_LABEL[form.status]}
                        {article ? ` · ${article.source === "ai" ? "Do AI tạo" : "Soạn tay"}` : ""}
                    </p>
                </div>
            </header>
            {message ? (
                <p role="status" className="m-0 text-sm">
                    {message}
                </p>
            ) : null}
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1 text-sm">
                        Tiêu đề
                        <input
                            className={AUTH_FIELD_CLASS}
                            value={form.title}
                            maxLength={140}
                            onChange={(event) => set("title", event.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        Đoạn dẫn
                        <textarea
                            className={`${AUTH_FIELD_CLASS} min-h-24`}
                            value={form.lede}
                            maxLength={300}
                            onChange={(event) => set("lede", event.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        Nội dung Markdown
                        <textarea
                            className={`${AUTH_FIELD_CLASS} min-h-80 font-mono`}
                            value={form.body}
                            onChange={(event) => set("body", event.target.value)}
                        />
                    </label>
                    <section aria-label="Xem trước nội dung">
                        <h2 className="text-lg font-semibold">Xem trước</h2>
                        <ArticleMarkdown source={form.body} />
                    </section>
                </div>
                <aside className="flex flex-col gap-4 border border-current p-4">
                    <label className="flex flex-col gap-1 text-sm">
                        Slug
                        <input
                            className={AUTH_FIELD_CLASS}
                            value={form.slug}
                            maxLength={80}
                            onChange={(event) => set("slug", event.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        Chủ đề
                        <select
                            className={AUTH_FIELD_CLASS}
                            value={form.topic}
                            onChange={(event) => set("topic", event.target.value as ArticleWrite["topic"])}
                        >
                            {ARTICLE_TOPICS.map((topic) => (
                                <option key={topic} value={topic}>
                                    {TOPIC_LABEL[topic]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        Trạng thái
                        <select
                            className={AUTH_FIELD_CLASS}
                            value={form.status}
                            onChange={(event) => set("status", event.target.value as ArticleStatus)}
                        >
                            {(Object.keys(ARTICLE_STATUS_LABEL) as ArticleStatus[]).map((status) => (
                                <option key={status} value={status}>
                                    {ARTICLE_STATUS_LABEL[status]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        Thời điểm đăng
                        <input
                            className={AUTH_FIELD_CLASS}
                            type="datetime-local"
                            value={publishedLocal}
                            onChange={(event) => {
                                setPublishedLocal(event.target.value);
                                set(
                                    "publishedAt",
                                    event.target.value ? new Date(event.target.value).toISOString() : null,
                                );
                            }}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        Ảnh bìa
                        <input
                            className={AUTH_FIELD_CLASS}
                            value={form.coverImage ?? ""}
                            placeholder="/images/..."
                            onChange={(event) => set("coverImage", event.target.value || null)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        Tiêu đề tìm kiếm
                        <input
                            className={AUTH_FIELD_CLASS}
                            value={form.seoTitle ?? ""}
                            maxLength={70}
                            onChange={(event) => set("seoTitle", event.target.value || null)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        Mô tả tìm kiếm
                        <textarea
                            className={`${AUTH_FIELD_CLASS} min-h-24`}
                            value={form.seoDescription ?? ""}
                            maxLength={160}
                            onChange={(event) => set("seoDescription", event.target.value || null)}
                        />
                    </label>
                    <div>
                        <p className="m-0 text-sm font-medium">Kết quả tìm kiếm</p>
                        <p className="mt-2 mb-0 text-sm font-semibold">{previewTitle}</p>
                        <p className="mt-1 mb-0 text-sm">{previewDescription}</p>
                    </div>
                </aside>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-current pt-4">
                <button className={AUTH_BUTTON_CLASS} type="button" disabled={pending || deleted} onClick={() => void save()}>
                    {pending ? "Đang lưu" : "Lưu"}
                </button>
                {dirty ? <span className="text-sm">Có thay đổi chưa lưu.</span> : null}
                {article && !deleted ? (
                    <button className={AUTH_BUTTON_CLASS} type="button" disabled={pending} onClick={() => void discard()}>
                        Bỏ vào thùng
                    </button>
                ) : null}
                {deleted ? (
                    <button className={AUTH_BUTTON_CLASS} type="button" disabled={pending} onClick={() => void restore()}>
                        Khôi phục
                    </button>
                ) : null}
            </div>
        </div>
    );
}
