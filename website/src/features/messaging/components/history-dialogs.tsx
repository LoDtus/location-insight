"use client";

import { useState, type JSX } from "react";

import { errorText } from "../messaging.actions";
import { dayLabel } from "../messaging.format";
import type { DeleteRequest } from "../messaging.types";
import { Dialog } from "./dialog";

/**
 * Người nhận yêu cầu thấy hộp này: đồng ý thì lịch sử bị xóa vĩnh viễn ở CẢ HAI phía.
 * Đóng hộp (X, Esc) không có nghĩa từ chối: yêu cầu vẫn chờ cho đến khi chọn.
 */
export function IncomingDeleteDialog({
    peerName,
    request,
    onAccept,
    onDecline,
    onClose,
}: {
    peerName: string;
    request: DeleteRequest;
    onAccept: () => Promise<void>;
    onDecline: () => Promise<void>;
    onClose: () => void;
}): JSX.Element {
    const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
    const [error, setError] = useState("");

    async function run(kind: "accept" | "decline"): Promise<void> {
        setBusy(kind);
        setError("");
        try {
            await (kind === "accept" ? onAccept() : onDecline());
            onClose();
        } catch (failure) {
            setError(errorText(failure));
            setBusy(null);
        }
    }

    return (
        <Dialog title="Xóa lịch sử trò chuyện?" onClose={busy ? () => undefined : onClose}>
            <div className="grid gap-3 text-sm text-charcoal/85">
                <p className="m-0">
                    <strong>{peerName}</strong> muốn xóa toàn bộ lịch sử trò chuyện với bạn (đề nghị lúc {dayLabel(request.createdAt)}).
                </p>
                <p className="m-0">
                    Nếu bạn đồng ý, mọi tin nhắn, ảnh và tệp đã gửi tới thời điểm đó sẽ bị xóa <strong>vĩnh viễn ở cả hai phía</strong> và
                    không thể khôi phục. Nếu từ chối, mọi thứ giữ nguyên.
                </p>
            </div>
            {error ? (
                <p role="alert" className="m-0 mt-3 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                    type="button"
                    disabled={busy !== null}
                    className="min-h-11 rounded-full border border-charcoal/25 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-green disabled:opacity-50"
                    onClick={() => void run("decline")}
                >
                    {busy === "decline" ? "Đang xử lý…" : "Từ chối"}
                </button>
                <button
                    type="button"
                    disabled={busy !== null}
                    className="min-h-11 rounded-full bg-red-700 px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-60"
                    onClick={() => void run("accept")}
                >
                    {busy === "accept" ? "Đang xóa…" : "Đồng ý xóa"}
                </button>
            </div>
        </Dialog>
    );
}
