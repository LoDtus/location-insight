"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
    AUTH_BUTTON_CLASS,
    AUTH_FIELD_CLASS,
    AUTH_FORM_CLASS,
    AUTH_LABEL_CLASS,
    AUTH_LINKS_CLASS,
    AUTH_TITLE_CLASS,
} from "@/app/auth/form-class";
import { AuthApiError, login } from "@/features/auth/auth.api";
import { destinationFor } from "@/features/auth/role-home";
import { useAuth } from "@/features/auth/use-auth";

export default function Page() {
    const router = useRouter();
    const auth = useAuth();
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);
    const [remember, setRemember] = useState(true);

    useEffect(() => {
        if (auth.status !== "authenticated" || !auth.user) return;
        const next = new URLSearchParams(window.location.search).get("next") || "";
        router.replace(destinationFor(auth.user.role, next));
    }, [auth.status, auth.user, router]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage("");
        try {
            const session = await login(
                String(form.get("email") || ""),
                String(form.get("password") || ""),
                remember,
            );
            const next = new URLSearchParams(window.location.search).get("next") || "";
            router.push(destinationFor(session.user.role, next));
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

    if (auth.status !== "anonymous") {
        return (
            <section className={AUTH_FORM_CLASS}>
                <h1 className={AUTH_TITLE_CLASS}>Đăng nhập</h1>
                <p className="m-0 text-sm">Đang kiểm tra phiên…</p>
            </section>
        );
    }

    return (
        <form noValidate className={AUTH_FORM_CLASS} onSubmit={handleSubmit}>
            <h1 className={AUTH_TITLE_CLASS}>Đăng nhập</h1>
            <a
                className={`${AUTH_BUTTON_CLASS} block text-center no-underline`}
                href="/api/v1/auth/google/start?redirectTo=/app/properties"
            >
                Đăng nhập với Google
            </a>
            <label className={AUTH_LABEL_CLASS}>
                Email hoặc tên đăng nhập
                <input
                    className={AUTH_FIELD_CLASS}
                    name="email"
                    type="text"
                    autoComplete="username"
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
            <label className="m-0 flex items-start gap-2 text-sm leading-snug">
                <input
                    className="mt-0.5"
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                />
                <span>
                    Duy trì đăng nhập
                    <span className="mt-1 block">
                        Giữ phiên trên thiết bị này sau khi đóng trình duyệt. Bỏ chọn thì phiên kết thúc khi đóng trình duyệt. Đăng xuất vẫn chỉ áp dụng cho từng thiết bị.
                    </span>
                </span>
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
