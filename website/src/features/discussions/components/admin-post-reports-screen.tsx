"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type JSX } from "react";

import { AuthApiError } from "@/features/auth/auth.api";
import { REPORT_REASONS, listPostReports, resolvePostReport, type PostReport } from "@/features/discussions/discussions.api";
import { relativeTime } from "@/features/discussions/components/post-card";
import { showToast } from "@/shared/components/toast/toast-store";

const STATUSES: Array<{ value: PostReport["status"]; label: string }> = [
    { value: "open", label: "Chưa xử lý" },
    { value: "actioned", label: "Đã ẩn bài" },
    { value: "dismissed", label: "Đã bỏ qua" },
];

const REASON_LABEL = new Map<string, string>(REPORT_REASONS.map((item) => [item.id, item.label]));

/** Kiểm duyệt báo cáo bài trên diễn đàn: xem trích bài, số lượt báo cáo, ẩn bài hoặc bỏ qua (kèm lý do). */
export function AdminPostReportsScreen(): JSX.Element {
    const [status, setStatus] = useState<PostReport["status"]>("open");
    const [state, setState] = useState<{ status: PostReport["status"]; items: PostReport[]; error: string } | null>(null);

    const load = useCallback(async (next: PostReport["status"]): Promise<void> => {
        try {
            setState({ status: next, items: await listPostReports(next), error: "" });
        } catch (error) {
            setState({ status: next, items: [], error: error instanceof AuthApiError ? error.message : "Không tải được báo cáo." });
        }
    }, []);

    useEffect(() => {
        void load(status);
    }, [load, status]);

    const ready = state?.status === status;
    const items = ready ? state.items : [];

    return (
        <main className="box-border h-full overflow-auto bg-white px-4 py-6 sm:px-8">
            <h1 className="m-0 text-2xl font-semibold">Báo cáo bài viết</h1>
            <p className="mt-2 mb-4 text-sm text-charcoal/70">
                Báo cáo từ người dùng về bài trên diễn đàn. Ẩn bài sẽ đóng mọi báo cáo của bài đó; mọi xử lý được ghi nhật ký kèm lý do.
            </p>
            <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Trạng thái">
                {STATUSES.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={status === item.value}
                        className={`min-h-11 rounded-full px-4 text-sm font-semibold ring-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${status === item.value ? "bg-charcoal text-cream ring-charcoal" : "ring-charcoal/20 hover:bg-charcoal/5"}`}
                        onClick={() => setStatus(item.value)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            {ready && state.error ? (
                <p role="alert" className="text-sm text-red-700">
                    {state.error}
                </p>
            ) : null}
            {!ready ? (
                <p role="status" className="text-sm">
                    Đang tải…
                </p>
            ) : null}
            {ready && !state.error && items.length === 0 ? <p className="text-sm text-charcoal/70">Không có báo cáo nào.</p> : null}
            <ul className="m-0 grid max-w-3xl gap-3 p-0">
                {items.map((report) => (
                    <ReportCard
                        key={report.id}
                        report={report}
                        onResolved={() => setState((current) => (current ? { ...current, items: current.items.filter((item) => item.id !== report.id && (report.post === null || item.post?.id !== report.post.id || item.status !== "open")) } : current))}
                    />
                ))}
            </ul>
        </main>
    );
}

function ReportCard({ report, onResolved }: { report: PostReport; onResolved: () => void }): JSX.Element {
    const [reason, setReason] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const open = report.status === "open";
    const postHref = report.post ? `/admin/feed/${report.post.rootId ?? report.post.id}` : null;

    async function resolve(next: "actioned" | "dismissed"): Promise<void> {
        if (reason.trim().length < 5) {
            setError("Nhập lý do ít nhất 5 ký tự.");
            return;
        }
        setPending(true);
        setError("");
        try {
            await resolvePostReport(report.id, next, reason.trim());
            showToast({ title: next === "actioned" ? "Đã ẩn bài" : "Đã bỏ qua báo cáo", tone: next === "actioned" ? "success" : "info" });
            onResolved();
        } catch (failure) {
            setError(failure instanceof AuthApiError ? failure.message : "Chưa xử lý được.");
            setPending(false);
        }
    }

    return (
        <li className="list-none rounded-2xl p-4 ring-1 ring-charcoal/15">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="m-0 font-semibold">
                    {REASON_LABEL.get(report.reason) ?? report.reason}
                    {report.reportCount > 1 ? (
                        <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{report.reportCount} lượt báo cáo</span>
                    ) : null}
                </p>
                <p className="m-0 text-xs text-charcoal/60">
                    {report.reporterName} · {relativeTime(report.createdAt)}
                </p>
            </header>
            {report.note ? <p className="mt-1 mb-0 text-sm text-charcoal/80">“{report.note}”</p> : null}
            {report.post ? (
                <div className="mt-3 rounded-xl bg-charcoal/[0.03] p-3">
                    <p className="m-0 text-xs text-charcoal/60">
                        Bài của <b className="text-charcoal">{report.post.authorName}</b>
                        {report.post.authorUsername ? ` @${report.post.authorUsername}` : ""}
                        {report.post.status !== "visible" ? ` · ${report.post.status === "hidden" ? "đã ẩn" : "đã xóa"}` : ""}
                    </p>
                    <p className="mt-1 mb-0 line-clamp-6 text-sm whitespace-pre-wrap">{report.post.body}</p>
                    {postHref && report.post.status === "visible" ? (
                        <Link href={postHref} className="mt-2 inline-block text-xs font-semibold text-green underline-offset-2 hover:underline">
                            Mở bài trên diễn đàn
                        </Link>
                    ) : null}
                </div>
            ) : (
                <p className="mt-3 mb-0 text-sm text-charcoal/60">Bài không còn tồn tại.</p>
            )}
            {open ? (
                <div className="mt-3 grid gap-2">
                    <label className="grid gap-1 text-sm">
                        <span className="font-semibold">Lý do xử lý</span>
                        <input
                            value={reason}
                            maxLength={255}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Ví dụ: lừa đặt cọc, đã xác minh"
                            className="min-h-10 rounded-xl border border-charcoal/15 px-3 text-sm outline-none focus:border-green focus:ring-2 focus:ring-green/20"
                        />
                    </label>
                    {error ? (
                        <p role="alert" className="m-0 text-sm text-red-700">
                            {error}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={pending || !report.post}
                            onClick={() => void resolve("actioned")}
                            className="min-h-10 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                        >
                            Ẩn bài
                        </button>
                        <button
                            type="button"
                            disabled={pending}
                            onClick={() => void resolve("dismissed")}
                            className="min-h-10 rounded-xl px-4 text-sm font-semibold ring-1 ring-charcoal/20 hover:bg-charcoal/5 disabled:opacity-50"
                        >
                            Bỏ qua
                        </button>
                    </div>
                </div>
            ) : null}
        </li>
    );
}
