"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

export default function Page() {
    const router = useRouter();

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        router.push("/app/map");
    }

    return (
        <form noValidate onSubmit={handleSubmit}>
            <h1>Đăng nhập</h1>
            <label>
                Email
                <input name="email" type="email" autoComplete="email" />
            </label>
            <label>
                Mật khẩu
                <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                />
            </label>
            <button type="submit">Đăng nhập</button>
            <a href="/auth/register">Đăng ký</a>
            <a href="/auth/fogot-password">Quên mật khẩu</a>
        </form>
    );
}
