"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS } from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import {
    ORDER_STATUS,
    adminOrders,
    adminRefunds,
    adminUserBilling,
    decideRefund,
    formatVnd,
    grantSubscription,
    markRefundPaid,
    resolveOrder,
    revokeSubscription,
    searchUsers,
    type AdminUserHit,
    type MyBilling,
    type OrderView,
    type RefundView,
} from "@/features/billing/billing.api";

const PLAN_NAME = {
    free: "Miễn phí",
    unlimited: "Không giới hạn lượt",
    valued: "Có định giá",
} as const;

export default function Page() {
    const [orders, setOrders] = useState<OrderView[]>([]);
    const [refunds, setRefunds] = useState<RefundView[]>([]);
    const [reason, setReason] = useState("");
    const [message, setMessage] = useState("");
    const [lookup, setLookup] = useState("");
    const [people, setPeople] = useState<AdminUserHit[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [person, setPerson] = useState<MyBilling | null>(null);
    const [grantPlan, setGrantPlan] = useState<"unlimited" | "valued">("unlimited");
    const [grantUntil, setGrantUntil] = useState("");

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

    async function run(action: () => Promise<unknown>): Promise<boolean> {
        if (reason.trim().length < 3) {
            setMessage("Nhập lý do ít nhất 3 ký tự trước khi xác nhận.");
            return false;
        }
        setMessage("");
        try {
            await action();
            await load();
            return true;
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Thao tác chưa xong.");
            return false;
        }
    }

    return (
        <main className="box-border flex flex-col gap-8 px-4 py-8 sm:px-8">
            <div>
                <h1 className="m-0 text-2xl font-semibold">Đối soát thanh toán</h1>
                <p className="mt-1 mb-0 text-sm">
                    <Link href="/admin/blogs" className="underline underline-offset-4">
                        Bài viết
                    </Link>
                </p>
            </div>
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
            <section className="flex max-w-xl flex-col gap-4">
                <h2 className="m-0 text-lg font-semibold">Gói của một người</h2>
                <form
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const term = lookup.trim();
                        if (term.length < 2) {
                            setMessage("Nhập ít nhất 2 ký tự email hoặc tên.");
                            return;
                        }
                        setMessage("");
                        void searchUsers(term)
                            .then((result) => {
                                setPeople(result.items.filter((item) => item.role === "user"));
                                setSelectedId("");
                                setPerson(null);
                            })
                            .catch((error: unknown) => {
                                setMessage(
                                    error instanceof AuthApiError ? error.message : "Chưa tìm được người dùng.",
                                );
                            });
                    }}
                >
                    <label className="flex flex-col gap-1 text-sm">
                        Email hoặc tên
                        <input
                            className={AUTH_FIELD_CLASS}
                            value={lookup}
                            onChange={(event) => setLookup(event.target.value)}
                        />
                    </label>
                    <button className={AUTH_BUTTON_CLASS} type="submit">
                        Tìm
                    </button>
                </form>
                {people.length === 0 ? <p className="m-0 text-sm">Chưa chọn người dùng.</p> : null}
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {people.map((item) => (
                        <li key={item.userId}>
                            <button
                                className={AUTH_BUTTON_CLASS}
                                type="button"
                                onClick={() => {
                                    setSelectedId(item.userId);
                                    setMessage("");
                                    void adminUserBilling(item.userId)
                                        .then(setPerson)
                                        .catch((error: unknown) => {
                                            setPerson(null);
                                            setMessage(
                                                error instanceof AuthApiError
                                                    ? error.message
                                                    : "Chưa xem được gói.",
                                            );
                                        });
                                }}
                            >
                                {item.displayName} · {item.email}
                            </button>
                        </li>
                    ))}
                </ul>
                {person && selectedId ? (
                    <div className="border border-current p-4 text-sm">
                        <p className="m-0">
                            {PLAN_NAME[person.effectivePlan]}
                            {person.periodEnd
                                ? ` đến ${new Date(person.periodEnd).toLocaleDateString("vi-VN")}`
                                : ""}
                            {person.cancelAtPeriodEnd ? ". Đã đặt hủy cuối kỳ" : ""}
                            {person.source === "admin_grant" ? ". Do quản trị cấp" : ""}
                        </p>
                        {person.subscriptionId ? (
                            <button
                                className={AUTH_BUTTON_CLASS}
                                type="button"
                                onClick={() => {
                                    const id = person.subscriptionId;
                                    if (!id) return;
                                    void run(() => revokeSubscription(id, reason)).then((ok) => {
                                        if (!ok) return;
                                        void adminUserBilling(selectedId).then(setPerson);
                                    });
                                }}
                            >
                                Thu hồi ngay
                            </button>
                        ) : (
                            <form
                                className="mt-3 flex flex-col gap-3"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    if (reason.trim().length < 5) {
                                        setMessage("Lý do cấp gói cần ít nhất 5 ký tự.");
                                        return;
                                    }
                                    if (!grantUntil) {
                                        setMessage("Chọn ngày hết hạn.");
                                        return;
                                    }
                                    const periodEnd = new Date(`${grantUntil}T23:59:59+07:00`).toISOString();
                                    void run(() =>
                                        grantSubscription(selectedId, {
                                            plan: grantPlan,
                                            periodEnd,
                                            reason,
                                        }),
                                    ).then((ok) => {
                                        if (!ok) return;
                                        void adminUserBilling(selectedId).then(setPerson);
                                    });
                                }}
                            >
                                <label className="flex flex-col gap-1">
                                    Gói cấp
                                    <select
                                        className={AUTH_FIELD_CLASS}
                                        value={grantPlan}
                                        onChange={(event) =>
                                            setGrantPlan(event.target.value as "unlimited" | "valued")
                                        }
                                    >
                                        <option value="unlimited">Không giới hạn lượt</option>
                                        <option value="valued">Có định giá</option>
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                    Hết hạn
                                    <input
                                        className={AUTH_FIELD_CLASS}
                                        type="date"
                                        value={grantUntil}
                                        onChange={(event) => setGrantUntil(event.target.value)}
                                        required
                                    />
                                </label>
                                <button className={AUTH_BUTTON_CLASS} type="submit">
                                    Cấp gói
                                </button>
                            </form>
                        )}
                    </div>
                ) : null}
            </section>
        </main>
    );
}