"use client";

import { ArrowRight, Bookmark, GitCompareArrows, Loader2, MapPin, MoreHorizontal, NotebookPen, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type JSX } from "react";

import MapConfirmDialog from "@/features/map/components/map-confirm-dialog";
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
    /** Thao tác trên nhiều mục đã chọn. */
    onCompareMany: (items: SavedPlace[]) => Promise<void>;
    onRemoveMany: (items: SavedPlace[]) => Promise<void>;
    onClose: () => void;
}

const HEADER_BUTTON =
    "inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green disabled:opacity-50";

/**
 * Danh sách địa điểm đã lưu: bấm để mở trên bản đồ; mỗi mục có nút ba chấm (tên gợi nhớ, ghi chú, so sánh, bỏ lưu);
 * chọn nhiều mục để thêm vào so sánh hoặc xóa cùng lúc (xóa có hộp xác nhận).
 */
export default function MapSavedPanel({
    state,
    busyKey,
    compareHref,
    onOpen,
    onRemove,
    onUpdate,
    onToggleCompare,
    onCompareMany,
    onRemoveMany,
    onClose,
}: MapSavedPanelProps): JSX.Element {
    const [editing, setEditing] = useState<{ id: string; mode: "label" | "note" } | null>(null);
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirming, setConfirming] = useState(false);
    const [bulkBusy, setBulkBusy] = useState<"compare" | "remove" | null>(null);
    const comparedCount = state.items.filter((item) => item.compared).length;
    // Mục đã bị xóa ở nơi khác thì tự rời khỏi lựa chọn.
    const chosen = state.items.filter((item) => selected.has(item.id));
    const allChosen = state.items.length > 0 && chosen.length === state.items.length;

    function toggle(id: string): void {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function bulk(kind: "compare" | "remove"): Promise<void> {
        setBulkBusy(kind);
        try {
            if (kind === "compare") await onCompareMany(chosen);
            else await onRemoveMany(chosen);
            setSelected(new Set());
        } finally {
            setBulkBusy(null);
            setConfirming(false);
        }
    }

    const actions =
        chosen.length > 0 ? (
            <>
                <button
                    type="button"
                    disabled={bulkBusy !== null}
                    onClick={() => void bulk("compare")}
                    title={`Thêm ${chosen.length} địa điểm vào so sánh`}
                    className={`${HEADER_BUTTON} bg-green/10 text-green hover:bg-green/15`}
                >
                    {bulkBusy === "compare" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <GitCompareArrows size={15} aria-hidden />}
                    So sánh ({chosen.length})
                </button>
                <button
                    type="button"
                    disabled={bulkBusy !== null}
                    onClick={() => setConfirming(true)}
                    title={`Xóa ${chosen.length} địa điểm`}
                    className={`${HEADER_BUTTON} bg-red-50 text-red-700 hover:bg-red-100`}
                >
                    <Trash2 size={15} aria-hidden /> Xóa
                </button>
            </>
        ) : null;

    return (
        <MapPanel title="Địa điểm đã lưu" titleId="tieu-de-da-luu" onClose={onClose} actions={actions}>
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
                <div>
                    <label className="flex min-h-8 cursor-pointer items-center gap-2.5 px-2 text-xs font-semibold text-charcoal/65">
                        <input
                            type="checkbox"
                            checked={allChosen}
                            ref={(element) => {
                                if (element) element.indeterminate = chosen.length > 0 && !allChosen;
                            }}
                            onChange={() => setSelected(allChosen ? new Set() : new Set(state.items.map((item) => item.id)))}
                            className="size-4 accent-green"
                        />
                        {chosen.length > 0 ? `Đã chọn ${chosen.length}/${state.items.length}` : `Chọn tất cả (${state.items.length})`}
                    </label>
                    <ul className="m-0 list-none p-0">
                        {state.items.map((item, index) => (
                            <SavedRow
                                key={item.id}
                                item={item}
                                first={index === 0}
                                busy={busyKey === item.id}
                                checked={selected.has(item.id)}
                                menuOpen={menuFor === item.id}
                                editing={editing?.id === item.id ? editing.mode : null}
                                onCheck={() => toggle(item.id)}
                                onMenu={(open) => setMenuFor(open ? item.id : null)}
                                onOpen={() => onOpen(item)}
                                onEdit={(mode) => {
                                    setMenuFor(null);
                                    setEditing(mode ? { id: item.id, mode } : null);
                                }}
                                onUpdate={(patch) => onUpdate(item, patch)}
                                onToggleCompare={() => {
                                    setMenuFor(null);
                                    onToggleCompare(item);
                                }}
                                onRemove={() => {
                                    setMenuFor(null);
                                    onRemove(item);
                                }}
                            />
                        ))}
                    </ul>
                </div>
            ) : null}
            {confirming ? (
                <MapConfirmDialog
                    title={`Xóa ${chosen.length} địa điểm đã lưu?`}
                    confirmLabel={bulkBusy === "remove" ? "Đang xóa…" : "Xóa"}
                    danger
                    busy={bulkBusy === "remove"}
                    onConfirm={() => void bulk("remove")}
                    onCancel={() => setConfirming(false)}
                >
                    <p className="m-0">Tên gợi nhớ, ghi chú và trạng thái so sánh của các địa điểm này cũng bị xóa. Lượt đánh giá đã có vẫn giữ.</p>
                    <ul className="m-0 mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-charcoal">
                        {chosen.map((item) => (
                            <li key={item.id}>{savedTitle(item)}</li>
                        ))}
                    </ul>
                </MapConfirmDialog>
            ) : null}
        </MapPanel>
    );
}

