"use client";

import { useState, type FormEvent } from "react";

import {
    AUTH_BUTTON_CLASS,
    AUTH_FIELD_CLASS,
    AUTH_FORM_CLASS,
    AUTH_LABEL_CLASS,
    AUTH_LINKS_CLASS,
    AUTH_TITLE_CLASS,
} from "@/app/auth/form-class";
import { AuthApiError, forgotPassword } from "@/features/auth/auth.api";

export default function Page() {
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        try {
            await forgotPassword(String(form.get("email") || ""));
            setMessage("Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.");
        } catch (error) {
            setMessage(
                error instanceof AuthApiError
                    ? error.message
                    : "Không gửi được yêu cầu.",
            );
        } finally {
            setPending(false);
        }
    }

    return (
        <form noValidate className={AUTH_FORM_CLASS} onSubmit={handleSubmit}>
            <h1 className={AUTH_TITLE_CLASS}>Quên mật khẩu</h1>
            <label className={AUTH_LABEL_CLASS}>
                Email
                <input
                    className={AUTH_FIELD_CLASS}
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                />
            </label>
            {message ? <p className="m-0 text-sm">{message}</p> : null}
            <button className={AUTH_BUTTON_CLASS} type="submit" disabled={pending}>
                Gửi liên kết
            </button>
            <nav className={AUTH_LINKS_CLASS}>
                <a href="/auth/login">Đăng nhập</a>
            </nav>
        </form>
    );
}
