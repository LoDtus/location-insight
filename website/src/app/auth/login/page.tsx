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
import { AuthApiError, login } from "@/features/auth/auth.api";

export default function Page() {
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage("");
        try {
            await login(String(form.get("email") || ""), String(form.get("password") || ""));
            const next = new URLSearchParams(window.location.search).get("next") || "";
            const safe =
                (next.startsWith("/app/") || next.startsWith("/admin/")) &&
                !next.startsWith("//") &&
                !next.includes("\\");
            router.push(safe ? next : "/app/map");
        } catch (error) {
            setMessage(
                error instanceof AuthApiError
                    ? error.message
                    : "Không đăng nhập được.",
            );
        } finally {
            setPending(false);
        }
    }

    return (
        <form noValidate className={AUTH_FORM_CLASS} onSubmit={handleSubmit}>
            <h1 className={AUTH_TITLE_CLASS}>Đăng nhập</h1>
            <a
                className={`${AUTH_BUTTON_CLASS} block text-center no-underline`}
                href="/api/v1/auth/google/start?redirectTo=/app/map"
            >
                Đăng nhập với Google
            </a>
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
                    autoComplete="current-password"
                    required
                />
            </label>
            {message ? <p className="m-0 text-sm">{message}</p> : null}
            <button className={AUTH_BUTTON_CLASS} type="submit" disabled={pending}>
                Đăng nhập
            </button>
            <nav className={AUTH_LINKS_CLASS}>
                <a href="/auth/register">Đăng ký</a>
                <a href="/auth/fogot-password">Quên mật khẩu</a>
            </nav>
        </form>
    );
}
