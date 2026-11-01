"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FORM_CLASS, AUTH_TITLE_CLASS } from "@/app/auth/form-class";
import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import {
    ORDER_STATUS,
    cancelSubscription,
    resumeSubscription,
    formatVnd,
    getMyBilling,
    markNoticeRead,
    type MyBilling,
} from "@/features/billing/billing.api";

const PLAN_NAME = {
    free: "Miễn phí",
    unlimited: "Không giới hạn lượt",
    valued: "Có định giá",
} as const;

export function PlanScreen({ root }: { root: ShellRoot }) {
    const [billing, setBilling] = useState<MyBilling | null>(null);
    const [message, setMessage] = useState("");

    async function load(): Promise<void> {
        try {
            setBilling(await getMyBilling());
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được gói.");
        }
    }

    useEffect(() => {
        let active = true;
        void getMyBilling()
            .then((data) => {
                if (active) setBilling(data);
            })
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được gói.");
            });
        return () => {
            active = false;
        };
    }, []);

    return (
        <main className="box-border flex flex-col gap-6 px-4 py-8 sm:px-8">
            <section className={AUTH_FORM_CLASS}>
                <h1 className={AUTH_TITLE_CLASS}>
                    {billing ? PLAN_NAME[billing.effectivePlan] : "Gói của tôi"}
                </h1>
                {message ? (
                    <p role="alert" className="m-0 text-sm">
                        {message}
                    </p>
                ) : null}
                {billing ? (
                    <>
                        <p className="m-0 text-sm leading-relaxed">
                            {billing.periodEnd
                                ? `Còn dùng đến ${new Date(billing.periodEnd).toLocaleDateString("vi-VN")}. Không tự gia hạn.`
                                : "Bạn đang dùng hạn mức miễn phí."}
                            {billing.source === "admin_grant" ? " Gói này do quản trị cấp." : ""}
                            {billing.cancelAtPeriodEnd ? " Đã hủy, quyền giữ đến hết hạn đã trả." : ""}
                        </p>
                        <p className="m-0 text-sm">Lượt định giá lẻ còn {billing.valuationCredits}.</p>
                        <Link className={AUTH_BUTTON_CLASS} href={`${root}/payments`}>
                            {billing.effectivePlan === "free"
                                ? "Mua gói"
                                : billing.effectivePlan === "unlimited"
                                  ? "Gia hạn hoặc nâng lên Có định giá"
                                  : "Gia hạn gói"}
                        </Link>
                        {billing.cancelAtPeriodEnd && billing.subscriptionId ? (
                            <button
                                className={AUTH_BUTTON_CLASS}
                                type="button"
                                onClick={() => {
                                    if (!billing.subscriptionId) return;
                                    void resumeSubscription(billing.subscriptionId)
                                        .then(() => load())
                                        .catch((error: unknown) => {
                                            setMessage(
                                                error instanceof AuthApiError
                                                    ? error.message
                                                    : "Chưa rút lại được lệnh hủy.",
                                            );
                                        });
                                }}
                            >
                                Rút lại lệnh hủy
                            </button>
                        ) : null}
                        {!billing.cancelAtPeriodEnd && billing.subscriptionId ? (
                            <button
                                className={AUTH_BUTTON_CLASS}
                                type="button"
                                onClick={() => {
                                    if (!billing.subscriptionId) return;
                                    void cancelSubscription(billing.subscriptionId)
                                        .then(() => load())
                                        .catch((error: unknown) => {
                                            setMessage(
                                                error instanceof AuthApiError
                                                    ? error.message
                                                    : "Chưa hủy được gói.",
                                            );
                                        });
                                }}
                            >
                                Hủy gói
                            </button>
                        ) : null}
                    </>
                ) : null}
            </section>
            <section className={`${AUTH_FORM_CLASS} max-w-xl`}>
                <h2 className="m-0 text-lg font-semibold">Thông báo</h2>
                {billing?.notices.length ? (
                    billing.notices.map((notice) => (
                        <article key={notice.id} className="text-sm leading-relaxed">
                            <p className="m-0 font-semibold">{notice.title}</p>
                            <p className="m-0">{notice.body}</p>
                            {notice.readAt ? null : (
                                <button
                                    className={AUTH_BUTTON_CLASS}
                                    type="button"
                                    onClick={() => {
                                        void markNoticeRead(notice.id).then(() => load());
                                    }}
                                >
                                    Đánh dấu đã đọc
                                </button>
                            )}
                        </article>
                    ))
                ) : (
                    <p className="m-0 text-sm">Chưa có thông báo.</p>
                )}
            </section>
            <section className="max-w-3xl overflow-x-auto">
                <h2 className="text-lg font-semibold">Đơn đã tạo</h2>
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr>
                            <th className="border-b p-2 text-left">Mã</th>
                            <th className="border-b p-2 text-right">Số tiền</th>
                            <th className="border-b p-2 text-left">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        {billing?.orders.map((order) => (
                            <tr key={order.id}>
                                <td className="border-b p-2">
                                    <Link href={`${root}/payments/${order.id}`}>{order.code}</Link>
                                </td>
                                <td className="border-b p-2 text-right tabular-nums">
                                    {formatVnd(order.amountVnd)}
                                </td>
                                <td className="border-b p-2">{ORDER_STATUS[order.status]}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </main>
    );
}

export default function Page() {
    return <PlanScreen root="/app" />;
}
