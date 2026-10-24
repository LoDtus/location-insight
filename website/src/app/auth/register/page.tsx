"use client";

import type { FormEvent } from "react";

export default function Page() {
    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
    }

    return (
        <form noValidate onSubmit={handleSubmit}>
            <h1>Đăng ký</h1>
            <label>
                Họ tên
                <input name="name" type="text" autoComplete="name" />
            </label>
            <label>
                Email
                <input name="email" type="email" autoComplete="email" />
            </label>
            <label>
                Mật khẩu
                <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                />
            </label>
            <label>
                Xác nhận mật khẩu
                <input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                />
            </label>
            <button type="submit">Đăng ký</button>
            <a href="/auth/login">Đăng nhập</a>
        </form>
    );
}
