"use client";

import { Bookmark, Loader2, MapPin, Trash2 } from "lucide-react";
import type { JSX } from "react";

import MapPanel from "@/features/map/components/map-panel";
import ScoreRing, { formatScore } from "@/features/map/components/score-ring";
import { PLACE_KIND_LABEL } from "@/features/map/map-place-match";
import type { SavedState } from "@/features/map/hooks/use-saved-places";
import type { SavedPlace } from "@/features/map/map.types";

/** Danh sách địa điểm đã lưu: bấm để mở trên bản đồ, nút thùng rác để bỏ lưu. */
export default function MapSavedPanel({
    state,
    busyKey,
    onOpen,
    onRemove,
    onClose,
}: {
    state: SavedState;
    busyKey: string | null;
    onOpen: (item: SavedPlace) => void;
    onRemove: (item: SavedPlace) => void;
    onClose: () => void;
}): JSX.Element {
    return (
        <MapPanel title="Địa điểm đã lưu" titleId="tieu-de-da-luu" onClose={onClose}>
            {state.status === "loading" ? (
                <p role="status" className="m-0 flex items-center gap-2 text-sm text-charcoal/70">
                    <Loader2 size={16} className="animate-spin" aria-hidden /> Đang tải…
                </p>
            ) : null}
            {state.status === "error" ? (
                <p role="alert" className="m-0 text-sm text-red-700">
                    {state.message}
                </p>
            ) : null}
            {state.status === "ready" && state.items.length === 0 ? (
                <div className="grid justify-items-start gap-1.5 text-sm text-charcoal/70">
                    <Bookmark size={20} className="text-charcoal/40" aria-hidden />
                    <p className="m-0">Chưa lưu địa điểm nào.</p>
                    <p className="m-0 text-xs text-charcoal/55">
                        Bấm chuột phải lên bản đồ, chọn “Xem thông tin địa điểm này” rồi bấm “Lưu địa điểm”.
                    </p>
                </div>
            ) : null}
            {state.items.length > 0 ? (
                <ul className="m-0 list-none p-0">
                    {state.items.map((item) => (
                        <li key={item.id} className="flex items-center gap-1 border-b border-charcoal/10 last:border-b-0">
                            <button
                                type="button"
                                onClick={() => onOpen(item)}
                                className="flex min-w-0 flex-1 items-start gap-2.5 rounded-md bg-transparent px-1 py-2.5 text-left hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
                            >
                                <MapPin size={16} className="mt-0.5 shrink-0 text-green" aria-hidden />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">{item.name}</span>
                                    <span className="block truncate text-xs text-charcoal/60">
                                        {item.kind ? `${PLACE_KIND_LABEL[item.kind]} · ` : ""}
                                        {item.address || `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`}
                                    </span>
                                    {item.evaluation ? (
                                        <span className="mt-0.5 block text-xs text-charcoal/60">
                                            Đã đánh giá · {item.evaluation.rating.toLowerCase()} · dữ liệu v{item.evaluation.datasetVersion}
                                            {item.evaluation.outdated ? <span className="ml-1 rounded bg-gold/20 px-1 font-semibold text-charcoal/80">có dữ liệu mới</span> : null}
                                        </span>
                                    ) : (
                                        <span className="mt-0.5 block text-xs text-charcoal/45">Chưa đánh giá</span>
                                    )}
                                </span>
                                {item.evaluation ? (
                                    <ScoreRing
                                        value={item.evaluation.overall}
                                        size={34}
                                        label={item.evaluation.overall === null ? "Chưa có điểm" : `Điểm ${formatScore(item.evaluation.overall)} trên 10`}
                                    />
                                ) : null}
                            </button>
                            <button
                                type="button"
                                aria-label={`Bỏ lưu ${item.name}`}
                                title="Bỏ lưu"
                                disabled={busyKey === item.placeKey}
                                onClick={() => onRemove(item)}
                                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-charcoal/55 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-green disabled:opacity-40"
                            >
                                {busyKey === item.placeKey ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Trash2 size={15} aria-hidden />}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </MapPanel>
    );
}
