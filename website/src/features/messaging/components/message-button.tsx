"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type JSX } from "react";

import { errorText, startConversation } from "../messaging.actions";

/** Nút "Nhắn tin" ở hồ sơ công khai: tìm hoặc tạo hội thoại rồi mở. */
export function MessageButton({ userId, root }: { userId: string; root: string }): JSX.Element {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");

    async function open(): Promise<void> {
        setPending(true);
        setError("");
        try {
            const id = await startConversation(userId);
            router.push(`${root}/messages/${id}`);
        } catch (failure) {
            setError(errorText(failure, "Chưa nhắn tin được."));
            setPending(false);
        }
    }

    return (
        <div>
            <button
                type="button"
                className="inline-flex min-h-11 w-auto items-center gap-2 border border-current bg-transparent px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-60"
                disabled={pending}
                onClick={() => void open()}
            >
                <MessageCircle className="size-4" aria-hidden="true" />
                {pending ? "Đang mở…" : "Nhắn tin"}
            </button>
            {error ? (
                <p role="alert" className="mt-2 mb-0 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
