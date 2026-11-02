"use client";

import { useEffect, type JSX } from "react";

export function InstallGuide({ mac, onClose }: { mac: boolean; onClose: () => void }): JSX.Element {
    useEffect(() => {
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const shareTarget = mac ? "Thêm vào Dock" : "Thêm vào Màn hình chính";
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-4 sm:items-center">
            <div
                role="dialog"
                aria-labelledby="huong-dan-cai"
                className="w-full max-w-md rounded-2xl bg-white p-5 text-charcoal"
            >
                <h2 id="huong-dan-cai" className="m-0 text-lg font-semibold">
                    Thêm Địa Thế vào màn hình chính
                </h2>
                <ol className="mt-4 grid gap-3 pl-5 text-sm">
                    <li>Mở nút Chia sẻ trên trình duyệt.</li>
                    <li>Chọn “{shareTarget}”.</li>
                    <li>Mở Địa Thế từ biểu tượng vừa thêm, rồi vào Thông báo để bật thông báo đẩy.</li>
                </ol>
                <button
                    type="button"
                    className="mt-5 inline-flex min-h-11 items-center rounded-full bg-green px-4 text-sm font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    onClick={onClose}
                >
                    Đã hiểu
                </button>
            </div>
        </div>
    );
}
