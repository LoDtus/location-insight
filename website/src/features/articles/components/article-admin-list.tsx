"use client";

import { Button, Checkbox, ConfigProvider, DatePicker, Dropdown, Input, Table, Tag, type TableColumnsType } from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { AuthApiError } from "@/features/auth/auth.api";
import {
    ARTICLE_STATUS_LABEL,
    deleteAdminArticle,
    hideAdminArticle,
    listAdminArticles,
    listPublishedFrequency,
    locateAdminArticle,
    type AdminArticle,
    type AdminArticleList,
    type FrequencyGrain,
    type PublishedFrequency,
} from "@/features/articles/articles.api";
import { getConfirmModal } from "@/shared/utils/confirm.utils";

const STATUS_OPTIONS = [
    { id: "draft", label: "Nháp" },
    { id: "scheduled", label: "Đã lên lịch" },
    { id: "published", label: "Đã đăng" },
    { id: "hidden", label: "Ẩn" },
    { id: "deleted", label: "Đã xoá" },
] as const;

const SORT_OPTIONS = [
    { id: "updated_desc", label: "Cập nhật mới nhất" },
    { id: "updated_asc", label: "Cập nhật cũ nhất" },
    { id: "published_desc", label: "Đăng mới nhất" },
    { id: "published_asc", label: "Đăng cũ nhất" },
    { id: "title", label: "Tiêu đề A-Z" },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]["id"];
type ArticleSort = (typeof SORT_OPTIONS)[number]["id"];

const BLOG_RETURN_KEY = "admin-blogs-return";
const ARTICLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_SORT: ArticleSort = "updated_desc";

const WHEN = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

function parseStatuses(raw: string | null): StatusFilter[] {
    const allowed = new Set<string>(STATUS_OPTIONS.map((option) => option.id));
    return (raw ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item): item is StatusFilter => allowed.has(item));
}

function parseSort(raw: string | null): ArticleSort {
    return SORT_OPTIONS.some((option) => option.id === raw) ? (raw as ArticleSort) : DEFAULT_SORT;
}

function parsePage(raw: string | null): number {
    const page = Number(raw);
    return Number.isInteger(page) && page > 0 ? page : 1;
}

function parsePageSize(raw: string | null): number {
    const size = Number(raw);
    return size === 10 || size === 20 || size === 50 ? size : 10;
}

function listSearch(input: { page: number; pageSize: number; q: string; statuses: StatusFilter[]; sort: ArticleSort; focus?: string }): string {
    const params = new URLSearchParams();
    params.set("page", String(input.page));
    params.set("pageSize", String(input.pageSize));
    params.set("sort", input.sort);
    if (input.statuses.length > 0) params.set("status", input.statuses.join(","));
    const q = input.q.trim();
    if (q) params.set("q", q);
    if (input.focus) params.set("focus", input.focus);
    return params.toString();
}

