"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
    AUTH_BUTTON_CLASS,
    AUTH_FIELD_CLASS,
    AUTH_FORM_CLASS,
    AUTH_LABEL_CLASS,
    AUTH_TITLE_CLASS,
} from "@/app/auth/form-class";
import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import { createOrder, formatVnd } from "@/features/billing/billing.api";

const PRICES = {
    unlimited: { month: 30000, year: 300000, name: "Không giới hạn lượt" },
    valued: { month: 60000, year: 600000, name: "Có định giá" },
    credit: { month: 10000, year: 10000, name: "Một lần định giá" },
} as const;

export function CheckoutScreen({ root }: { root: ShellRoot }) {
    const router = useRouter();
    const params = useSearchParams();
    const initialPlan = params.get("plan");
    const initialCycle = params.get("cycle");
    const [plan, setPlan] = useState<keyof typeof PRICES>(
        initialPlan === "unlimited" || initialPlan === "valued" || initialPlan === "credit"
            ? initialPlan
            : "valued",
    );
    const [cycle, setCycle] = useState<"month" | "year">(initialCycle === "year" ? "year" : "month");
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);

    const amount = plan === "credit" ? 10000 : PRICES[plan][cycle];

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setPending(true);
        setMessage("");
        try {
            const order = await createOrder(
                plan === "credit"
                    ? { kind: "valuation_credit" }
                    : { kind: "subscription", plan, cycle },
            );
            router.push(`${root}/payments/${order.id}`);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa tạo được đơn.");
            setPending(false);
        }
    }

    return (
        <main className="box-border px-4 py-8 sm:px-8">
            <form className={AUTH_FORM_CLASS} onSubmit={handleSubmit}>
                <h1 className={AUTH_TITLE_CLASS}>Tạo mã chuyển khoản</h1>
                <p className="m-0 text-sm leading-relaxed">
                    {PRICES[plan].name}, {formatVnd(amount)}. Gói không tự trừ tiền lần sau. Cùng hạng thì nối hạn. Hạng cao hơn thay gói cũ khi tiền vào. Hạng thấp hơn bị từ chối nếu gói hiện tại còn hạn. Một lần định giá không tính là gói thứ hai.
                </p>
                <label className={AUTH_LABEL_CLASS}>
                    Gói
                    <select
                        className={AUTH_FIELD_CLASS}
                        value={plan}
                        onChange={(event) => setPlan(event.target.value as keyof typeof PRICES)}
                    >
                        <option value="unlimited">Không giới hạn lượt</option>
                        <option value="valued">Có định giá</option>
                        <option value="credit">Một lần định giá</option>
                    </select>
                </label>
                {plan === "credit" ? null : (
                    <label className={AUTH_LABEL_CLASS}>
                        Kỳ
                        <select
                            className={AUTH_FIELD_CLASS}
                            value={cycle}
                            onChange={(event) => setCycle(event.target.value as "month" | "year")}
                        >
                            <option value="month">30 ngày</option>
                            <option value="year">365 ngày, giá bằng 10 tháng</option>
                        </select>
                    </label>
                )}
                {message ? (
                    <p role="alert" className="m-0 text-sm">
                        {message}
                    </p>
                ) : null}
                <button className={AUTH_BUTTON_CLASS} type="submit" disabled={pending}>
                    {pending ? "Đang tạo mã" : "Tạo mã chuyển khoản"}
                </button>
                <p className="m-0 text-sm">
                    <Link href={`${root}/plans`}>Gói của tôi</Link>
                </p>
            </form>
        </main>
    );
}

export default function Page() {
    return <CheckoutScreen root="/app" />;
}