function SavedRow({
    item,
    first,
    busy,
    checked,
    menuOpen,
    editing,
    onCheck,
    onMenu,
    onOpen,
    onEdit,
    onUpdate,
    onToggleCompare,
    onRemove,
}: {
    item: SavedPlace;
    first: boolean;
    busy: boolean;
    checked: boolean;
    menuOpen: boolean;
    editing: "label" | "note" | null;
    onCheck: () => void;
    onMenu: (open: boolean) => void;
    onOpen: () => void;
    onEdit: (mode: "label" | "note" | null) => void;
    onUpdate: (patch: SavedPatch) => Promise<string | null>;
    onToggleCompare: () => void;
    onRemove: () => void;
}): JSX.Element {
    const title = savedTitle(item);
    const menuRef = useRef<HTMLDivElement>(null);

    const onMenuRef = useRef(onMenu);
    useEffect(() => {
        onMenuRef.current = onMenu;
    });

    // Chỉ chạy khi mở/đóng menu: focus mục đầu, bấm ra ngoài thì đóng.
    useEffect(() => {
        if (!menuOpen) return;
        menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
        function onPointer(event: PointerEvent): void {
            if (!menuRef.current?.contains(event.target as Node)) onMenuRef.current(false);
        }
        document.addEventListener("pointerdown", onPointer, true);
        return () => document.removeEventListener("pointerdown", onPointer, true);
    }, [menuOpen]);

    const menuItem =
        "flex min-h-9 w-full items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 text-left text-sm text-charcoal hover:bg-charcoal/5 focus-visible:bg-charcoal/5 focus-visible:outline-none";

    return (
        <li>
            {!first ? <div role="presentation" className="mx-2 my-0.5 h-px bg-charcoal/10" /> : null}
            {/* Nền khi rê chuột phủ cả hàng, gồm ô chọn và nút ba chấm. */}
            <div className={`group flex items-start gap-1 rounded-md px-2 transition-colors hover:bg-charcoal/[0.05] ${checked ? "bg-green/[0.06]" : ""}`}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onCheck}
                    aria-label={`Chọn ${title}`}
                    className="mt-3 size-4 shrink-0 accent-green"
                />
                <button
                    type="button"
                    onClick={onOpen}
                    className="flex min-w-0 flex-1 items-start gap-2.5 rounded-md bg-transparent px-1.5 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-green"
                >
                    <MapPin size={16} className="mt-0.5 shrink-0 text-green" aria-hidden />
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">{title}</span>
                            {item.compared ? (
                                <GitCompareArrows size={13} className="shrink-0 text-green" aria-label="Đang so sánh" />
                            ) : null}
                        </span>
                        <span className="block truncate text-xs text-charcoal/60">
                            {item.label ? `${item.name} · ` : item.kind ? `${PLACE_KIND_LABEL[item.kind]} · ` : ""}
                            {item.address || `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`}
                        </span>
                        {item.note ? <span className="mt-1 line-clamp-2 text-xs whitespace-pre-line text-charcoal/80">{item.note}</span> : null}
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
                <div ref={menuRef} className="relative mt-1.5 shrink-0">
                    <button
                        type="button"
                        aria-label={`Thao tác với ${title}`}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        disabled={busy}
                        onClick={() => onMenu(!menuOpen)}
                        className="inline-flex size-8 items-center justify-center rounded-md bg-transparent text-charcoal/60 hover:bg-charcoal/10 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-green disabled:opacity-50"
                    >
                        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <MoreHorizontal size={18} aria-hidden />}
                    </button>
                    {menuOpen ? (
                        <div
                            role="menu"
                            aria-label={`Thao tác với ${title}`}
                            onKeyDown={(event) => {
                                const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
                                const index = buttons.findIndex((button) => button === document.activeElement);
                                if (event.key === "Escape") onMenu(false);
                                else if (event.key === "ArrowDown") {
                                    event.preventDefault();
                                    buttons[(index + 1) % buttons.length]?.focus();
                                } else if (event.key === "ArrowUp") {
                                    event.preventDefault();
                                    buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
                                }
                            }}
                            className="absolute top-full right-0 z-20 mt-1 w-56 rounded-lg bg-white p-1.5 shadow-[0_8px_24px_rgba(16,17,17,0.16)] ring-1 ring-charcoal/10"
                        >
                            <button type="button" role="menuitem" onClick={() => onEdit("label")} className={menuItem}>
                                <Pencil size={15} className="text-charcoal/60" aria-hidden /> Đặt tên gợi nhớ
                            </button>
                            <button type="button" role="menuitem" onClick={() => onEdit("note")} className={menuItem}>
                                <NotebookPen size={15} className="text-charcoal/60" aria-hidden /> {item.note ? "Sửa ghi chú" : "Thêm ghi chú"}
                            </button>
                            <button type="button" role="menuitem" onClick={onToggleCompare} className={menuItem}>
                                <GitCompareArrows size={15} className="text-charcoal/60" aria-hidden />
                                {item.compared ? "Bỏ khỏi so sánh" : "Thêm vào so sánh"}
                            </button>
                            <div role="presentation" className="my-1 h-px bg-charcoal/10" />
                            <button type="button" role="menuitem" onClick={onRemove} className={`${menuItem} text-red-700 hover:bg-red-50 focus-visible:bg-red-50`}>
                                <Trash2 size={15} aria-hidden /> Bỏ lưu
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
            {editing ? (
                <div className="mt-1 mb-2 px-2">
                    <SavedPlaceEditor
                        key={editing}
                        mode={editing}
                        initial={editing === "label" ? (item.label ?? "") : item.note}
                        placeholder={item.name}
                        onSave={async (value) => {
                            const message = await onUpdate(editing === "label" ? { label: value || null } : { note: value });
                            if (!message) onEdit(null);
                            return message;
                        }}
                        onCancel={() => onEdit(null)}
                    />
                </div>
            ) : null}
        </li>
    );
}
