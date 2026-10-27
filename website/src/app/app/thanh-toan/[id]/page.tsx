"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FORM_CLASS, AUTH_TITLE_CLASS } from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import {
    ORDER_STATUS,
    cancelOrder,
    formatVnd,
    getOrder,
    type OrderView,
} from "@/features/billing/billing.api";

export default function Page() {
    const params = useParams<{ id: string }>();
    const [order, setOrder] = useState<OrderView | null>(null);
    const [message, setMessage] = useState("");
    const [copied, setCopied] = useState("");

    useEffect(() => {
        let stop = false;
        let timer = 0;
        async function tick(): Promise<void> {
            try {
                const next = await getOrder(params.id);
                if (stop) return;
                setOrder(next);
                setMessage("");
                if (next.status === "pending") {
                    timer = window.setTimeout(() => {
                        void tick();
                    }, 3000);
                }
            } catch (error) {
                if (!stop) {
                    setMessage(error instanceof AuthApiError ? error.message : "Chưa đọc được đơn.");
                }
            }
        }
        void tick();
        return () => {
            stop = true;
            window.clearTimeout(timer);
        };
    }, [params.id]);

    async function copyCode(): Promise<void> {
        if (!order) return;
        try {
            await navigator.clipboard.writeText(order.transferContent);
            setCopied("Đã chép nội dung chuyển khoản.");
        } catch {
            setCopied("Trình duyệt chặn chép. Hãy chọn mã và chép tay.");
        }
    }

    async function cancel(): Promise<void> {
        if (!order) return;
        try {
            setOrder(await cancelOrder(order.id));
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa hủy được đơn.");
        }
    }

    return (
        <main className="box-border px-4 py-8 sm:px-8">
            <section className={`${AUTH_FORM_CLASS} max-w-xl`}>
                <h1 className={AUTH_TITLE_CLASS}>
                    {order ? ORDER_STATUS[order.status] : "Đang tải đơn"}
                </h1>
                {message ? (
                    <p role="alert" className="m-0 text-sm">
                        {message}
                    </p>
                ) : null}
                {order ? (
                    <>
                        <p className="m-0 text-sm leading-relaxed" role="status">
                            {order.status === "pending"
                                ? "Chuyển đúng số tiền và đúng nội dung. Trang này tự kiểm tra lại mỗi vài giây."
                                : order.status === "paid"
                                  ? "Đã ghi nhận. Quyền hoặc lượt định giá đã được mở."
                                  : order.status === "needs_review"
                                    ? "Khoản này cần người xem. Quyền chưa mở."
                                    : "Đơn này không còn nhận tiền tự động."}
                        </p>
                        <dl className="m-0 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
                            <dt>Số tiền</dt>
                            <dd className="m-0 tabular-nums">{formatVnd(order.amountVnd)}</dd>
                            <dt>Đã nhận</dt>
                            <dd className="m-0 tabular-nums">{formatVnd(order.receivedVnd)}</dd>
                            <dt>Ngân hàng</dt>
                            <dd className="m-0">{order.bank}</dd>
                            <dt>Số tài khoản</dt>
                            <dd className="m-0 tabular-nums">{order.accountNumber}</dd>
                            <dt>Chủ tài khoản</dt>
                            <dd className="m-0">{order.accountHolder}</dd>
                            <dt>Nội dung</dt>
                            <dd className="m-0 font-semibold">{order.transferContent}</dd>
                        </dl>
                        {order.qrUrl && order.status === "pending" ? (
                            // Ảnh QR do SePay sinh theo từng đơn, không đi qua bộ tối ưu ảnh của Next.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={order.qrUrl}
                                width={220}
                                height={220}
                                alt="Mã QR chuyển khoản đã điền sẵn số tiền và nội dung"
                            />
                        ) : null}
                        <p className="m-0 text-sm" role="status">
                            {copied}
                        </p>
                        <button className={AUTH_BUTTON_CLASS} type="button" onClick={() => void copyCode()}>
                            Chép nội dung
                        </button>
                        {order.status === "pending" ? (
                            <button className={AUTH_BUTTON_CLASS} type="button" onClick={() => void cancel()}>
                                Hủy đơn chưa trả
                            </button>
                        ) : null}
                    </>
                ) : null}
                <p className="m-0 text-sm">
                    <Link href="/app/goi">Gói của tôi</Link>
                </p>
            </section>
        </main>
    );
}
