"use client";

import { useEffect, useState } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS } from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import {
    ORDER_STATUS,
    adminOrders,
    adminRefunds,
    decideRefund,
    formatVnd,
    markRefundPaid,
    resolveOrder,
    revokeSubscription,
    type OrderView,
    type RefundView,
} from "@/features/billing/billing.api";

export default function Page() {
    const [orders, setOrders] = useState<OrderView[]>([]);
    const [refunds, setRefunds] = useState<RefundView[]>([]);
    const [reason, setReason] = useState("");
    const [message, setMessage] = useState("");

    async function load(): Promise<void> {
        try {
            const [nextOrders, nextRefunds] = await Promise.all([
                adminOrders("needs_review"),
                adminRefunds(),
            ]);
            setOrders(nextOrders);
            setRefunds(nextRefunds);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được đối soát.");
        }
    }

    useEffect(() => {
        let active = true;
        void Promise.all([adminOrders("needs_review"), adminRefunds()])
            .then(([nextOrders, nextRefunds]) => {
                if (!active) return;
                setOrders(nextOrders);
                setRefunds(nextRefunds);
            })
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được đối soát.");
            });
        return () => {
            active = false;
        };
    }, []);

    async function run(action: () => Promise<unknown>): Promise<void> {
        if (reason.trim().length < 3) {
            setMessage("Nhập lý do ít nhất 3 ký tự trước khi xác nhận.");
            return;
        }
        setMessage("");
        try {
            await action();
            await load();
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Thao tác chưa xong.");
        }
    }

    return (
        <main className="box-border flex flex-col gap-8 px-4 py-8 sm:px-8">
            <h1 className="m-0 text-2xl font-semibold">Đối soát thanh toán</h1>
            <label className="flex max-w-md flex-col gap-1 text-sm">
                Lý do ghi nhật ký
                <input
                    className={AUTH_FIELD_CLASS}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                />
            </label>
            {message ? (
                <p role="status" className="m-0 text-sm">
                    {message}
                </p>
            ) : null}
            <section>
                <h2 className="text-lg font-semibold">Đơn chờ đối soát</h2>
                {orders.length === 0 ? <p className="text-sm">Không có đơn chờ.</p> : null}
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                    {orders.map((order) => (
                        <li key={order.id} className="border border-current p-4 text-sm">
                            <p className="m-0">
                                {order.code} · {formatVnd(order.receivedVnd)} / {formatVnd(order.amountVnd)} ·{" "}
                                {ORDER_STATUS[order.status]}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    className={AUTH_BUTTON_CLASS}
                                    type="button"
                                    onClick={() => void run(() => resolveOrder(order.id, "fulfill", reason))}
                                >
                                    Ghi nhận và mở quyền
                                </button>
                                <button
                                    className={AUTH_BUTTON_CLASS}
                                    type="button"
                                    onClick={() => void run(() => resolveOrder(order.id, "reject", reason))}
                                >
                                    Không mở
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
            <section>
                <h2 className="text-lg font-semibold">Yêu cầu hoàn</h2>
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                    {refunds.map((refund) => (
                        <li key={refund.id} className="border border-current p-4 text-sm">
                            <p className="m-0">
                                {refund.reason} · {formatVnd(refund.amountVnd)} · {refund.status}
                            </p>
                            <p className="m-0">
                                {refund.payoutAccountName} · {refund.payoutBank} · {refund.payoutAccountNumber}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {refund.status === "requested" ? (
                                    <>
                                        <button
                                            className={AUTH_BUTTON_CLASS}
                                            type="button"
                                            onClick={() => void run(() => decideRefund(refund.id, "approve", reason))}
                                        >
                                            Duyệt
                                        </button>
                                        <button
                                            className={AUTH_BUTTON_CLASS}
                                            type="button"
                                            onClick={() => void run(() => decideRefund(refund.id, "reject", reason))}
                                        >
                                            Từ chối
                                        </button>
                                    </>
                                ) : null}
                                {refund.status === "approved" ? (
                                    <button
                                        className={AUTH_BUTTON_CLASS}
                                        type="button"
                                        onClick={() => void run(() => markRefundPaid(refund.id, reason))}
                                    >
                                        Ghi đã chuyển, dùng lý do làm mã tham chiếu
                                    </button>
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
            <section>
                <h2 className="text-lg font-semibold">Thu hồi gói</h2>
                <form
                    className="flex max-w-md flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const id = String(new FormData(event.currentTarget).get("id") || "");
                        void run(() => revokeSubscription(id, reason));
                    }}
                >
                    <label className="flex flex-col gap-1 text-sm">
                        Mã gói
                        <input className={AUTH_FIELD_CLASS} name="id" required />
                    </label>
                    <button className={AUTH_BUTTON_CLASS} type="submit">
                        Thu hồi ngay
                    </button>
                </form>
            </section>
        </main>
    );
}