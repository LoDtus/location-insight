"use client";

import { SquarePen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type JSX } from "react";

import { FeedbackThread } from "./feedback-detail";
import { FeedbackForm } from "./feedback-form";
import { FeedbackList } from "./feedback-list";

/** Hai cột: danh sách góp ý và khung bên phải (form gửi mới, hoặc chi tiết). Admin chỉ có danh sách + chi tiết. */
export function FeedbackWorkspace({
    mode,
    selectedId = null,
}: {
    mode: "user" | "admin";
    selectedId?: string | null;
}): JSX.Element {
    const router = useRouter();
    const root = mode === "admin" ? "/admin" : "/app";
    const [reloadKey, setReloadKey] = useState(0);
    const refresh = (): void => setReloadKey((current) => current + 1);

    return (
        <main className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-white md:flex-row md:overflow-visible" aria-label={mode === "admin" ? "Quản lý góp ý" : "Góp ý"}>
            <aside
                className={`${selectedId ? "hidden md:flex" : "flex"} order-2 min-h-0 w-full flex-col border-t border-charcoal/10 md:order-1 md:h-full md:w-[360px] md:shrink-0 md:border-t-0 md:border-r`}
                aria-label="Danh sách góp ý"
            >
                <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
                    <h2 className="m-0 text-xl font-semibold">{mode === "admin" ? "Góp ý của người dùng" : "Góp ý của bạn"}</h2>
                    {mode === "user" ? (
                        <Link
                            href="/app/feedback"
                            className="inline-flex size-11 items-center justify-center rounded-full hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
                            aria-label="Gửi góp ý mới"
                        >
                            <SquarePen className="size-5" aria-hidden="true" />
                        </Link>
                    ) : null}
                </div>
                <FeedbackList mode={mode} root={root} activeId={selectedId} reloadKey={reloadKey} />
            </aside>
            <section className={`${selectedId || mode === "user" ? "flex" : "hidden md:flex"} order-1 min-h-0 min-w-0 flex-1 flex-col md:order-2 md:h-full md:overflow-y-auto`}>
                {selectedId ? (
                    <FeedbackThread key={selectedId} id={selectedId} mode={mode} backHref={`${root}/feedback`} onChanged={refresh} />
                ) : mode === "user" ? (
                    <FeedbackForm
                        onCreated={(created) => {
                            refresh();
                            router.push(`/app/feedback/${created.id}`);
                        }}
                    />
                ) : (
                    <p className="m-0 p-8 text-center text-sm text-charcoal/70">Chọn một góp ý ở bên trái để xem và trả lời.</p>
                )}
            </section>
        </main>
    );
}
