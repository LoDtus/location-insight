"use client";

import type { FormEvent } from "react";

export default function Page() {
    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
    }

    return (
        <form noValidate onSubmit={handleSubmit}>
            <h1>Đặt lại mật khẩu</h1>
            <label>
                Mật khẩu mới
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
            <button type="submit">Đặt lại mật khẩu</button>
            <a href="/auth/login">Đăng nhập</a>
        </form>
    );
}
