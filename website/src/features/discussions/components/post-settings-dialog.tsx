"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";

import { PostOptionsForm } from "@/features/discussions/components/post-composer";
import type { DiscussionPost, PostSettings } from "@/features/discussions/discussions.api";

/** Sửa cài đặt bài đã đăng (ai xem, trả lời, ẩn lượt thích/xem, chia sẻ). */
export function PostSettingsDialog({
    post,
    onSave,
    onClose,
}: {
    post: DiscussionPost;
    /** Trả về thông báo lỗi hoặc null. */
    onSave: (settings: PostSettings) => Promise<string | null>;
    onClose: () => void;
}): JSX.Element | null {
    const ref = useRef<HTMLDialogElement>(null);
    const [settings, setSettings] = useState<PostSettings>({
        visibility: post.visibility,
        repliesAllowed: post.repliesAllowed,
        hideLikeCount: post.hideLikeCount,
        hideViewCount: post.hideViewCount,
        allowShare: post.allowShare,
    });
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    });

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        dialog.showModal();
        const onCancel = (event: Event): void => {
            event.preventDefault();
            closeRef.current();
        };
        dialog.addEventListener("cancel", onCancel);
        return () => dialog.removeEventListener("cancel", onCancel);
    }, []);

    if (typeof document === "undefined") return null;
    return createPortal(
        <dialog
            ref={ref}
            aria-labelledby="post-settings-title"
            className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border-0 bg-white p-0 text-charcoal shadow-[0_24px_64px_rgba(16,17,17,0.28)] backdrop:bg-charcoal/40"
        >
            <div className="grid gap-2 p-4">
                <h2 id="post-settings-title" className="m-0 px-1 text-base font-semibold">
                    Cài đặt bài viết
                </h2>
                <PostOptionsForm settings={settings} onChange={setSettings} />
                {error ? (
                    <p role="alert" className="m-0 px-1 text-sm text-red-700">
                        {error}
                    </p>
                ) : null}
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="min-h-10 rounded-xl px-4 text-sm font-semibold ring-1 ring-charcoal/15 hover:bg-charcoal/5">
                        Hủy
                    </button>
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                            setPending(true);
                            setError(null);
                            void onSave(settings).then((message) => {
                                setPending(false);
                                if (message) setError(message);
                            });
                        }}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-charcoal px-4 text-sm font-semibold text-white hover:bg-charcoal/90 disabled:opacity-50"
                    >
                        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} Lưu
                    </button>
                </div>
            </div>
        </dialog>,
        document.body,
    );
}
