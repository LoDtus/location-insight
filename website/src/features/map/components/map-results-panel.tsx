"use client";

import { Loader2, MapPin } from "lucide-react";
import type { JSX } from "react";

import MapPanel from "@/features/map/components/map-panel";
import { formatDistance, formatRadius } from "@/features/map/map.geo";
import type { PinResult } from "@/features/map/map.types";

export type ResultsState =
    | { status: "loading"; text: string; radiusM: number }
    | { status: "ready"; text: string; radiusM: number; items: PinResult[] }
    | { status: "error"; text: string; radiusM: number; message: string };

/** Danh sách kết quả khi tìm theo loại hình; số thứ tự khớp số trên ghim kết quả. */
export default function MapResultsPanel({
    state,
    onOpen,
    onClose,
}: {
    state: ResultsState;
    onOpen: (item: PinResult) => void;
    onClose: () => void;
}): JSX.Element {
    return (
        <MapPanel title={`Kết quả “${state.text}”`} titleId="tieu-de-ket-qua" onClose={onClose}>
            {state.status === "loading" ? (
                <p role="status" className="m-0 flex items-center gap-2 text-sm text-charcoal/70">
                    <Loader2 size={16} className="animate-spin" aria-hidden /> Đang tìm trong {formatRadius(state.radiusM)}…
                </p>
            ) : null}
            {state.status === "error" ? (
                <p role="alert" className="m-0 text-sm text-red-700">
                    {state.message}
                </p>
            ) : null}
            {state.status === "ready" ? (
                state.items.length === 0 ? (
                    <p className="m-0 text-sm text-charcoal/70">
                        Không có kết quả trong {formatRadius(state.radiusM)}. Thử tăng phạm vi tìm kiếm hoặc đổi từ khóa.
                    </p>
                ) : (
                    <>
                        <p className="m-0 text-xs text-charcoal/60">
                            {state.items.length} kết quả liên quan nhất trong {formatRadius(state.radiusM)}, đã ghim trên bản đồ.
                        </p>
                        <ol className="m-0 list-none p-0">
                            {state.items.map((item, index) => (
                                <li key={item.refId}>
                                    {index > 0 ? <div role="presentation" className="my-0.5 h-px bg-charcoal/10" /> : null}
                                    <button
                                        type="button"
                                        onClick={() => onOpen(item)}
                                        className="flex w-full items-start gap-2.5 rounded-md bg-transparent px-1 py-2 text-left hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
                                    >
                                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#c0392b] text-[10px] font-bold text-white tabular-nums">
                                            {index + 1}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold">{item.name}</span>
                                            <span className="block text-xs text-charcoal/60">{item.address || item.display}</span>
                                        </span>
                                        {item.distanceM != null ? (
                                            <span className="shrink-0 text-[11px] text-charcoal/55 tabular-nums">{formatDistance(item.distanceM)}</span>
                                        ) : (
                                            <MapPin size={14} className="text-charcoal/40" aria-hidden />
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ol>
                    </>
                )
            ) : null}
        </MapPanel>
    );
}
