"use client";

import { useCallback, useEffect, useState, type JSX } from "react";

import { errorText } from "../messaging.actions";
import { listReports, resolveReport, type AdminReport } from "../messaging.api";
import { clockTime, fullTime } from "../messaging.format";
import { Lightbox, type LightboxFile } from "./lightbox";

const STATUSES: Array<{ value: AdminReport["status"]; label: string }> = [
    { value: "open", label: "Chưa xử lý" },
    { value: "actioned", label: "Đã ẩn tin" },
    { value: "dismissed", label: "Đã bỏ qua" },
];

const REASONS: Record<string, string> = {
    spam: "Spam hoặc quảng cáo",
    scam: "Lừa đảo",
    harassment: "Quấy rối hoặc đe dọa",
    sexual: "Nội dung nhạy cảm",
    other: "Lý do khác",
};

/** Admin chỉ thấy phần chụp ngữ cảnh của báo cáo, không có đường đọc hội thoại tùy ý. */
export function AdminReportsScreen(): JSX.Element {
    const [status, setStatus] = useState<AdminReport["status"]>("open");
    const [page, setPage] = useState<{ status: AdminReport["status"]; items: AdminReport[]; cursor: string | null; error: string } | null>(null);
    const [more, setMore] = useState(false);

    const load = useCallback(async (next: AdminReport["status"], after?: string | null): Promise<void> => {
        try {
            const result = await listReports(next, after);
            setPage((current) => ({
                status: next,
                items: after && current ? [...current.items, ...result.items] : result.items,
                cursor: result.nextCursor,
                error: "",
            }));
        } catch (error) {
            setPage((current) => ({
                status: next,
                items: after && current ? current.items : [],
                cursor: null,
                error: errorText(error, "Không tải được báo cáo."),
            }));
        }
    }, []);

    useEffect(() => {
        void load(status);
    }, [load, status]);

    const ready = page?.status === status;
    const items = ready ? page.items : [];
    const cursor = ready ? page.cursor : null;
    const message = ready ? page.error : "";
    const loading = !ready || more;
    const removeItem = (id: string): void =>
        setPage((current) => (current ? { ...current, items: current.items.filter((item) => item.id !== id) } : current));

    return (
        <main className="box-border h-full overflow-auto bg-white px-4 py-6 sm:px-8">
            <div className="w-full">
                <h1 className="m-0 text-2xl font-semibold">Báo cáo tin nhắn</h1>
                <p className="mt-2 mb-4 text-sm text-charcoal/70">
                    Chỉ thấy tin bị báo cáo và tối đa 10 tin xung quanh, chụp lại lúc báo cáo. Mọi xử lý được ghi nhật ký kèm lý do.
                </p>
                <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Trạng thái">
                    {STATUSES.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            role="tab"
                            aria-selected={status === item.value}
                            className={`min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${status === item.value ? "border-charcoal bg-charcoal text-cream" : "border-charcoal/25"}`}
                            onClick={() => setStatus(item.value)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                {message ? (
                    <p role="alert" className="text-sm text-red-700">
                        {message}
                    </p>
                ) : null}
                {!loading && items.length === 0 && !message ? <p className="text-sm text-charcoal/70">Không có báo cáo nào.</p> : null}
                <ul className="m-0 grid gap-4 p-0">
                    {items.map((report) => (
                        <ReportCard
                            key={report.id}
                            report={report}
                            onResolved={() => removeItem(report.id)}
                        />
                    ))}
                </ul>
                {loading ? <p className="text-sm" role="status">Đang tải…</p> : null}
                {cursor && !loading ? (
                    <button
                        type="button"
                        className="mt-4 min-h-11 rounded-full border border-charcoal/25 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-green"
                        onClick={() => {
                            setMore(true);
                            void load(status, cursor).finally(() => setMore(false));
                        }}
                    >
                        Tải thêm
                    </button>
                ) : null}
            </div>
        </main>
    );
}

function ReportCard({ report, onResolved }: { report: AdminReport; onResolved: () => void }): JSX.Element {
    const [reason, setReason] = useState("");
    const [zoom, setZoom] = useState<{ files: LightboxFile[]; index: number } | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");

    async function resolve(action: "dismiss" | "hide_message"): Promise<void> {
        if (reason.trim().length < 5) {
            setError("Nhập lý do ít nhất 5 ký tự.");
            return;
        }
        setPending(true);
        setError("");
        try {
            await resolveReport(report.id, action, reason.trim());
            onResolved();
        } catch (failure) {
            setError(errorText(failure));
            setPending(false);
        }
    }

    return (
        <li className="list-none rounded-2xl border border-charcoal/15 p-4">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="m-0 font-semibold">
                    {REASONS[report.reasonCode] ?? report.reasonCode} · {report.reported?.displayName ?? "Không rõ"}
                </p>
                <time className="text-xs text-charcoal/60" dateTime={report.createdAt}>
                    {fullTime(report.createdAt)}
                </time>
            </header>
            <p className="mt-1 mb-3 text-sm text-charcoal/75">
                Báo bởi {report.reporter?.displayName ?? "Không rõ"}
                {report.note ? ` · “${report.note}”` : ""}
            </p>
            <ol className="m-0 grid gap-1 rounded-xl bg-white p-3 text-sm" aria-label="Ngữ cảnh đã chụp">
                {report.context.map((item) => (
                    <li
                        key={item.seq}
                        className={`list-none rounded-lg px-2 py-1 ${item.reported ? "bg-gold/30 font-semibold ring-1 ring-gold" : ""}`}
                    >
                        <span className="text-xs text-charcoal/60">
                            {item.senderName} · {clockTime(item.createdAt)}
                        </span>
                        <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">
                            {item.status !== "visible" ? "(tin đã thu hồi hoặc bị ẩn)" : item.body || (item.kind === "image" ? "(ảnh)" : item.kind === "post_share" ? "(bài viết được chia sẻ)" : "")}
                        </p>
                        {item.attachments.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                                {item.attachments.map((file, index) => (
                                    <button
                                        key={file.id}
                                        type="button"
                                        aria-label={`Xem ảnh ${index + 1} trong tin bị báo cáo`}
                                        onClick={() => setZoom({ files: item.attachments, index })}
                                        className="cursor-zoom-in rounded-lg border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={file.url} alt="Ảnh trong tin bị báo cáo" className="size-24 rounded-lg object-cover" />
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </li>
                ))}
            </ol>
            {report.status === "open" ? (
                <div className="mt-3 grid gap-2">
                    <label className="text-sm font-semibold">
                        Lý do xử lý
                        <input
                            type="text"
                            value={reason}
                            maxLength={255}
                            onChange={(event) => setReason(event.target.value)}
                            className="mt-1 min-h-11 w-full rounded-xl border border-charcoal/25 px-3 text-base font-normal focus-visible:outline-2 focus-visible:outline-green"
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
                            disabled={pending}
                            className="min-h-11 rounded-full bg-charcoal px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-60"
                            onClick={() => void resolve("hide_message")}
                        >
                            Ẩn tin
                        </button>
                        <button
                            type="button"
                            disabled={pending}
                            className="min-h-11 rounded-full border border-charcoal/30 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-green disabled:opacity-60"
                            onClick={() => void resolve("dismiss")}
                        >
                            Bỏ qua
                        </button>
                    </div>
                </div>
            ) : null}
            {zoom ? <Lightbox files={zoom.files} start={zoom.index} onClose={() => setZoom(null)} /> : null}
        </li>
    );
}