function scrollRowIntoPane(id: string): boolean {
    const pane = document.getElementById("noi-dung");
    const row = document.querySelector(`tr[data-row-key="${id}"]`);
    if (!pane || !(row instanceof HTMLElement)) return false;
    const rowBox = row.getBoundingClientRect();
    if (rowBox.height === 0) return false;
    const paneBox = pane.getBoundingClientRect();
    const next = pane.scrollTop + (rowBox.top - paneBox.top) - (pane.clientHeight - rowBox.height) / 2;
    pane.scrollTop = Math.max(0, next);
    return true;
}

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
    const search = useSearchParams();
    const focusFromUrl = search.get("focus");
    const [query, setQuery] = useState(() => search.get("q") ?? "");
    const [statuses, setStatuses] = useState<StatusFilter[]>(() => parseStatuses(search.get("status")));
    const [sort, setSort] = useState<ArticleSort>(() => parseSort(search.get("sort")));
    const [page, setPage] = useState(() => parsePage(search.get("page")));
    const [pageSize, setPageSize] = useState(() => parsePageSize(search.get("pageSize")));
    const [list, setList] = useState<AdminArticleList | null>(null);
    const [message, setMessage] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [reloadKey, setReloadKey] = useState(0);
    const [grain, setGrain] = useState<FrequencyGrain>("month");
    const [range, setRange] = useState(() => defaultFrequencyRange("month"));
    const [frequency, setFrequency] = useState<PublishedFrequency | null>(null);
    const [frequencyMessage, setFrequencyMessage] = useState("");
    const [highlightId, setHighlightId] = useState<string | null>(() => (focusFromUrl && ARTICLE_ID.test(focusFromUrl) ? focusFromUrl : null));
    const [anchorReady, setAnchorReady] = useState(() => !(focusFromUrl && ARTICLE_ID.test(focusFromUrl)));
    const [placed, setPlaced] = useState(() => !(focusFromUrl && ARTICLE_ID.test(focusFromUrl)));
    const listContext = useRef({ page: 1, pageSize: 10, q: "", statuses: [] as StatusFilter[], sort: DEFAULT_SORT as ArticleSort });
    listContext.current = { page, pageSize, q: query, statuses, sort };

    useEffect(() => {
        const focus = search.get("focus");
        if (!focus || !ARTICLE_ID.test(focus)) return;
        const q = search.get("q") ?? "";
        const status = parseStatuses(search.get("status")).join(",");
        const activeSort = parseSort(search.get("sort"));
        let active = true;
        void locateAdminArticle({
            id: focus,
            q,
            status,
            sort: activeSort === DEFAULT_SORT ? undefined : activeSort,
            pageSize: parsePageSize(search.get("pageSize")),
        })
            .then((place) => {
                if (!active) return;
                if (place.found) setPage(place.page);
                else {
                    setHighlightId(null);
                    setPlaced(true);
                }
            })
            .catch(() => {
                if (!active) return;
                setPlaced(true);
            })
            .finally(() => {
                if (!active) return;
                sessionStorage.removeItem(BLOG_RETURN_KEY);
                setAnchorReady(true);
            });
        return () => {
            active = false;
        };
        // Chỉ tính lại trang của bài khi vừa quay lại.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!anchorReady) return;
        let active = true;
        const handle = window.setTimeout(() => {
            void listAdminArticles({
                q: query.trim(),
                status: statuses.join(","),
                sort: sort === DEFAULT_SORT ? undefined : sort,
                page,
                pageSize,
            })
                .then((next) => {
                    if (!active) return;
                    setList(next);
                    setSelected([]);
                })
                .catch((error: unknown) => {
                    if (!active) return;
                    setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được danh sách.");
                    setPlaced(true);
                });
        }, highlightId && !list ? 0 : 200);
        return () => {
            active = false;
            window.clearTimeout(handle);
        };
    }, [anchorReady, query, statuses, sort, page, pageSize, reloadKey]);

    useLayoutEffect(() => {
        if (placed || !highlightId || !list?.items.some((item) => item.id === highlightId)) return;
        if (!scrollRowIntoPane(highlightId)) return;
        const next = listSearch({ page, pageSize, q: query, statuses, sort });
        window.history.replaceState(window.history.state, "", `/admin/blogs?${next}`);
        setPlaced(true);
    }, [placed, highlightId, list, page, pageSize, query, statuses, sort]);

    useEffect(() => {
        if (!anchorReady || !list || placed || !highlightId) return;
        if (list.items.some((item) => item.id === highlightId)) return;
        setPlaced(true);
    }, [anchorReady, list, placed, highlightId]);

    useEffect(() => {
        if (!placed) return;
        const next = listSearch({ page, pageSize, q: query, statuses, sort });
        if (window.location.search === `?${next}`) return;
        router.replace(`/admin/blogs?${next}`, { scroll: false });
    }, [placed, page, pageSize, query, statuses, sort, router]);

    useEffect(() => {
        let active = true;
        void listPublishedFrequency({ grain, from: range.from, to: range.to })
            .then((next) => {
                if (!active) return;
                setFrequency(next);
                setFrequencyMessage("");
            })
            .catch((error: unknown) => {
                if (!active) return;
                setFrequency(null);
                setFrequencyMessage(error instanceof AuthApiError ? error.message : "Chưa tải được tần suất đăng.");
            });
        return () => {
            active = false;
        };
    }, [grain, range, reloadKey]);

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
                width: 280,
                render: (_, article) => {
                    const deleted = Boolean(article.deletedAt);
                    return (
                        <div className="flex flex-nowrap items-center gap-2">
                            <Button
                                type="primary"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    void editArticle(article);
                                }}
                            >
                                Sửa
                            </Button>
                            <Button
                                disabled={deleted || article.status === "hidden"}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    void hideArticle(article);
                                }}
                            >
                                Ẩn
                            </Button>
                            <Button
                                type="primary"
                                danger
                                disabled={deleted}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    void removeArticle(article);
                                }}
                            >
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

    function rememberArticle(id: string): void {
        const searchValue = listSearch({ ...listContext.current, focus: id });
        sessionStorage.setItem(BLOG_RETURN_KEY, searchValue);
        window.history.replaceState(window.history.state, "", `/admin/blogs?${searchValue}`);
    }

    async function editArticle(article: AdminArticle): Promise<void> {
        const accepted = await getConfirmModal({
            title: "Sửa bài viết",
            content: `Mở trang sửa “${article.title}”?`,
            okText: "Sửa",
            cancelText: "Hủy",
        });
        if (!accepted) return;
        rememberArticle(article.id);
        router.push(`/admin/blogs/${article.id}`);
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
        <ConfigProvider
            locale={viVN}
            theme={{
                token: {
                    colorPrimary: "#026a4e",
                    colorBgContainer: "#ffffff",
                    borderRadius: 6,
                },
                components: {
                    Table: {
                        rowSelectedBg: "#f3f4f6",
                        rowSelectedHoverBg: "#eceff1",
                    },
                    Pagination: {
                        itemSizeLG: 44,
                    },
                },
            }}
        >
        <main className={`box-border flex flex-col gap-6 px-4 py-8 sm:px-8 ${placed ? "" : "invisible"}`} aria-busy={!placed}>
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="m-0 text-2xl font-semibold">Bài viết</h1>
                <Button type="primary" href="/admin/blogs/new" className="min-h-11">
                    Thêm bài viết mới
                </Button>
            </header>
            <section aria-label="Số bài theo trạng thái" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {STATUS_OPTIONS.filter((option) => option.id !== "deleted").map((option) => {
                    const active = statuses.length === 1 && statuses[0] === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={active}
                            className={`rounded-md border bg-white px-4 py-3 text-left ${active ? "border-green" : "border-[#d9d9d9]"}`}
                            onClick={() => {
                                setStatuses(active ? [] : [option.id]);
                                setPage(1);
                            }}
                        >
                            <span className="block text-sm">{option.label}</span>
                            <span className="mt-1 block text-2xl tabular-nums">
                                {list ? list.counts[option.id as "draft" | "scheduled" | "published" | "hidden"] : "—"}
                            </span>
                        </button>
                    );
                })}
            </section>
            <section aria-label="Tần suất bài đã đăng" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="m-0 text-lg font-semibold">Số bài đã đăng</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        {FREQUENCY_GRAINS.map((option) => (
                            <Button
                                key={option.id}
                                type={grain === option.id ? "primary" : "default"}
                                className="min-h-11"
                                onClick={() => {
                                    setGrain(option.id);
                                    setRange(defaultFrequencyRange(option.id));
                                }}
                            >
                                {option.label}
                            </Button>
                        ))}
                        <DatePicker.RangePicker
                            key={grain}
                            size="large"
                            allowClear={false}
                            picker={grain === "day" ? "date" : grain}
                            value={[dayjs(range.from), dayjs(range.to)]}
                            onChange={(values) => {
                                const next = values?.[0];
                                const end = values?.[1];
                                if (!next || !end) return;
                                const format = grain === "day" ? "YYYY-MM-DD" : grain === "month" ? "YYYY-MM" : "YYYY";
                                setRange({ from: next.format(format), to: end.format(format) });
                            }}
                        />
                    </div>
                </div>
                <p className="m-0 text-sm">
                    {frequency
                        ? `${frequency.total} bài từ ${formatBucket(frequency.grain, frequency.from)} đến ${formatBucket(frequency.grain, frequency.to)}`
                        : "Đang tải tần suất đăng."}
                </p>
                {frequencyMessage ? (
                    <p role="alert" className="m-0 text-sm">
                        {frequencyMessage}
                    </p>
                ) : (
                    <FrequencyChart grain={frequency?.grain ?? grain} points={frequency?.points ?? []} />
                )}
            </section>
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    allowClear
                    aria-label="Tìm bài"
                    placeholder="Tìm bài"
                    className="min-w-48 flex-1"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                    }}
                />
                <Dropdown
                    trigger={["click"]}
                    popupRender={() => (
                        <div className="flex flex-col gap-2 rounded-md border border-charcoal/15 bg-white p-3 shadow-sm">
                            {STATUS_OPTIONS.map((option) => (
                                <Checkbox
                                    key={option.id}
                                    checked={statuses.includes(option.id)}
                                    onChange={(event) => {
                                        setStatuses((current) =>
                                            event.target.checked
                                                ? [...current, option.id]
                                                : current.filter((item) => item !== option.id),
                                        );
                                        setPage(1);
                                    }}
                                >
                                    {option.label}
                                </Checkbox>
                            ))}
                        </div>
                    )}
                >
                    <Button className="min-h-11">Trạng thái</Button>
                </Dropdown>
                <Dropdown
                    trigger={["click"]}
                    menu={{
                        selectable: true,
                        selectedKeys: [sort],
                        items: SORT_OPTIONS.map((option) => ({ key: option.id, label: option.label })),
                        onClick: ({ key }) => {
                            setSort(key as ArticleSort);
                            setPage(1);
                        },
                    }}
                >
                    <Button className="min-h-11">Sắp xếp</Button>
                </Dropdown>
            </div>
            {statuses.length > 0 || sort !== DEFAULT_SORT ? (
                <div className="flex flex-wrap gap-2" aria-label="Điều kiện đang áp dụng">
                    {statuses.map((statusId) => (
                        <Tag
                            key={statusId}
                            closable
                            className="m-0 inline-flex min-h-8 items-center"
                            onClose={(event) => {
                                event.preventDefault();
                                setStatuses((current) => current.filter((item) => item !== statusId));
                                setPage(1);
                            }}
                        >
                            {STATUS_OPTIONS.find((option) => option.id === statusId)?.label}
                        </Tag>
                    ))}
                    {sort !== DEFAULT_SORT ? (
                        <Tag
                            closable
                            className="m-0 inline-flex min-h-8 items-center"
                            onClose={(event) => {
                                event.preventDefault();
                                setSort(DEFAULT_SORT);
                                setPage(1);
                            }}
                        >
                            {SORT_OPTIONS.find((option) => option.id === sort)?.label}
                        </Tag>
                    ) : null}
                </div>
            ) : null}
            {message ? (
                <p role="alert" className="m-0 text-sm">
                    {message}
                </p>
            ) : null}
                <div className="overflow-hidden rounded-md border border-[#d9d9d9] bg-white">
                    <Table<AdminArticle>
                        rowKey="id"
                        size="middle"
                        columns={columns}
                        dataSource={items}
                        loading={!list}
                        rowClassName={(article) => (article.id === highlightId ? "[&>td]:!bg-[#f3f4f6]" : "")}
                        locale={{ emptyText: "Không có bài trong bộ lọc này." }}
                        scroll={{ x: 1200 }}
                        rowSelection={{
                            selectedRowKeys: selected,
                            onChange: (keys) => setSelected(keys.map(String)),
                        }}
                        onRow={(article) => ({
                            className: "cursor-pointer",
                            onClick: (event) => {
                                const target = event.target;
                                if (!(target instanceof Element)) return;
                                if (target.closest("button, a, input, label, .ant-checkbox, .ant-table-selection-column")) return;
                                rememberArticle(article.id);
                                router.push(`/bai-viet/${article.slug}`);
                            },
                        })}
                        pagination={{
                            current: page,
                            pageSize,
                            total: list?.total ?? 0,
                            showSizeChanger: true,
                            pageSizeOptions: ["10", "20", "50"],
                            locale: { items_per_page: "/ trang" },
                            size: "large",
                            onChange: (next, size) => {
                                setHighlightId(null);
                                if (size !== pageSize) {
                                    setPageSize(size);
                                    setPage(1);
                                    return;
                                }
                                setPage(next);
                            },
                        }}
                    />
                </div>
        </main>
        </ConfigProvider>
    );
}

