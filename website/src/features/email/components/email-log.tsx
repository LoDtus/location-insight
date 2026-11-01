"use client";

import { useEffect, useState, type JSX } from "react";

import { AuthApiError } from "@/features/auth/auth.api";

import {
    STATUS_LABEL,
    getStats,
    listMessages,
    retryMessage,
    type EmailLogItem,
    type EmailStats,
    type EmailStatus,
} from "../email.api";

const STATUS_STYLE: Record<EmailStatus, string> = {
    queued: "bg-gold/30",
    sending: "bg-gold/30",
    sent: "bg-green/15 text-green",
    dead: "bg-red-100 text-red-800",
    suppressed: "bg-charcoal/10",
    skipped: "bg-charcoal/10",
};

function errorText(error: unknown): string {
    return error instanceof AuthApiError ? error.message : "Có lỗi xảy ra. Hãy thử lại.";
}

function when(iso: string): string {
    return new Date(iso).toLocaleString("vi-VN");
}

export function EmailLog(): JSX.Element {
    const [status, setStatus] = useState("");
    const [q, setQ] = useState("");
    const [term, setTerm] = useState("");
    const [items, setItems] = useState<EmailLogItem[]>([]);
    const [next, setNext] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [stats, setStats] = useState<EmailStats | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async (): Promise<void> => {
            try {
                const [page, summary] = await Promise.all([listMessages({ status, q: term }), getStats()]);
                if (cancelled) return;
                setItems(page.items);
                setNext(page.nextCursor);
                setStats(summary);
                setError("");
            } catch (failure) {
                if (!cancelled) setError(errorText(failure));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [status, term, reloadKey]);

    async function more(): Promise<void> {
        if (!next) return;
        try {
            const page = await listMessages({ status, q: term, cursor: next });
            setItems((current) => [...current, ...page.items]);
            setNext(page.nextCursor);
        } catch (failure) {
            setError(errorText(failure));
        }
    }

    async function retry(id: string): Promise<void> {
        try {
            await retryMessage(id);
            setReloadKey((n) => n + 1);
        } catch (failure) {
            setError(errorText(failure));
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {stats ? (
                <dl className="m-0 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Stat label="Đang chờ" value={stats.queueDepth} />
                    <Stat label="Email chờ lâu nhất" value={stats.oldestPendingSeconds > 0 ? `${Math.round(stats.oldestPendingSeconds / 60)} phút` : "—"} warn={stats.oldestPendingSeconds > 300} />
                    <Stat label="Đã gửi 24 giờ" value={stats.last24h.sent ?? 0} />
                    <Stat label="Thất bại 24 giờ" value={stats.last24h.dead ?? 0} warn={(stats.last24h.dead ?? 0) > 0} />
                </dl>
            ) : null}
            <form
                className="flex flex-wrap gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    setLoading(true);
                    setTerm(q.trim());
                }}
            >
                <label className="sr-only" htmlFor="email-log-status">Trạng thái</label>
                <select
                    id="email-log-status"
                    className="min-h-11 rounded-md border border-charcoal/25 bg-white px-3 text-sm"
                    value={status}
                    onChange={(event) => {
                        setLoading(true);
                        setStatus(event.target.value);
                    }}
                >
                    <option value="">Mọi trạng thái</option>
                    {(Object.keys(STATUS_LABEL) as EmailStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                </select>
                <label className="sr-only" htmlFor="email-log-q">Địa chỉ người nhận</label>
                <input id="email-log-q" className="min-h-11 min-w-0 flex-1 rounded-md border border-charcoal/25 px-3 text-sm" placeholder="Tìm theo địa chỉ (đầu chuỗi)" value={q} onChange={(event) => setQ(event.target.value)} />
                <button type="submit" className="min-h-11 rounded-md border border-charcoal/25 px-4 text-sm font-medium">Tìm</button>
            </form>
            {error ? <p role="alert" className="m-0 text-sm text-red-700">{error}</p> : null}
            {loading ? (
                <p className="m-0 text-sm text-charcoal/70">Đang tải…</p>
            ) : items.length === 0 ? (
                <p className="m-0 text-sm text-charcoal/70">Chưa có email nào.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b border-charcoal/15 text-xs text-charcoal/60">
                                <th className="py-2 pr-3 font-medium">Thời gian</th>
                                <th className="py-2 pr-3 font-medium">Người nhận</th>
                                <th className="py-2 pr-3 font-medium">Tiêu đề</th>
                                <th className="py-2 pr-3 font-medium">Trạng thái</th>
                                <th className="py-2 font-medium"><span className="sr-only">Thao tác</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id} className="border-b border-charcoal/10 align-top">
                                    <td className="py-2 pr-3 whitespace-nowrap">{when(item.createdAt)}</td>
                                    <td className="py-2 pr-3 break-all">{item.to}</td>
                                    <td className="py-2 pr-3">
                                        {item.subject}
                                        <span className="block text-xs text-charcoal/60">{item.templateKey}</span>
                                        {item.error ? <span className="block text-xs text-red-700">{item.error}</span> : null}
                                    </td>
                                    <td className="py-2 pr-3 whitespace-nowrap">
                                        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                                        {item.attempts > 0 ? <span className="ml-1 text-xs text-charcoal/60">×{item.attempts}</span> : null}
                                    </td>
                                    <td className="py-2">
                                        {item.status === "dead" && item.hasContent ? (
                                            <button type="button" className="min-h-9 rounded-md border border-charcoal/25 px-3 text-xs" onClick={() => void retry(item.id)}>Thử lại</button>
                                        ) : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {next ? (
                <button type="button" className="min-h-11 self-start rounded-md border border-charcoal/25 px-4 text-sm" onClick={() => void more()}>
                    Xem thêm
                </button>
            ) : null}
        </div>
    );
}

function Stat({ label, value, warn }: { label: string; value: number | string; warn?: boolean }): JSX.Element {
    return (
        <div className={`rounded-lg border p-3 ${warn ? "border-red-300 bg-red-50" : "border-charcoal/15"}`}>
            <dt className="text-xs text-charcoal/60">{label}</dt>
            <dd className="m-0 text-xl font-semibold">{value}</dd>
        </div>
    );
}
