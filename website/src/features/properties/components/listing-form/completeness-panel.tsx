"use client";

import { Check, Circle } from "lucide-react";
import type { JSX } from "react";

import type { CompletenessItem } from "@/features/properties/listing-form";

/** Bảng "chất lượng tin" kiểu trung tâm bán hàng: cho người đăng thấy còn thiếu gì. */
export default function CompletenessPanel({ items, vi }: { items: CompletenessItem[]; vi: boolean }): JSX.Element {
    const done = items.filter((item) => item.done).length;
    const percent = Math.round((done / items.length) * 100);
    return (
        <aside aria-label={vi ? "Độ hoàn thiện của tin" : "Listing completeness"} className="rounded-2xl border border-charcoal/15 bg-white p-5">
            <h2 className="m-0 text-base font-semibold">{vi ? "Độ hoàn thiện" : "Completeness"}</h2>
            <div className="mt-3 flex items-center gap-3">
                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={vi ? "Độ hoàn thiện" : "Completeness"} className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal/10">
                    <div className="h-full rounded-full bg-green transition-[width]" style={{ width: `${percent}%` }} />
                </div>
                <span className="text-sm font-semibold">{percent}%</span>
            </div>
            <p className="mt-2 mb-0 text-xs text-charcoal/70">
                {vi ? "Tin đầy đủ thông tin thường được xem nhiều hơn." : "Complete listings usually get more views."}
            </p>
            <ul className="m-0 mt-4 grid list-none gap-2 p-0">
                {items.map((item) => (
                    <li key={item.key} className="flex items-center gap-2 text-sm">
                        {item.done ? (
                            <Check size={16} aria-hidden="true" className="shrink-0 text-green" />
                        ) : (
                            <Circle size={16} aria-hidden="true" className="shrink-0 text-charcoal/30" />
                        )}
                        <span className={item.done ? "" : "text-charcoal/70"}>{vi ? item.vi : item.en}</span>
                        <span className="sr-only">{item.done ? (vi ? "(đã xong)" : "(done)") : vi ? "(chưa xong)" : "(not done)"}</span>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