const FREQUENCY_GRAINS: { id: FrequencyGrain; label: string }[] = [
    { id: "day", label: "Theo ngày" },
    { id: "month", label: "Theo tháng" },
    { id: "year", label: "Theo năm" },
];

function defaultFrequencyRange(grain: FrequencyGrain): { from: string; to: string } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
    const [year, month, day] = parts.split("-").map(Number);
    if (grain === "year") return { from: String(year - 4), to: String(year) };
    if (grain === "month") {
        const start = new Date(Date.UTC(year, month - 1 - 11, 1));
        return {
            from: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
            to: `${year}-${String(month).padStart(2, "0")}`,
        };
    }
    const end = new Date(Date.UTC(year, month - 1, day));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function axisLabel(grain: FrequencyGrain, bucket: string): string {
    if (grain === "year") return bucket;
    if (grain === "month") return formatBucket(grain, bucket);
    const [, month, day] = bucket.split("-");
    return `${day}/${month}`;
}

function formatBucket(grain: FrequencyGrain, bucket: string): string {
    if (grain === "year") return bucket;
    if (grain === "month") {
        const [year, month] = bucket.split("-");
        return `${month}/${year}`;
    }
    const [year, month, day] = bucket.split("-");
    return `${day}/${month}/${year}`;
}

