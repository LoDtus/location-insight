"use client";

import type { FormEvent } from "react";

export default function Page() {
    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
    }

    return (
        <form noValidate onSubmit={handleSubmit}>
            <h1>Quên mật khẩu</h1>
            <label>
                Email
                <input name="email" type="email" autoComplete="email" />
            </label>
            <button type="submit">Gửi liên kết</button>
            <nav>
                <a href="/auth/login">Đăng nhập</a>
            </nav>
        </form>
    );
}
