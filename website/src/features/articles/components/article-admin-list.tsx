"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AUTH_FIELD_CLASS } from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import {
    ARTICLE_STATUS_LABEL,
    listAdminArticles,
    type AdminArticleList,
} from "@/features/articles/articles.api";

const FILTERS = [
    { id: "", label: "Đang dùng" },
    { id: "draft", label: "Nháp" },
    { id: "scheduled", label: "Hẹn giờ" },
    { id: "published", label: "Đã đăng" },
    { id: "deleted", label: "Thùng" },
] as const;

export default function ArticleAdminList() {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const [list, setList] = useState<AdminArticleList | null>(null);
    const [message, setMessage] = useState("");

    useEffect(() => {
        let active = true;
        const handle = window.setTimeout(() => {
            void listAdminArticles({ q: query.trim(), status, page })
                .then((next) => {
                    if (active) setList(next);
                })
                .catch((error: unknown) => {
                    if (!active) return;
                    setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được danh sách.");
                });
        }, 200);
        return () => {
            active = false;
            window.clearTimeout(handle);
        };
    }, [query, status, page]);

    const totalPages = list ? Math.ceil(list.total / list.pageSize) : 0;

    return (
        <main className="box-border flex flex-col gap-6 px-4 py-8 sm:px-8">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="m-0 text-2xl font-semibold">Bài viết</h1>
                    <p className="mt-1 mb-0 text-sm">
                        <Link href="/admin/reconciliation" className="underline underline-offset-4">
                            Đối soát thanh toán
                        </Link>
                    </p>
                </div>
                <Link
                    href="/admin/blogs/new"
                    className="inline-flex min-h-11 items-center border border-current px-4 font-semibold"
                >
                    Viết bài
                </Link>
            </header>
            {list ? (
                <p className="m-0 text-sm">
                    {list.counts.draft} nháp · {list.counts.scheduled} hẹn giờ · {list.counts.published} đã đăng
                </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                    Tìm bài
                    <input
                        className={AUTH_FIELD_CLASS}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                        }}
                    />
                </label>
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Trạng thái">
                {FILTERS.map((filter) => (
                    <button
                        key={filter.id || "all"}
                        type="button"
                        role="radio"
                        aria-checked={status === filter.id}
                        className={`inline-flex min-h-11 items-center border border-current px-3 text-sm ${status === filter.id ? "font-semibold underline" : ""}`}
                        onClick={() => {
                            setStatus(filter.id);
                            setPage(1);
                        }}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>
            {message ? (
                <p role="alert" className="m-0 text-sm">
                    {message}
                </p>
            ) : null}
            {list && list.items.length === 0 ? <p className="m-0 text-sm">Không có bài trong bộ lọc này.</p> : null}
            {list && list.items.length > 0 ? (
                <table className="w-full border-collapse text-left text-sm">
                    <thead>
                        <tr>
                            <th className="border-b border-current py-3 pr-3 font-semibold">Tiêu đề</th>
                            <th className="border-b border-current py-3 pr-3 font-semibold">Trạng thái</th>
                            <th className="border-b border-current py-3 pr-3 font-semibold">Nguồn</th>
                            <th className="border-b border-current py-3 font-semibold">Sửa</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.items.map((article) => (
                            <tr key={article.id}>
                                <td className="border-b border-current py-3 pr-3">{article.title}</td>
                                <td className="border-b border-current py-3 pr-3">
                                    {article.deletedAt ? "Trong thùng" : ARTICLE_STATUS_LABEL[article.status]}
                                </td>
                                <td className="border-b border-current py-3 pr-3">
                                    {article.source === "ai" ? "AI" : "Soạn tay"}
                                </td>
                                <td className="border-b border-current py-3">
                                    <Link
                                        href={`/admin/blogs/${article.id}`}
                                        className="inline-flex min-h-11 items-center underline underline-offset-4"
                                    >
                                        Mở
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : null}
            {totalPages > 1 ? (
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="inline-flex min-h-11 items-center border border-current px-3"
                        disabled={page <= 1}
                        onClick={() => setPage((current) => current - 1)}
                    >
                        Trang trước
                    </button>
                    <button
                        type="button"
                        className="inline-flex min-h-11 items-center border border-current px-3"
                        disabled={page >= totalPages}
                        onClick={() => setPage((current) => current + 1)}
                    >
                        Trang sau
                    </button>
                </div>
            ) : null}
        </main>
    );
}
