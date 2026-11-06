"use client";

import { Loader2, RotateCcw, Scale, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";

import WeightPicker from "@/features/map/components/weight-picker";
import { CRITERION_ICON } from "@/features/map/criteria-icons";
import { useCriterionWeights } from "@/features/map/hooks/use-criterion-weights";
import type { CriterionWeight } from "@/features/map/map.types";
import { showToast } from "@/shared/components/toast/toast-store";

/**
 * Modal quản lý trọng số của 19 tiêu chí: mỗi tiêu chí một dãy 0–5, tiêu chí đã đổi có nền vàng nhạt, chip "Đã đổi"
 * và nút về mặc định; "Đặt lại tất cả" ở chân modal. Đổi là lưu ngay, điểm của mọi địa điểm tính lại theo đó.
 */
export default function MapWeightsDialog({ onClose }: { onClose: () => void }): JSX.Element | null {
    const weights = useCriterionWeights();
    const [busy, setBusy] = useState<string | null>(null);
    const [onlyChanged, setOnlyChanged] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const view = weights.state.view;

    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    });

    // Chỉ chạy khi mở/đóng: đưa focus vào modal, Esc để đóng, trả focus khi đóng.
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        dialogRef.current?.focus();
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") closeRef.current();
        }
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            previous?.focus();
        };
    }, []);

    async function run(key: string, action: () => Promise<string | null>, done?: string): Promise<void> {
        setBusy(key);
        const message = await action();
        setBusy(null);
        if (message) showToast({ title: "Chưa lưu được trọng số", description: message, tone: "error" });
        else if (done) showToast({ title: done, tone: "info" });
    }

    const groups: Array<{ label: string; items: CriterionWeight[] }> = [];
    for (const item of view?.criteria ?? []) {
        if (onlyChanged && !item.custom) continue;
        const last = groups[groups.length - 1];
        if (last && last.label === item.groupLabel) last.items.push(item);
        else groups.push({ label: item.groupLabel, items: [item] });
    }
    const changed = weights.changed;

    if (typeof document === "undefined") return null;
    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-charcoal/40 p-0 sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="tieu-de-trong-so"
                tabIndex={-1}
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_24px_64px_rgba(16,17,17,0.28)] outline-none sm:rounded-2xl"
            >
                <header className="flex items-start gap-3 border-b border-charcoal/10 py-3 pr-2 pl-5">
                    <span aria-hidden className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-green/10 text-green">
                        <Scale size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 id="tieu-de-trong-so" className="m-0 text-base font-semibold">
                            Trọng số tiêu chí
                        </h2>
                        <p className="m-0 mt-0.5 text-xs text-charcoal/60">
                            Mức quan trọng của từng tiêu chí khi tính điểm tổng: 0 là không tính, 5 là quan trọng nhất. Áp dụng cho mọi địa
                            điểm bạn đánh giá; không tốn lượt đánh giá.
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label="Đóng"
                        onClick={onClose}
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-transparent text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-green"
                    >
                        <X size={18} aria-hidden />
                    </button>
                </header>

                <div className="flex items-center justify-between gap-3 border-b border-charcoal/10 px-5 py-2">
                    <p className="m-0 text-xs text-charcoal/70" aria-live="polite">
                        {changed > 0 ? (
                            <>
                                <span className="font-semibold text-charcoal">{changed}</span> tiêu chí khác mặc định
                            </>
                        ) : (
                            "Đang dùng trọng số mặc định của ứng dụng"
                        )}
                    </p>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-charcoal/75">
                        <input
                            type="checkbox"
                            checked={onlyChanged}
                            disabled={changed === 0}
                            onChange={(event) => setOnlyChanged(event.target.checked)}
                            className="size-4 accent-green"
                        />
                        Chỉ hiện tiêu chí đã đổi
                    </label>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:thin]">
                    {!view && weights.state.status !== "error" ? (
                        <p role="status" className="m-0 flex items-center gap-2 px-2 py-4 text-sm text-charcoal/70">
                            <Loader2 size={16} className="animate-spin" aria-hidden /> Đang tải trọng số…
                        </p>
                    ) : null}
                    {weights.state.status === "error" ? (
                        <div role="alert" className="grid justify-items-start gap-2 px-2 py-4 text-sm">
                            <p className="m-0 text-red-700">{weights.state.message}</p>
                            <button type="button" onClick={() => void weights.reload()} className="rounded-lg bg-charcoal/5 px-3 py-1.5 font-semibold hover:bg-charcoal/10">
                                Thử lại
                            </button>
                        </div>
                    ) : null}
                    {view && groups.length === 0 ? <p className="m-0 px-2 py-4 text-sm text-charcoal/60">Chưa đổi tiêu chí nào.</p> : null}
                    {groups.map((group) => (
                        <section key={group.label} aria-label={group.label} className="mb-2">
                            <h3 className="m-0 px-2 pt-2 pb-1 text-xs font-semibold text-charcoal/60">{group.label}</h3>
                            <ul className="m-0 list-none p-0">
                                {group.items.map((item, index) => {
                                    const Icon = CRITERION_ICON[item.id];
                                    return (
                                        <Fragment key={item.id}>
                                            {index > 0 ? (
                                                <li role="presentation" aria-hidden className="px-2 py-0.5">
                                                    <div className="h-px bg-charcoal/[0.07]" />
                                                </li>
                                            ) : null}
                                            <li className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2 ${item.custom ? "bg-gold/10" : ""}`}>
                                                <span
                                                    aria-hidden
                                                    className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md ${item.weight === 0 ? "bg-charcoal/5 text-charcoal/35" : "bg-green/10 text-green"}`}
                                                >
                                                    <Icon size={16} strokeWidth={1.8} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                                                        <span className={item.weight === 0 ? "text-charcoal/45" : ""}>{item.label}</span>
                                                        {item.custom ? (
                                                            <span className="rounded bg-gold/30 px-1.5 py-px text-[11px] font-semibold text-charcoal/80">Đã đổi</span>
                                                        ) : null}
                                                    </span>
                                                    <span className="block text-xs text-charcoal/55">
                                                        Mặc định {item.defaultWeight}
                                                        {item.custom ? ` · đang dùng ${item.weight}` : ""}
                                                    </span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <WeightPicker
                                                        value={item.weight}
                                                        defaultValue={item.defaultWeight}
                                                        label={item.label}
                                                        onChange={(weight) => {
                                                            if (weight !== item.weight) void run(item.id, () => weights.set(item.id, weight));
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        aria-label={`Về mặc định: ${item.label}`}
                                                        title={`Về mặc định (${item.defaultWeight})`}
                                                        disabled={!item.custom}
                                                        onClick={() => void run(item.id, () => weights.reset(item.id))}
                                                        className="inline-flex size-8 items-center justify-center rounded-md bg-transparent text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal disabled:invisible"
                                                    >
                                                        <RotateCcw size={14} aria-hidden />
                                                    </button>
                                                </span>
                                            </li>
                                        </Fragment>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>

                <footer className="flex items-center gap-2 border-t border-charcoal/10 px-5 py-3">
                    <p className="m-0 hidden text-xs text-charcoal/55 sm:block">Đổi là lưu ngay.</p>
                    <button
                        type="button"
                        disabled={changed === 0}
                        onClick={() => {
                            setOnlyChanged(false);
                            void run("all", () => weights.resetAll(), "Đã đặt lại trọng số mặc định");
                        }}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-transparent px-3 py-2 text-sm font-semibold text-charcoal/75 hover:bg-charcoal/5 hover:text-charcoal disabled:opacity-40"
                    >
                        {busy === "all" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <RotateCcw size={15} aria-hidden />} Đặt lại tất cả
                    </button>
                    <button type="button" onClick={onClose} className="rounded-lg bg-green px-4 py-2 text-sm font-semibold text-cream hover:bg-green/90">
                        Xong
                    </button>
                </footer>
            </div>
        </div>,
        document.body,
    );
}
