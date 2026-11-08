"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
    AUTH_BUTTON_CLASS,
    AUTH_FIELD_CLASS,
    AUTH_FORM_CLASS,
    AUTH_LABEL_CLASS,
} from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import {
    REFUND_REASON,
    REFUND_STATUS,
    formatVnd,
    myRefunds,
    requestRefund,
    type RefundReason,
    type RefundView,
} from "@/features/billing/billing.api";

const REASONS = Object.keys(REFUND_REASON) as RefundReason[];

/** Xin hoàn cho một đơn đã trả và xem các yêu cầu hoàn đã gửi của đơn đó. */
export function OrderRefund({ orderId }: { orderId: string }) {
    const [items, setItems] = useState<RefundView[]>([]);
    const [reason, setReason] = useState<RefundReason>("within_24h");
    const [name, setName] = useState("");
    const [number, setNumber] = useState("");
    const [bank, setBank] = useState("");
    const [note, setNote] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(async (): Promise<void> => {
        try {
            const all = await myRefunds();
            setItems(all.filter((row) => row.orderId === orderId));
        } catch {
            setItems([]);
        }
    }, [orderId]);

    useEffect(() => {
        let active = true;
        void myRefunds()
            .then((all) => {
                if (active) setItems(all.filter((row) => row.orderId === orderId));
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [orderId]);

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        try {
            await requestRefund(orderId, {
                reason,
                payoutAccountName: name,
                payoutAccountNumber: number,
                payoutBank: bank,
                userNote: note.trim() || undefined,
            });
            setNumber("");
            setNote("");
            setMessage("Đã gửi yêu cầu hoàn. Bạn sẽ nhận thông báo khi có kết quả.");
            await load();
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa gửi được yêu cầu hoàn.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className={`${AUTH_FORM_CLASS} max-w-xl`} aria-labelledby="refund-title">
            <h2 id="refund-title" className="m-0 text-lg font-semibold">
                Xin hoàn tiền
            </h2>
            {items.map((row) => (
                <article key={row.id} className="text-sm leading-relaxed">
                    <p className="m-0 font-semibold">
                        {formatVnd(row.amountVnd)} · {REFUND_STATUS[row.status]}
                    </p>
                    <p className="m-0">{REFUND_REASON[row.reason]}</p>
                    <p className="m-0">
                        Nhận tại {row.payoutBank} · {row.payoutAccountNumber}
                    </p>
                    {row.decisionNote ? <p className="m-0">Ghi chú: {row.decisionNote}</p> : null}
                    {row.payoutReference ? (
                        <p className="m-0">Mã tham chiếu chuyển tiền: {row.payoutReference}</p>
                    ) : null}
                </article>
            ))}
            <form className="m-0 flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
                <label className={AUTH_LABEL_CLASS}>
                    Lý do
                    <select
                        className={AUTH_FIELD_CLASS}
                        value={reason}
                        onChange={(event) => setReason(event.target.value as RefundReason)}
                    >
                        {REASONS.map((value) => (
                            <option key={value} value={value}>
                                {REFUND_REASON[value]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={AUTH_LABEL_CLASS}>
                    Chủ tài khoản nhận hoàn
                    <input
                        className={AUTH_FIELD_CLASS}
                        value={name}
                        maxLength={120}
                        required
                        autoComplete="off"
                        onChange={(event) => setName(event.target.value)}
                    />
                </label>
                <label className={AUTH_LABEL_CLASS}>
                    Số tài khoản
                    <input
                        className={AUTH_FIELD_CLASS}
                        value={number}
                        maxLength={40}
                        required
                        inputMode="numeric"
                        autoComplete="off"
                        onChange={(event) => setNumber(event.target.value)}
                    />
                </label>
                <label className={AUTH_LABEL_CLASS}>
                    Ngân hàng
                    <input
                        className={AUTH_FIELD_CLASS}
                        value={bank}
                        maxLength={64}
                        required
                        autoComplete="off"
                        onChange={(event) => setBank(event.target.value)}
                    />
                </label>
                <label className={AUTH_LABEL_CLASS}>
                    Ghi chú (không bắt buộc)
                    <textarea
                        className={AUTH_FIELD_CLASS}
                        value={note}
                        maxLength={500}
                        rows={3}
                        onChange={(event) => setNote(event.target.value)}
                    />
                </label>
                <p className="m-0 text-sm" role="status">
                    {message}
                </p>
                <button className={AUTH_BUTTON_CLASS} type="submit" disabled={busy}>
                    Gửi yêu cầu hoàn
                </button>
            </form>
        </section>
    );
}
