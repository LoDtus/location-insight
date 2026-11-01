"use client";

import { Button, ConfigProvider, Table, Tag, type TableColumnsType } from "antd";
import viVN from "antd/locale/vi_VN";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AUTH_FIELD_CLASS } from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import {
    ARTICLE_STATUS_LABEL,
    deleteAdminArticle,
    hideAdminArticle,
    listAdminArticles,
    type AdminArticle,
    type AdminArticleList,
} from "@/features/articles/articles.api";
import { getConfirmModal } from "@/shared/utils/confirm.utils";

const FILTERS = [
    { id: "", label: "Đang dùng" },
    { id: "draft", label: "Nháp" },
    { id: "scheduled", label: "Đã lên lịch" },
    { id: "published", label: "Đã đăng" },
    { id: "hidden", label: "Ẩn" },
    { id: "deleted", label: "Đã xoá" },
] as const;

const WHEN = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

function formatWhen(iso: string | null): string {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return WHEN.format(date);
}

function statusText(article: AdminArticle): string {
    if (article.deletedAt) return "Đã xoá";
    return ARTICLE_STATUS_LABEL[article.status];
}

export default function ArticleAdminList() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const [list, setList] = useState<AdminArticleList | null>(null);
    const [message, setMessage] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let active = true;
        const handle = window.setTimeout(() => {
            void listAdminArticles({ q: query.trim(), status, page })
                .then((next) => {
                    if (!active) return;
                    setList(next);
                    setSelected([]);
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
    }, [query, status, page, reloadKey]);

    const items = list?.items ?? [];

    const columns = useMemo<TableColumnsType<AdminArticle>>(
        () => [
            {
                title: "Bài viết",
                key: "article",
                width: 460,
                render: (_, article) => (
                    <div className="flex min-w-0 gap-3">
                        {article.coverImage?.startsWith("/") ? (
                            <Image src={article.coverImage} alt="" width={96} height={64} className="h-16 w-24 shrink-0 object-cover" />
                        ) : (
                            <span className="flex h-16 w-24 shrink-0 items-center justify-center border border-charcoal/15 text-xs">Không có ảnh</span>
                        )}
                        <div className="min-w-0">
                            <p className="m-0 font-semibold">{article.title}</p>
                            <p className="mt-1 mb-0 line-clamp-3 text-sm leading-snug text-charcoal/80">{article.lede || "—"}</p>
                        </div>
                    </div>
                ),
            },
            {
                title: "Trạng thái",
                key: "status",
                width: 130,
                render: (_, article) => <Tag color={statusColor(article)}>{statusText(article)}</Tag>,
            },
            {
                title: "Thời gian đăng",
                dataIndex: "publishedAt",
                width: 160,
                render: (value: string | null) => formatWhen(value),
            },
            {
                title: "Thời gian cập nhật",
                dataIndex: "updatedAt",
                width: 170,
                render: (value: string) => formatWhen(value),
            },
            {
                title: "Hành động",
                key: "actions",
                width: 180,
                render: (_, article) => {
                    const deleted = Boolean(article.deletedAt);
                    return (
                        <div className="flex flex-nowrap items-center">
                            <Button type="link" size="small" onClick={() => void editArticle(article)}>
                                Sửa
                            </Button>
                            <Button type="link" size="small" disabled={deleted || article.status === "hidden"} onClick={() => void hideArticle(article)}>
                                Ẩn
                            </Button>
                            <Button type="link" size="small" disabled={deleted} onClick={() => void removeArticle(article)}>
                                Xóa
                            </Button>
                        </div>
                    );
                },
            },
        ],
        // Các hàm hành động đọc state mới nhất qua closure của lần render này.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    async function editArticle(article: AdminArticle): Promise<void> {
        const accepted = await getConfirmModal({
            title: "Sửa bài viết",
            content: `Mở trang sửa “${article.title}”?`,
            okText: "Sửa",
            cancelText: "Hủy",
        });
        if (accepted) router.push(`/admin/blogs/${article.id}`);
    }

    async function hideArticle(article: AdminArticle): Promise<void> {
        const accepted = await getConfirmModal({
            title: "Ẩn bài viết",
            content: `Ẩn “${article.title}”? Bài sẽ không còn trên trang công khai.`,
            okText: "Ẩn",
            cancelText: "Hủy",
        });
        if (!accepted) return;
        try {
            await hideAdminArticle(article.id);
            setReloadKey((current) => current + 1);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa ẩn được bài.");
        }
    }

    async function removeArticle(article: AdminArticle): Promise<void> {
        const accepted = await getConfirmModal({
            title: "Xóa bài viết",
            content: `Xóa “${article.title}”? Bài được đánh dấu đã xóa và rời khỏi trang công khai.`,
            okText: "Xóa",
            cancelText: "Hủy",
        });
        if (!accepted) return;
        try {
            await deleteAdminArticle(article.id);
            setReloadKey((current) => current + 1);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa xóa được bài.");
        }
    }

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
                <Link href="/admin/blogs/new" className="inline-flex min-h-11 items-center border border-current px-4 font-semibold">
                    Viết bài
                </Link>
            </header>
            {list ? (
                <p className="m-0 text-sm">
                    {list.counts.draft} nháp · {list.counts.scheduled} đã lên lịch · {list.counts.published} đã đăng · {list.counts.hidden} ẩn
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
            <ConfigProvider
                locale={viVN}
                theme={{
                    token: {
                        colorPrimary: "#026a4e",
                        colorBgContainer: "#ffffff",
                        borderRadius: 8,
                    },
                }}
            >
                <Table<AdminArticle>
                    rowKey="id"
                    size="middle"
                    columns={columns}
                    dataSource={items}
                    loading={!list}
                    locale={{ emptyText: "Không có bài trong bộ lọc này." }}
                    scroll={{ x: 1100 }}
                    rowSelection={{
                        selectedRowKeys: selected,
                        onChange: (keys) => setSelected(keys.map(String)),
                    }}
                    pagination={{
                        current: page,
                        pageSize: list?.pageSize ?? 10,
                        total: list?.total ?? 0,
                        showSizeChanger: false,
                        onChange: setPage,
                    }}
                />
            </ConfigProvider>
        </main>
    );
}

function statusColor(article: AdminArticle): string {
    if (article.deletedAt) return "red";
    if (article.status === "published") return "green";
    if (article.status === "scheduled") return "blue";
    if (article.status === "hidden") return "orange";
    return "default";
}
