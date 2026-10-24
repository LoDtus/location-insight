"use client";

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
    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
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
                />
            </label>
            <button className={AUTH_BUTTON_CLASS} type="submit">
                Gửi liên kết
            </button>
            <nav className={AUTH_LINKS_CLASS}>
                <a href="/auth/login">Đăng nhập</a>
            </nav>
        </form>
    );
}
