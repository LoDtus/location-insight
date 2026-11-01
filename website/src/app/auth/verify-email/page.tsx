"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AUTH_FORM_CLASS, AUTH_LINKS_CLASS, AUTH_TITLE_CLASS } from "@/app/auth/form-class";
import { AuthApiError, apiRequest } from "@/features/auth/auth.api";

type State = "loading" | "ok" | "error";

export default function Page() {
    const [state, setState] = useState<State>("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const token = new URLSearchParams(window.location.search).get("token") ?? "";
        let cancelled = false;
        const run = async (): Promise<void> => {
            try {
                if (!token) throw new AuthApiError("Thiếu mã xác minh.", 400);
                await apiRequest("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
                if (!cancelled) setState("ok");
            } catch (error) {
                if (cancelled) return;
                setMessage(error instanceof AuthApiError ? error.message : "Không xác minh được email.");
                setState("error");
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className={AUTH_FORM_CLASS} role="status" aria-live="polite">
            <h1 className={AUTH_TITLE_CLASS}>Xác minh email</h1>
            {state === "loading" ? <p className="m-0">Đang xác minh…</p> : null}
            {state === "ok" ? <p className="m-0">Email của bạn đã được xác minh. Bạn có thể đăng nhập.</p> : null}
            {state === "error" ? <p className="m-0">{message || "Liên kết không hợp lệ hoặc đã hết hạn."}</p> : null}
            <div className={AUTH_LINKS_CLASS}>
                <Link href="/auth/login">Đăng nhập</Link>
            </div>
        </div>
    );
}
