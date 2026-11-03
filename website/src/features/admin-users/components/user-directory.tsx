"use client";

import { Button, ConfigProvider, Dropdown, Input, Select, Table, Tag, type TableColumnsType } from "antd";
import viVN from "antd/locale/vi_VN";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from "react";

import {
    cancelDirectoryUser,
    changeDirectoryPlan,
    deleteDirectoryUser,
    listDirectory,
    lockDirectoryUser,
    renewDirectoryUser,
    unlockDirectoryUser,
    type DirectoryItem,
    type DirectoryPlan,
    type DirectoryResponse,
    type DirectorySort,
    type DirectoryStatus,
} from "@/features/admin-users/admin-users.api";
import { AuthApiError } from "@/features/auth/auth.api";
import { formatVnd } from "@/features/billing/billing.api";
import { getConfirmModal } from "@/shared/utils/confirm.utils";

const STATUS_OPTIONS: { id: DirectoryStatus; label: string }[] = [
    { id: "active", label: "Đang hoạt động" },
    { id: "trailing", label: "Đang dùng thử" },
    { id: "canceled", label: "Đã huỷ" },
    { id: "expired", label: "Quá hạn" },
    { id: "none", label: "Chưa có gói" },
];

const PLAN_OPTIONS: { id: DirectoryPlan; label: string; background: string; color: string }[] = [
    { id: "free", label: "Miễn phí", background: "#e6e2da", color: "#101111" },
    { id: "unlimited", label: "Không giới hạn lượt", background: "#026a4e", color: "#e6e2da" },
    { id: "valued", label: "Có định giá", background: "#1d4e89", color: "#ffffff" },
];

const STATUS_TAG: Record<DirectoryStatus, { label: string; background: string; color: string }> = {
    active: { label: "Đang hoạt động", background: "#026a4e", color: "#e6e2da" },
    trailing: { label: "Đang dùng thử", background: "#1d4e89", color: "#ffffff" },
    canceled: { label: "Đã huỷ", background: "#b42318", color: "#ffffff" },
    expired: { label: "Quá hạn", background: "#b54708", color: "#ffffff" },
    none: { label: "Chưa có gói", background: "#e6e2da", color: "#101111" },
};

const SORT_OPTIONS: { id: DirectorySort; label: string }[] = [
    { id: "created_desc", label: "Đăng ký mới nhất" },
    { id: "created_asc", label: "Đăng ký cũ nhất" },
    { id: "name", label: "Tên A-Z" },
    { id: "expiry", label: "Hết hạn sớm nhất" },
];

const DEFAULT_SORT: DirectorySort = "created_desc";

/**
 * Ảnh chụp danh sách (kèm vị trí cuộn) lúc rời trang, để quay lại dựng ngay đúng trang
 * và đúng vị trí cuộn, không qua khoảng trống chờ tải. Chỉ sống trong phiên điều hướng phía client.
 */
let returnSnapshot: { search: string; list: DirectoryResponse; scrollTop: number } | null = null;

function snapshotFor(searchParams: URLSearchParams): typeof returnSnapshot {
    if (!returnSnapshot) return null;
    return new URLSearchParams(returnSnapshot.search).toString() === searchParams.toString() ? returnSnapshot : null;
}

const DAY = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
});

