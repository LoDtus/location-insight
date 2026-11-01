"use client";

import Link from "next/link";
import { useState } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FORM_CLASS, AUTH_LINKS_CLASS, AUTH_TITLE_CLASS } from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import { unsubscribe } from "@/features/email/email.api";

export default function Page() {
    const [state, setState] = useState<"idle" | "pending" | "done" | "error">("idle");
    const [message, setMessage] = useState("");

    async function confirm(): Promise<void> {
        const params = new URLSearchParams(window.location.search);
        const query = new URLSearchParams({ u: params.get("u") ?? "", c: params.get("c") ?? "", t: params.get("t") ?? "" });
        setState("pending");
        try {
            await unsubscribe(query.toString());
            setState("done");
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Không hủy được. Hãy thử lại.");
            setState("error");
        }
    }

    return (
        <div className={AUTH_FORM_CLASS}>
            <h1 className={AUTH_TITLE_CLASS}>Hủy nhận email</h1>
            {state === "done" ? (
                <p className="m-0" role="status">Bạn sẽ không nhận loại email này nữa. Có thể bật lại trong hồ sơ cá nhân.</p>
            ) : (
                <>
                    <p className="m-0">Bạn muốn ngừng nhận email thông báo từ Địa Thế?</p>
                    <button type="button" className={AUTH_BUTTON_CLASS} disabled={state === "pending"} onClick={() => void confirm()}>
                        {state === "pending" ? "Đang xử lý…" : "Hủy nhận email này"}
                    </button>
                    {state === "error" ? <p className="m-0" role="alert">{message}</p> : null}
                </>
            )}
            <div className={AUTH_LINKS_CLASS}>
                <Link href="/">Về trang chủ</Link>
            </div>
        </div>
    );
}
