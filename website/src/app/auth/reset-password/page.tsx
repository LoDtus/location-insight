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
            <h1 className={AUTH_TITLE_CLASS}>Đặt lại mật khẩu</h1>
            <label className={AUTH_LABEL_CLASS}>
                Mật khẩu mới
                <input
                    className={AUTH_FIELD_CLASS}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                />
            </label>
            <label className={AUTH_LABEL_CLASS}>
                Xác nhận mật khẩu
                <input
                    className={AUTH_FIELD_CLASS}
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                />
            </label>
            <button className={AUTH_BUTTON_CLASS} type="submit">
                Đặt lại mật khẩu
            </button>
            <nav className={AUTH_LINKS_CLASS}>
                <a href="/auth/login">Đăng nhập</a>
            </nav>
        </form>
    );
}