function parsePage(raw: string | null): number {
    const page = Number(raw);
    return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseSort(raw: string | null): DirectorySort {
    return SORT_OPTIONS.some((option) => option.id === raw) ? (raw as DirectorySort) : DEFAULT_SORT;
}

function parseStatus(raw: string | null): DirectoryStatus | "" {
    return STATUS_OPTIONS.some((option) => option.id === raw) ? (raw as DirectoryStatus) : "";
}

function parsePlan(raw: string | null): DirectoryPlan | "" {
    return PLAN_OPTIONS.some((option) => option.id === raw) ? (raw as DirectoryPlan) : "";
}

function listSearch(input: {
    page: number;
    q: string;
    status: DirectoryStatus | "";
    plan: DirectoryPlan | "";
    sort: DirectorySort;
}): string {
    const params = new URLSearchParams();
    params.set("page", String(input.page));
    params.set("sort", input.sort);
    const q = input.q.trim();
    if (q) params.set("q", q);
    if (input.status) params.set("status", input.status);
    if (input.plan) params.set("plan", input.plan);
    return params.toString();
}

type DeltaTone = "up" | "down" | "flat";

function signed(value: number): { text: string; tone: DeltaTone } {
    const amount = Math.abs(value).toLocaleString("vi-VN");
    if (value > 0) return { text: `Tăng ${amount} so với tháng trước`, tone: "up" };
    if (value < 0) return { text: `Giảm ${amount} so với tháng trước`, tone: "down" };
    return { text: "Không đổi so với tháng trước", tone: "flat" };
}

function revenueNote(percent: number | null, current: number): { text: string; tone: DeltaTone } {
    if (percent === null) {
        return current > 0
            ? { text: "Phát sinh mới so với tháng trước", tone: "up" }
            : { text: "Không đổi so với tháng trước", tone: "flat" };
    }
    if (percent > 0) return { text: `Tăng ${percent}% so với tháng trước`, tone: "up" };
    if (percent < 0) return { text: `Giảm ${Math.abs(percent)}% so với tháng trước`, tone: "down" };
    return { text: "Không đổi so với tháng trước", tone: "flat" };
}

function planTag(plan: DirectoryPlan): JSX.Element | null {
    const option = PLAN_OPTIONS.find((item) => item.id === plan);
    return option ? tintedTag(option.label, option.background, option.color) : null;
}

function tintedTag(label: string, background: string, color: string): JSX.Element {
    return (
        <Tag style={{ margin: 0, background, color, borderColor: background }}>{label}</Tag>
    );
}

export default function UserDirectory(): JSX.Element {
    const router = useRouter();
    const search = useSearchParams();
    const [page, setPage] = useState(() => parsePage(search.get("page")));
    const [sort, setSort] = useState<DirectorySort>(() => parseSort(search.get("sort")));
    const [status, setStatus] = useState<DirectoryStatus | "">(() => parseStatus(search.get("status")));
    const [plan, setPlan] = useState<DirectoryPlan | "">(() => parsePlan(search.get("plan")));
    const [query, setQuery] = useState(() => search.get("q") ?? "");
    const [committedQuery, setCommittedQuery] = useState(() => search.get("q") ?? "");
    const [restored] = useState(() => snapshotFor(search));
    const [list, setList] = useState<DirectoryResponse | null>(restored?.list ?? null);
    const latest = useRef({ list, search: "" });
    const [selected, setSelected] = useState<string[]>([]);
    const [message, setMessage] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        latest.current = { list, search: listSearch({ page, q: committedQuery, status, plan, sort }) };
    }, [list, page, committedQuery, status, plan, sort]);

    useLayoutEffect(() => {
        if (!restored) return;
        const pane = document.getElementById("noi-dung");
        if (pane) pane.scrollTop = restored.scrollTop;
        // Chỉ khôi phục vị trí cuộn một lần lúc vừa dựng lại.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handle = window.setTimeout(() => setCommittedQuery(query), 200);
        return () => window.clearTimeout(handle);
    }, [query]);

    useEffect(() => {
        const next = listSearch({ page, q: committedQuery, status, plan, sort });
        if (window.location.search === `?${next}`) return;
        router.replace(`/admin/users?${next}`, { scroll: false });
    }, [page, committedQuery, status, plan, sort, router]);

    useEffect(() => {
        let active = true;
        void listDirectory({ page, q: committedQuery, status, plan, sort })
            .then((next) => {
                if (!active) return;
                setList(next);
                setSelected([]);
                setMessage("");
            })
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được danh sách.");
            });
        return () => {
            active = false;
        };
    }, [page, committedQuery, status, plan, sort, reloadKey]);

    async function run(action: () => Promise<unknown>, title: string, content: string): Promise<void> {
        const accepted = await getConfirmModal({ title, content, okText: "Xác nhận", cancelText: "Huỷ" });
        if (!accepted) return;
        setBusy(true);
        setMessage("");
        try {
            await action();
            setReloadKey((current) => current + 1);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa thực hiện được.");
        } finally {
            setBusy(false);
        }
    }

    const columns = useMemo<TableColumnsType<DirectoryItem>>(
        () => [
            {
                title: "Mã gói",
                dataIndex: "planCode",
                width: 220,
                render: (_value, row) => (
                    <div className="flex flex-col items-start gap-1">
                        <span className="font-mono text-sm tracking-wide">{row.planCode || "—"}</span>
                        {planTag(row.plan)}
                    </div>
                ),
            },
            {
                title: "Người dùng",
                dataIndex: "displayName",
                render: (_value, row) => (
                    <div className="flex flex-col">
                        <span className="font-semibold">
                            {row.displayName}
                            {row.accountStatus === "locked" ? " · Đã khoá" : ""}
                        </span>
                        <span className="text-sm">{row.username ? `@${row.username}` : "Chưa có tên đăng nhập"}</span>
                        <span className="text-sm">{row.email}</span>
                    </div>
                ),
            },
            {
                title: "Ngày đăng ký",
                dataIndex: "joinedAt",
                width: 140,
                render: (value: string) => DAY.format(new Date(value)),
            },
            {
                title: "Ngày hết hạn",
                dataIndex: "periodEnd",
                width: 140,
                render: (value: string | null) => (value ? DAY.format(new Date(value)) : "—"),
            },
            {
                title: "Trạng thái",
                dataIndex: "status",
                width: 160,
                render: (value: DirectoryStatus) => {
                    const option = STATUS_TAG[value];
                    return tintedTag(option.label, option.background, option.color);
                },
            },
            {
                title: "Chu kỳ",
                dataIndex: "cycle",
                width: 110,
                render: (value: DirectoryItem["cycle"]) => (value === "year" ? "Năm" : value === "month" ? "Tháng" : "—"),
            },
            {
                title: "Hành động",
                key: "actions",
                width: 140,
                render: (_value, row) => (
                    <Dropdown
                        trigger={["click"]}
                        menu={{
                            items: [
                                {
                                    key: "renew",
                                    label: "Gia hạn thủ công",
                                    disabled: !row.subscriptionId || busy,
                                    onClick: (info) => {
                                        info.domEvent.stopPropagation();
                                        void run(
                                            () => renewDirectoryUser(row.userId),
                                            "Gia hạn thủ công",
                                            `Gia hạn gói của ${row.displayName}?`,
                                        );
                                    },
                                },
                                {
                                    key: "cancel",
                                    label: "Huỷ đăng ký, đưa về miễn phí",
                                    disabled: !row.open || busy,
                                    onClick: (info) => {
                                        info.domEvent.stopPropagation();
                                        void run(
                                            () => cancelDirectoryUser(row.userId),
                                            "Huỷ đăng ký",
                                            `${row.displayName} sẽ về gói miễn phí ngay.`,
                                        );
                                    },
                                },
                                {
                                    key: "change",
                                    label: "Đổi gói thủ công",
                                    disabled: busy,
                                    children: [
                                        {
                                            key: "unlimited",
                                            label: "Không giới hạn lượt",
                                            disabled: row.open && row.plan === "unlimited",
                                            onClick: (info) => {
                                                info.domEvent.stopPropagation();
                                                void run(
                                                    () => changeDirectoryPlan(row.userId, "unlimited"),
                                                    "Đổi gói",
                                                    `Đổi gói của ${row.displayName} sang không giới hạn lượt?`,
                                                );
                                            },
                                        },
                                        {
                                            key: "valued",
                                            label: "Có định giá",
                                            disabled: row.open && row.plan === "valued",
                                            onClick: (info) => {
                                                info.domEvent.stopPropagation();
                                                void run(
                                                    () => changeDirectoryPlan(row.userId, "valued"),
                                                    "Đổi gói",
                                                    `Đổi gói của ${row.displayName} sang có định giá?`,
                                                );
                                            },
                                        },
                                    ],
                                },
                                {
                                    key: "lock",
                                    label: row.accountStatus === "locked" ? "Mở khoá tài khoản" : "Khoá tài khoản",
                                    disabled: busy,
                                    onClick: (info) => {
                                        info.domEvent.stopPropagation();
                                        const locked = row.accountStatus === "locked";
                                        void run(
                                            () => (locked ? unlockDirectoryUser(row.userId) : lockDirectoryUser(row.userId)),
                                            locked ? "Mở khoá tài khoản" : "Khoá tài khoản",
                                            locked
                                                ? `Mở khoá ${row.displayName}?`
                                                : `Khoá ${row.displayName}? Người này sẽ không đăng nhập được.`,
                                        );
                                    },
                                },
                                {
                                    key: "delete",
                                    label: "Xoá người dùng",
                                    disabled: busy,
                                    onClick: (info) => {
                                        info.domEvent.stopPropagation();
                                        void run(
                                            () => deleteDirectoryUser(row.userId),
                                            "Xoá người dùng",
                                            `Xoá ${row.displayName}? Tài khoản sẽ không còn đăng nhập được.`,
                                        );
                                    },
                                },
                            ],
                        }}
                    >
                        <Button onClick={(event) => event.stopPropagation()}>Hành động</Button>
                    </Dropdown>
                ),
            },
        ],
        [busy],
    );

    const summary = list?.summary;

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
                    Pagination: { itemSizeLG: 44 },
                },
            }}
        >
            <main className="box-border flex flex-col gap-6 px-4 py-8 sm:px-8">
                <h1 className="m-0 text-2xl font-semibold">Quản lý người dùng</h1>
                <section aria-label="Tổng quan người dùng" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <StatCard title="Tổng số người dùng" value={summary ? String(summary.users.total) : "—"} note={summary ? signed(summary.users.delta) : null} />
                    <StatCard title="Số người dùng mới" value={summary ? String(summary.newUsers.current) : "—"} note={summary ? signed(summary.newUsers.current - summary.newUsers.previous) : null} />
                    <StatCard title="Số người đang online" value={summary ? String(summary.online) : "—"} note={{ text: "Trong 5 phút gần đây", tone: "flat" }} />
                    <StatCard title="Số gói đang active" value={summary ? String(summary.activePlans.current) : "—"} note={summary ? signed(summary.activePlans.delta) : null} />
                    <StatCard title="Doanh thu 1 tháng" value={summary ? formatVnd(summary.revenue.currentVnd) : "—"} note={summary ? revenueNote(summary.revenue.percent, summary.revenue.currentVnd) : null} />
                    <StatCard title="Cần xử lý" value={summary ? String(summary.pastDue) : "—"} note={{ text: "Đăng ký quá hạn thanh toán", tone: "flat" }} />
                </section>
                <div className="flex flex-wrap gap-3">
                    <Input
                        allowClear
                        value={query}
                        placeholder="Tên, email, mã gói"
                        className="max-w-xs"
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                        }}
                    />
                    <Select
                        allowClear
                        placeholder="Trạng thái"
                        value={status || undefined}
                        className="min-w-44"
                        options={STATUS_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
                        onChange={(value) => {
                            setStatus(value ?? "");
                            setPage(1);
                        }}
                    />
                    <Select
                        allowClear
                        placeholder="Loại gói"
                        value={plan || undefined}
                        className="min-w-52"
                        options={PLAN_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
                        onChange={(value) => {
                            setPlan(value ?? "");
                            setPage(1);
                        }}
                    />
                    <Select
                        value={sort}
                        className="min-w-48"
                        options={SORT_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
                        onChange={(value) => {
                            setSort(value);
                            setPage(1);
                        }}
                    />
                </div>
                {message ? (
                    <p role="alert" className="m-0 text-sm">
                        {message}
                    </p>
                ) : null}
                <div className="overflow-hidden rounded-md border border-[#d9d9d9] bg-white">
                    <Table<DirectoryItem>
                        rowKey="userId"
                        size="middle"
                        columns={columns}
                        dataSource={list?.items ?? []}
                        loading={!list || busy}
                        locale={{ emptyText: "Không có người dùng trong bộ lọc này." }}
                        scroll={{ x: 1200 }}
                        rowSelection={{
                            selectedRowKeys: selected,
                            onChange: (keys) => setSelected(keys.map(String)),
                        }}
                        onRow={(row) => ({
                            className: row.username ? "cursor-pointer" : undefined,
                            onClick: (event) => {
                                const target = event.target;
                                if (!(target instanceof Element)) return;
                                if (target.closest("button, a, input, label, .ant-checkbox, .ant-table-selection-column, .ant-dropdown")) return;
                                if (!row.username) return;
                                const { list: current, search: currentSearch } = latest.current;
                                returnSnapshot = current
                                    ? { search: currentSearch, list: current, scrollTop: document.getElementById("noi-dung")?.scrollTop ?? 0 }
                                    : null;
                                router.push(`/app/profile/@${row.username}`);
                            },
                        })}
                        pagination={{
                            current: page,
                            pageSize: list?.pageSize ?? 10,
                            total: list?.total ?? 0,
                            showSizeChanger: false,
                            size: "large",
                            onChange: (next) => setPage(next),
                        }}
                    />
                </div>
            </main>
        </ConfigProvider>
    );
}

function StatCard({
    title,
    value,
    note,
}: {
    title: string;
    value: string;
    note: { text: string; tone: DeltaTone } | null;
}): JSX.Element {
    return (
        <article className="rounded-md border border-[#d9d9d9] bg-white p-4">
            <h2 className="m-0 text-sm font-semibold">{title}</h2>
            <p className="m-0 mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            {note?.tone === "flat" ? <p className="m-0 mt-2 text-sm text-[#101111]">{note.text}</p> : null}
            {note && note.tone !== "flat" ? (
                <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-sm font-semibold ${
                        note.tone === "up" ? "bg-[#026a4e] text-[#e6e2da]" : "bg-[#b42318] text-white"
                    }`}
                >
                    {note.text}
                </span>
            ) : null}
        </article>
    );
}
