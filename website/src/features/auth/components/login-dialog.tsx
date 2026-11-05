"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type JSX } from "react";

import { AuthApiError, login } from "@/features/auth/auth.api";

/**
 * Hộp đăng nhập ngay trên trang (ví dụ khi khách bấm "Lưu" tin): đăng nhập xong ở lại trang hiện tại.
 * Dùng <dialog> gốc nên có sẵn khóa nền, Esc để đóng và trả tiêu điểm.
 */
export default function LoginDialog({
    open,
    reason,
    onClose,
    onSignedIn,
}: {
    open: boolean;
    /** Một câu giải thích vì sao cần đăng nhập. */
    reason: string;
    onClose: () => void;
    onSignedIn?: () => void;
}): JSX.Element {
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState("");
    const [next, setNext] = useState("/");

    useEffect(() => {
        const node = dialog.current;
        if (!node) return;
        if (open && !node.open) {
            setNext(`${window.location.pathname}${window.location.search}`);
            node.showModal();
        }
        if (!open && node.open) node.close();
    }, [open]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage("");
        try {
            await login(String(form.get("email") || ""), String(form.get("password") || ""), true);
            onSignedIn?.();
            onClose();
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Không đăng nhập được.");
        } finally {
            setPending(false);
        }
    }

    const field =
        "m-0 box-border min-h-11 w-full rounded-md border border-charcoal/25 bg-white px-3 text-base text-charcoal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green";

    return (
        <dialog
            ref={dialog}
            aria-labelledby={titleId}
            onClose={onClose}
            onClick={(event) => {
                // Bấm ra vùng tối bên ngoài thì đóng.
                if (event.target === event.currentTarget) onClose();
            }}
            className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-lg border border-charcoal/15 bg-white p-0 text-charcoal shadow-[0_16px_48px_rgba(16,17,17,0.25)] backdrop:bg-charcoal/60"
        >
            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id={titleId} className="m-0 text-xl font-semibold">
                            Đăng nhập
                        </h2>
                        <p className="m-0 mt-1 text-sm text-charcoal/70">{reason}</p>
                    </div>
                    <button
                        type="button"
                        aria-label="Đóng"
                        onClick={onClose}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-charcoal/20 bg-white hover:bg-charcoal/5"
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>
                <a
                    href={`/api/v1/auth/google/start?redirectTo=${encodeURIComponent(next)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-charcoal/25 bg-white px-4 text-sm font-semibold text-charcoal no-underline hover:bg-charcoal/5"
                >
                    Đăng nhập với Google
                </a>
                <label className="flex flex-col gap-1 text-sm font-semibold">
                    Email hoặc tên đăng nhập
                    <input name="email" type="text" autoComplete="username" required className={field} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">
                    Mật khẩu
                    <input name="password" type="password" autoComplete="current-password" required className={field} />
                </label>
                {message ? (
                    <p role="alert" className="m-0 text-sm text-red-700">
                        {message}
                    </p>
                ) : null}
                <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-green px-4 text-sm font-semibold text-cream hover:bg-green/90 disabled:cursor-wait disabled:opacity-70"
                >
                    {pending ? "Đang đăng nhập…" : "Đăng nhập"}
                </button>
                <p className="m-0 flex flex-wrap gap-x-4 text-sm">
                    <Link href="/auth/register" className="font-semibold text-green">
                        Tạo tài khoản
                    </Link>
                    <Link href="/auth/fogot-password" className="text-charcoal/70">
                        Quên mật khẩu
                    </Link>
                </p>
            </form>
        </dialog>
    );
}
