"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import {
    AUTH_BUTTON_CLASS,
    AUTH_FIELD_CLASS,
    AUTH_FORM_CLASS,
    AUTH_LABEL_CLASS,
    AUTH_LINKS_CLASS,
    AUTH_TITLE_CLASS,
} from "@/app/auth/form-class";

export default function Page() {
    const router = useRouter();

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        router.push("/app/map");
    }

    return (
        <form noValidate className={AUTH_FORM_CLASS} onSubmit={handleSubmit}>
            <h1 className={AUTH_TITLE_CLASS}>Đăng nhập</h1>
            <label className={AUTH_LABEL_CLASS}>
                Email
                <input
                    className={AUTH_FIELD_CLASS}
                    name="email"
                    type="email"
                    autoComplete="email"
                />
            </label>
            <label className={AUTH_LABEL_CLASS}>
                Mật khẩu
                <input
                    className={AUTH_FIELD_CLASS}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                />
            </label>
            <button className={AUTH_BUTTON_CLASS} type="submit">
                Đăng nhập
            </button>
            <nav className={AUTH_LINKS_CLASS}>
                <a href="/auth/register">Đăng ký</a>
                <a href="/auth/fogot-password">Quên mật khẩu</a>
            </nav>
        </form>
    );
}