function FrequencyChart({ grain, points }: { grain: FrequencyGrain; points: { bucket: string; count: number }[] }) {
    if (!points.length) {
        return <p className="m-0 text-sm">Không có bài đã đăng trong khoảng này.</p>;
    }
    const max = Math.max(1, ...points.map((point) => point.count));
    const width = 720;
    const height = 280;
    const pad = { left: 36, right: 8, top: 12, bottom: 40 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const slot = innerW / points.length;
    const barW = Math.max(2, slot * 0.62);
    const ticks = [...new Set([0, Math.ceil(max / 2), max])];
    const labelStep = points.length > 16 ? Math.ceil(points.length / 8) : 1;
    return (
        <div className="overflow-x-auto">
            <svg role="img" aria-label="Biểu đồ số bài đã đăng" viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full min-w-[480px]">
                {ticks.map((tick) => {
                    const y = pad.top + innerH - (tick / max) * innerH;
                    return (
                        <g key={tick}>
                            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#d9d9d9" />
                            <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="12" fill="#101111">
                                {tick}
                            </text>
                        </g>
                    );
                })}
                {points.map((point, index) => {
                    const barH = (point.count / max) * innerH;
                    const x = pad.left + index * slot + (slot - barW) / 2;
                    const y = pad.top + innerH - barH;
                    const showLabel = index % labelStep === 0 || index === points.length - 1;
                    return (
                        <g key={point.bucket}>
                            <rect x={x} y={point.count === 0 ? pad.top + innerH - 1 : y} width={barW} height={Math.max(point.count === 0 ? 1 : barH, 1)} fill="#026a4e">
                                <title>{`${formatBucket(grain, point.bucket)}: ${point.count} bài`}</title>
                            </rect>
                            {showLabel ? (
                                <text x={x + barW / 2} y={height - 12} textAnchor="middle" fontSize="12" fill="#101111">
                                    {axisLabel(grain, point.bucket)}
                                </text>
                            ) : null}
                        </g>
                    );
                })}
            </svg>
            <table className="sr-only">
                <caption>Số bài đã đăng theo {grain === "day" ? "ngày" : grain === "month" ? "tháng" : "năm"}</caption>
                <thead>
                    <tr>
                        <th>Mốc</th>
                        <th>Số bài</th>
                    </tr>
                </thead>
                <tbody>
                    {points.map((point) => (
                        <tr key={point.bucket}>
                            <td>{formatBucket(grain, point.bucket)}</td>
                            <td>{point.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function statusColor(article: AdminArticle): string {
    if (article.deletedAt) return "red";
    if (article.status === "published") return "green";
    if (article.status === "scheduled") return "blue";
    if (article.status === "hidden") return "orange";
    return "default";
}
