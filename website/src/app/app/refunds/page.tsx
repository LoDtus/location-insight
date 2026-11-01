"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
    AUTH_BUTTON_CLASS,
    AUTH_FIELD_CLASS,
    AUTH_FORM_CLASS,
    AUTH_LABEL_CLASS,
    AUTH_TITLE_CLASS,
} from "@/app/auth/form-class";
import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import { formatVnd, getMyBilling, requestRefund, type OrderView } from "@/features/billing/billing.api";

export function RefundScreen({ root }: { root: ShellRoot }) {
    const [orders, setOrders] = useState<OrderView[]>([]);
    const [message, setMessage] = useState("");
    const [done, setDone] = useState("");

    useEffect(() => {
        void getMyBilling()
            .then((billing) => setOrders(billing.orders.filter((order) => order.status === "paid")))
            .catch((error: unknown) => {
                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được đơn.");
            });
    }, []);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const orderId = String(form.get("orderId") || "");
        setMessage("");
        try {
            const refund = await requestRefund(orderId, {
                reason: String(form.get("reason") || ""),
                amountVnd: Number(form.get("amountVnd") || 0),
                userNote: String(form.get("userNote") || ""),
                payoutAccountName: String(form.get("payoutAccountName") || ""),
                payoutAccountNumber: String(form.get("payoutAccountNumber") || ""),
                payoutBank: String(form.get("payoutBank") || ""),
            });
            setDone(`Đã nhận yêu cầu ${refund.id}. Địa Thế trả lời trong khoảng 7 ngày làm việc.`);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa gửi được yêu cầu.");
        }
    }

    return (
        <main className="box-border px-4 py-8 sm:px-8">
            <form className={AUTH_FORM_CLASS} onSubmit={handleSubmit}>
                <h1 className={AUTH_TITLE_CLASS}>Xin hoàn</h1>
                <p className="m-0 text-sm leading-relaxed">
                    Trong 24 giờ đầu nếu chưa dùng quyền của lần trả đó. Ngoài ra: chuyển thừa, thu trùng, gián đoạn, hoặc Địa Thế ngừng phần đã trả.
                </p>
                {orders.length === 0 ? <p className="m-0 text-sm">Chưa có đơn đã trả.</p> : null}
                <label className={AUTH_LABEL_CLASS}>
                    Đơn
                    <select className={AUTH_FIELD_CLASS} name="orderId" required>
                        {orders.map((order) => (
                            <option key={order.id} value={order.id}>
                                {order.code} · {formatVnd(order.amountVnd)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={AUTH_LABEL_CLASS}>
                    Lý do
                    <select className={AUTH_FIELD_CLASS} name="reason" defaultValue="within_24h">
                        <option value="within_24h">Trong 24 giờ, chưa dùng quyền</option>
                        <option value="overpay">Chuyển thừa</option>
                        <option value="duplicate_or_wrong">Thu trùng hoặc thu nhầm</option>
                        <option value="service_outage">Dịch vụ gián đoạn hơn 48 giờ</option>
                        <option value="operator_stop">Địa Thế ngừng phần đã trả</option>
                        <option value="legal">Theo pháp luật</option>
                    </select>
                </label>
                <label className={AUTH_LABEL_CLASS}>
                    Số tiền muốn nhận lại
                    <input className={AUTH_FIELD_CLASS} name="amountVnd" inputMode="numeric" required />
                </label>
                <label className={AUTH_LABEL_CLASS}>
                    Chủ tài khoản nhận
                    <input className={AUTH_FIELD_CLASS} name="payoutAccountName" autoComplete="name" required />
                </label>
                <label className={AUTH_LABEL_CLASS}>
                    Số tài khoản
                    <input className={AUTH_FIELD_CLASS} name="payoutAccountNumber" inputMode="numeric" required />
                </label>
                <label className={AUTH_LABEL_CLASS}>
                    Ngân hàng
                    <input className={AUTH_FIELD_CLASS} name="payoutBank" required />
                </label>
                <label className={AUTH_LABEL_CLASS}>
                    Ghi chú
                    <textarea className={AUTH_FIELD_CLASS} name="userNote" rows={3} />
                </label>
                {message ? (
                    <p role="alert" className="m-0 text-sm">
                        {message}
                    </p>
                ) : null}
                {done ? (
                    <p role="status" className="m-0 text-sm">
                        {done}
                    </p>
                ) : null}
                <button className={AUTH_BUTTON_CLASS} type="submit" disabled={orders.length === 0}>
                    Gửi yêu cầu
                </button>
                <p className="m-0 text-sm">
                    <Link href={`${root}/plans`}>Về gói của tôi</Link>
                </p>
            </form>
        </main>
    );
}

export default function Page() {
    return <RefundScreen root="/app" />;
}
