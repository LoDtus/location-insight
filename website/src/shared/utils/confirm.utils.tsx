"use client";

import { useEffect, useRef, type JSX } from "react";
import { createRoot } from "react-dom/client";

interface GetConfirmModalParams {
    title?: string;
    content?: string;
    okText?: string;
    cancelText?: string;
}

export function getConfirmModal({
    title = "Xác nhận",
    content = "Bạn có chắc muốn tiếp tục?",
    okText = "Đồng ý",
    cancelText = "Hủy",
}: GetConfirmModalParams): Promise<boolean> {
    return new Promise((resolve) => {
        const host = document.createElement("div");
        document.body.appendChild(host);
        const root = createRoot(host);
        let settled = false;
        const finish = (value: boolean): void => {
            if (settled) return;
            settled = true;
            root.unmount();
            host.remove();
            resolve(value);
        };
        root.render(
            <ConfirmDialog title={title} content={content} okText={okText} cancelText={cancelText} onOk={() => finish(true)} onCancel={() => finish(false)} />,
        );
    });
}

function ConfirmDialog({
    title,
    content,
    okText,
    cancelText,
    onOk,
    onCancel,
}: Required<GetConfirmModalParams> & {
    onOk: () => void;
    onCancel: () => void;
}): JSX.Element {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        dialog.showModal();
        const onCancelEvent = (event: Event): void => {
            event.preventDefault();
            onCancel();
        };
        dialog.addEventListener("cancel", onCancelEvent);
        return () => dialog.removeEventListener("cancel", onCancelEvent);
    }, [onCancel]);

    return (
        <dialog
            ref={dialogRef}
            className="w-[min(28rem,calc(100%-2rem))] border border-charcoal bg-white p-0 text-charcoal backdrop:bg-charcoal/40"
            aria-labelledby="confirm-title"
        >
            <form method="dialog" className="flex flex-col gap-4 p-5" onSubmit={(event) => event.preventDefault()}>
                <h2 id="confirm-title" className="m-0 text-lg font-semibold">
                    {title}
                </h2>
                <p className="m-0 text-sm leading-relaxed">{content}</p>
                <div className="flex justify-end gap-2">
                    <button type="button" className="inline-flex min-h-11 items-center border border-current px-4" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button type="button" className="inline-flex min-h-11 items-center bg-green px-4 text-cream" onClick={onOk}>
                        {okText}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
