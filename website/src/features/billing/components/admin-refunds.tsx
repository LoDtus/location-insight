"use client";

import { useEffect, useState } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS, AUTH_TITLE_CLASS } from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import {
    REFUND_REASON,
    REFUND_STATUS,
    adminRefunds,
    decideRefund,
    formatVnd,
    markRefundPaidOut,
    type RefundStatus,
    type RefundView,
} from "@/features/billing/billing.api";

const FILTERS: Array<{ value: RefundStatus | ""; label: string }> = [
    { value: "requested", label: "Chờ xét" },
    { value: "approved", label: "Chờ chuyển tiền" },
    { value: "paid_out", label: "Đã chuyển" },
    { value: "rejected", label: "Từ chối" },
    { value: "", label: "Tất cả" },
];

const PAGE_SIZE = 20;

/** Hàng đợi hoàn tiền: duyệt hoặc từ chối, rồi ghi mã tham chiếu sau khi chuyển khoản tay. */
export function AdminRefunds() {
    const [status, setStatus] = useState<RefundStatus | "">("requested");
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<RefundView[]>([]);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [message, setMessage] = useState("");
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let active = true;
        void adminRefunds(status || undefined, page)
            .then((data) => {
                if (!active) return;
                setRows(data);
                setMessage("");
            })
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được yêu cầu hoàn.");
            });
        return () => {
            active = false;
        };
    }, [status, page, tick]);

    async function act(row: RefundView, run: (value: string) => Promise<unknown>, need: string) {
        const value = (notes[row.id] ?? "").trim();
        if (value.length < 3) {
            setMessage(need);
            return;
        }
        try {
            await run(value);
            setNotes((current) => ({ ...current, [row.id]: "" }));
            setTick((value) => value + 1);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa xử lý được yêu cầu.");
        }
    }

    return (
        <main className="box-border flex flex-col gap-4 px-4 py-8 sm:px-8">
            <h1 className={AUTH_TITLE_CLASS}>Hoàn tiền</h1>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo trạng thái">
                {FILTERS.map((filter) => (
                    <button
                        key={filter.label}
                        type="button"
                        className={`${AUTH_FIELD_CLASS} !w-auto cursor-pointer aria-pressed:font-bold aria-pressed:underline`}
                        aria-pressed={status === filter.value}
                        onClick={() => {
                            setStatus(filter.value);
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
            {rows.length === 0 ? <p className="m-0 text-sm">Không có yêu cầu nào.</p> : null}
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
                {rows.map((row) => (
                    <li key={row.id} className="flex max-w-2xl flex-col gap-2 border border-current p-4 text-sm">
                        <p className="m-0 font-semibold">
                            {formatVnd(row.amountVnd)} · đơn {row.orderCode ?? row.orderId} ·{" "}
                            {REFUND_STATUS[row.status]}
                        </p>
                        <p className="m-0">Lý do: {REFUND_REASON[row.reason]}</p>
                        {row.userNote ? <p className="m-0">Người dùng ghi: {row.userNote}</p> : null}
                        <p className="m-0 tabular-nums">
                            Chuyển tới: {row.payoutAccountName} · {row.payoutBank} · {row.payoutAccountNumber}
                        </p>
                        {row.decisionNote ? <p className="m-0">Ghi chú xử lý: {row.decisionNote}</p> : null}
                        {row.payoutReference ? (
                            <p className="m-0">Mã tham chiếu: {row.payoutReference}</p>
                        ) : null}
                        {row.status === "requested" || row.status === "approved" ? (
                            <>
                                <input
                                    className={AUTH_FIELD_CLASS}
                                    aria-label={
                                        row.status === "requested" ? "Ghi chú xử lý" : "Mã tham chiếu chuyển khoản"
                                    }
                                    placeholder={
                                        row.status === "requested"
                                            ? "Ghi chú xử lý (bắt buộc)"
                                            : "Mã tham chiếu chuyển khoản"
                                    }
                                    maxLength={row.status === "requested" ? 500 : 64}
                                    value={notes[row.id] ?? ""}
                                    onChange={(event) =>
                                        setNotes((current) => ({ ...current, [row.id]: event.target.value }))
                                    }
                                />
                                <div className="flex flex-wrap gap-2">
                                    {row.status === "requested" ? (
                                        <>
                                            <button
                                                type="button"
                                                className={`${AUTH_BUTTON_CLASS} !w-auto`}
                                                onClick={() =>
                                                    void act(
                                                        row,
                                                        (value) => decideRefund(row.id, "approve", value),
                                                        "Hãy nhập ghi chú xử lý (ít nhất 3 ký tự).",
                                                    )
                                                }
                                            >
                                                Duyệt
                                            </button>
                                            <button
                                                type="button"
                                                className={`${AUTH_BUTTON_CLASS} !w-auto`}
                                                onClick={() =>
                                                    void act(
                                                        row,
                                                        (value) => decideRefund(row.id, "reject", value),
                                                        "Hãy nhập lý do từ chối (ít nhất 3 ký tự).",
                                                    )
                                                }
                                            >
                                                Từ chối
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            className={`${AUTH_BUTTON_CLASS} !w-auto`}
                                            onClick={() =>
                                                void act(
                                                    row,
                                                    (value) => markRefundPaidOut(row.id, value),
                                                    "Hãy nhập mã tham chiếu chuyển khoản (ít nhất 3 ký tự).",
                                                )
                                            }
                                        >
                                            Ghi đã chuyển tiền
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </li>
                ))}
            </ul>
            <div className="flex gap-2">
                <button
                    type="button"
                    className={`${AUTH_BUTTON_CLASS} !w-auto`}
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                >
                    Trang trước
                </button>
                <button
                    type="button"
                    className={`${AUTH_BUTTON_CLASS} !w-auto`}
                    disabled={rows.length < PAGE_SIZE}
                    onClick={() => setPage((value) => value + 1)}
                >
                    Trang sau
                </button>
            </div>
        </main>
    );
}
