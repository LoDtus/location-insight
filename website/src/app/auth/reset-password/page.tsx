"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
    AUTH_BUTTON_CLASS,
    AUTH_FIELD_CLASS,
    AUTH_FORM_CLASS,
    AUTH_LABEL_CLASS,
    AUTH_LINKS_CLASS,
    AUTH_TITLE_CLASS,
} from "@/app/auth/form-class";
import { AuthApiError, resetPassword } from "@/features/auth/auth.api";

export default function Page() {
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const token = new URLSearchParams(window.location.search).get("token") ?? "";
        const form = new FormData(event.currentTarget);
        const password = String(form.get("password") || "");
        const confirmPassword = String(form.get("confirmPassword") || "");
        if (password !== confirmPassword) {
            setMessage("Mật khẩu xác nhận chưa khớp.");
            return;
        }
        if (!token) {
            setMessage("Thiếu token đặt lại mật khẩu.");
            return;
        }

        setPending(true);
        setMessage("");
        try {
            await resetPassword(token, password);
            router.push("/auth/login");
        } catch (error) {
            setMessage(
                error instanceof AuthApiError
                    ? error.message
                    : "Không đặt lại được mật khẩu.",
            );
        } finally {
            setPending(false);
        }
    }

    return (
        <form noValidate className={AUTH_FORM_CLASS} onSubmit={handleSubmit}>
            <h1 className={AUTH_TITLE_CLASS}>Đặt lại mật khẩu</h1>
            <label className={AUTH_LABEL_CLASS}>
                Mật khẩu mới
                <input
                    className={AUTH_FIELD_CLASS}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    required
                />
            </label>
            <label className={AUTH_LABEL_CLASS}>
                Xác nhận mật khẩu
                <input
                    className={AUTH_FIELD_CLASS}
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    required
                />
            </label>
            {message ? <p className="m-0 text-sm">{message}</p> : null}
            <button className={AUTH_BUTTON_CLASS} type="submit" disabled={pending}>
                Đặt lại mật khẩu
            </button>
            <nav className={AUTH_LINKS_CLASS}>
                <a href="/auth/login">Đăng nhập</a>
            </nav>
        </form>
    );
}
