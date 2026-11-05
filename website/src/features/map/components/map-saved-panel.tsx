"use client";

import { ArrowRight, Bookmark, GitCompareArrows, Loader2, MapPin, NotebookPen, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type JSX } from "react";

import MapPanel from "@/features/map/components/map-panel";
import SavedPlaceEditor from "@/features/map/components/saved-place-editor";
import ScoreRing, { formatScore } from "@/features/map/components/score-ring";
import { PLACE_KIND_LABEL } from "@/features/map/map-place-match";
import { savedTitle, type SavedState } from "@/features/map/hooks/use-saved-places";
import type { SavedPlace } from "@/features/map/map.types";

type SavedPatch = { label?: string | null; note?: string };

interface MapSavedPanelProps {
    state: SavedState;
    busyKey: string | null;
    /** Trang so sánh (`/app/compare` hoặc `/admin/compare`). */
    compareHref: string;
    onOpen: (item: SavedPlace) => void;
    onRemove: (item: SavedPlace) => void;
    /** Trả về thông báo lỗi hoặc null. */
    onUpdate: (item: SavedPlace, patch: SavedPatch) => Promise<string | null>;
    onToggleCompare: (item: SavedPlace) => void;
    onClose: () => void;
}

const ICON_BUTTON =
    "inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-transparent text-charcoal/55 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-green disabled:opacity-40 aria-pressed:bg-green/10 aria-pressed:text-green";

/** Danh sách địa điểm đã lưu: mở trên bản đồ, đặt tên gợi nhớ, ghi chú, thêm vào so sánh, bỏ lưu. */
export default function MapSavedPanel({
    state,
    busyKey,
    compareHref,
    onOpen,
    onRemove,
    onUpdate,
    onToggleCompare,
    onClose,
}: MapSavedPanelProps): JSX.Element {
    const [editing, setEditing] = useState<{ id: string; mode: "label" | "note" } | null>(null);
    const comparedCount = state.items.filter((item) => item.compared).length;

    return (
        <MapPanel title="Địa điểm đã lưu" titleId="tieu-de-da-luu" onClose={onClose}>
            {state.status === "loading" || state.status === "idle" ? (
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
            {comparedCount > 0 ? (
                <Link
                    href={compareHref}
                    className="flex items-center justify-between gap-2 rounded-lg bg-green/10 px-3 py-2 text-sm font-semibold text-green no-underline hover:bg-green/15"
                >
                    <span className="inline-flex items-center gap-2">
                        <GitCompareArrows size={16} aria-hidden /> So sánh {comparedCount} địa điểm
                    </span>
                    <ArrowRight size={16} aria-hidden />
                </Link>
            ) : null}
            {state.items.length > 0 ? (
                <ul className="m-0 list-none p-0">
                    {state.items.map((item, index) => {
                        const title = savedTitle(item);
                        const busy = busyKey === item.id;
                        const editingThis = editing?.id === item.id ? editing.mode : null;
                        return (
                            <li key={item.id}>
                                {index > 0 ? <div role="presentation" className="my-1 h-px bg-charcoal/10" /> : null}
                                <div className="flex items-start gap-1">
                                    <button
                                        type="button"
                                        onClick={() => onOpen(item)}
                                        className="flex min-w-0 flex-1 items-start gap-2.5 rounded-md bg-transparent px-1 py-2 text-left hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
                                    >
                                        <MapPin size={16} className="mt-0.5 shrink-0 text-green" aria-hidden />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold">{title}</span>
                                            <span className="block truncate text-xs text-charcoal/60">
                                                {item.label ? `${item.name} · ` : item.kind ? `${PLACE_KIND_LABEL[item.kind]} · ` : ""}
                                                {item.address || `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`}
                                            </span>
                                            {item.note ? (
                                                <span className="mt-1 line-clamp-2 text-xs whitespace-pre-line text-charcoal/80">{item.note}</span>
                                            ) : null}
                                            {item.evaluation ? (
                                                <span className="mt-0.5 block text-xs text-charcoal/60">
                                                    Đã đánh giá · {item.evaluation.rating.toLowerCase()} · dữ liệu v{item.evaluation.datasetVersion}
                                                    {item.evaluation.outdated ? (
                                                        <span className="ml-1 rounded bg-gold/20 px-1 font-semibold text-charcoal/80">có dữ liệu mới</span>
                                                    ) : null}
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
                                    <div className="grid shrink-0 grid-cols-2 gap-0.5 pt-1">
                                        <button
                                            type="button"
                                            aria-label={`Đặt tên gợi nhớ cho ${title}`}
                                            title="Đặt tên gợi nhớ"
                                            aria-pressed={editingThis === "label"}
                                            onClick={() => setEditing(editingThis === "label" ? null : { id: item.id, mode: "label" })}
                                            className={ICON_BUTTON}
                                        >
                                            <Pencil size={15} aria-hidden />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`${item.note ? "Sửa" : "Thêm"} ghi chú cho ${title}`}
                                            title={item.note ? "Sửa ghi chú" : "Thêm ghi chú"}
                                            aria-pressed={editingThis === "note"}
                                            onClick={() => setEditing(editingThis === "note" ? null : { id: item.id, mode: "note" })}
                                            className={ICON_BUTTON}
                                        >
                                            <NotebookPen size={15} aria-hidden />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={item.compared ? `Bỏ ${title} khỏi so sánh` : `Thêm ${title} vào so sánh`}
                                            title={item.compared ? "Bỏ khỏi so sánh" : "Thêm vào so sánh"}
                                            aria-pressed={item.compared}
                                            disabled={busy}
                                            onClick={() => onToggleCompare(item)}
                                            className={ICON_BUTTON}
                                        >
                                            <GitCompareArrows size={15} aria-hidden />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`Bỏ lưu ${title}`}
                                            title="Bỏ lưu"
                                            disabled={busy}
                                            onClick={() => onRemove(item)}
                                            className={`${ICON_BUTTON} hover:bg-red-50 hover:text-red-700`}
                                        >
                                            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Trash2 size={15} aria-hidden />}
                                        </button>
                                    </div>
                                </div>
                                {editingThis ? (
                                    <div className="mt-1 mb-2">
                                        <SavedPlaceEditor
                                            key={editingThis}
                                            mode={editingThis}
                                            initial={editingThis === "label" ? (item.label ?? "") : item.note}
                                            placeholder={item.name}
                                            onSave={async (value) => {
                                                const message = await onUpdate(item, editingThis === "label" ? { label: value || null } : { note: value });
                                                if (!message) setEditing(null);
                                                return message;
                                            }}
                                            onCancel={() => setEditing(null)}
                                        />
                                    </div>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </MapPanel>
    );
}
