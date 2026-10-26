"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
    AUTH_BUTTON_CLASS,
    AUTH_FIELD_CLASS,
    AUTH_FORM_CLASS,
    AUTH_LABEL_CLASS,
    AUTH_LINKS_CLASS,
    AUTH_TITLE_CLASS,
} from "@/app/auth/form-class";
import { AuthApiError, registerAccount } from "@/features/auth/auth.api";

export default function Page() {
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const password = String(form.get("password") || "");
        const confirmPassword = String(form.get("confirmPassword") || "");
        if (password !== confirmPassword) {
            setMessage("Mật khẩu xác nhận chưa khớp.");
            return;
        }

        setPending(true);
        setMessage("");
        try {
            await registerAccount({
                email: String(form.get("email") || ""),
                password,
                displayName: String(form.get("name") || ""),
                acceptTerms: form.get("acceptTerms") === "on",
            });
            setMessage("Đã nhận đăng ký. Hãy mở liên kết xác minh trong email.");
            event.currentTarget.reset();
        } catch (error) {
            setMessage(
                error instanceof AuthApiError
                    ? error.message
                    : "Không đăng ký được.",
            );
        } finally {
            setPending(false);
        }
    }

    return (
        <form noValidate className={AUTH_FORM_CLASS} onSubmit={handleSubmit}>
            <h1 className={AUTH_TITLE_CLASS}>Đăng ký</h1>
            <label className={AUTH_LABEL_CLASS}>
                Họ tên
                <input
                    className={AUTH_FIELD_CLASS}
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                />
            </label>
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
            <label className={AUTH_LABEL_CLASS}>
                Mật khẩu
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
            <label className="flex items-start gap-2 text-sm">
                <input name="acceptTerms" type="checkbox" required />
                <span>
                    Tôi đủ 18 tuổi và đồng ý với{" "}
                    <Link href="/phap-ly">điều khoản</Link>.
                </span>
            </label>
            {message ? <p className="m-0 text-sm">{message}</p> : null}
            <button className={AUTH_BUTTON_CLASS} type="submit" disabled={pending}>
                Đăng ký
            </button>
            <nav className={AUTH_LINKS_CLASS}>
                <a href="/auth/login">Đăng nhập</a>
            </nav>
        </form>
    );
}
