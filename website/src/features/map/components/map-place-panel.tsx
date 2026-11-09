"use client";

import { Bookmark, BookmarkCheck, Check, Copy, Eye, GitCompareArrows, Images, Link2, Loader2, Navigation, NotebookPen, Pencil, Radar, Route, Search } from "lucide-react";
import Link from "next/link";
import { useState, type JSX, type ReactNode } from "react";

import MapPanel from "@/features/map/components/map-panel";
import MapPlaceEvaluation from "@/features/map/components/map-place-evaluation";
import SavedPlaceEditor from "@/features/map/components/saved-place-editor";
import { PRECISE_PLACE_M, formatCoordinates } from "@/features/map/map.geo";
import { PLACE_KIND_LABEL, matchListings } from "@/features/map/map-place-match";
import type { PlaceSelection } from "@/features/map/hooks/use-place-selection";
import type { EvaluatedCriterion, SavedPlace } from "@/features/map/map.types";
import ImageLightbox from "@/shared/components/lightbox/image-lightbox";
import { showToast } from "@/shared/components/toast/toast-store";

interface MapPlacePanelProps {
    selection: Exclude<PlaceSelection, { status: "none" }>;
    /** `/app` hoặc `/admin`: nơi trang tin rao nằm. */
    root: string;
    /** Mục đã lưu tương ứng (nếu đã lưu): có thêm tên gợi nhớ, ghi chú và so sánh. */
    savedItem: SavedPlace | undefined;
    saving: boolean;
    onToggleSave: () => void;
    /** Sửa tên gợi nhớ/ghi chú. Trả về thông báo lỗi hoặc null. */
    onUpdateSaved: (patch: { label?: string | null; note?: string }) => Promise<string | null>;
    /** Thêm/bỏ địa điểm khỏi danh sách so sánh (chưa lưu thì tự lưu rồi thêm). */
    onToggleCompare: () => void;
    onClose: () => void;
    onDirectionsTo: () => void;
    onDirectionsFrom: () => void;
    /** Mở chế độ tìm kiếm lân cận quanh điểm này (giống menu chuột phải). */
    onNearby: () => void;
    /** Sao chép liên kết mở lại đúng điểm này (giống "Sao chép địa điểm" ở menu chuột phải). */
    onCopyLink: () => void;
    /** Chọn tiêu chí trong phần đánh giá: vẽ dẫn chứng của tiêu chí lên bản đồ (null = bỏ chọn). */
    onCriterionSelect?: (criterion: EvaluatedCriterion | null) => void;
    /** Tiêu chí đang hiện dẫn chứng trên bản đồ (null khi đã ẩn). */
    activeCriterionId?: string | null;
    /** Sau một lượt đánh giá mới. */
    onEvaluated?: () => void;
    /** Mở từ danh sách kết quả: nút mũi tên trái quay lại danh sách. */
    onBack?: () => void;
    /** Nhãn nút quay lại (theo danh sách đã mở thẻ này). */
    backLabel?: string;
}

function Row({ label, children }: { label: string; children: ReactNode }): JSX.Element {
    return (
        <div className="grid grid-cols-1 gap-0.5 border-b border-charcoal/10 py-2 last:border-b-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
            <dt className="text-sm text-charcoal/60">{label}</dt>
            <dd className="m-0 min-w-0 text-sm">{children}</dd>
        </div>
    );
}

/**
 * Thẻ "Địa điểm": ảnh (nếu có tin rao tại đây), tên, phân loại, địa chỉ chính xác, tọa độ, số người quan tâm,
 * tìm tin rao theo tên, chỉ đường, lưu địa điểm và đánh giá theo tiêu chí.
 */
export default function MapPlacePanel({
    selection,
    root,
    savedItem,
    saving,
    onToggleSave,
    onUpdateSaved,
    onToggleCompare,
    onClose,
    onDirectionsTo,
    onDirectionsFrom,
    onNearby,
    onCopyLink,
    onCriterionSelect,
    activeCriterionId,
    onEvaluated,
    onBack,
    backLabel = "Quay lại danh sách kết quả",
}: MapPlacePanelProps) {
    const [copied, setCopied] = useState(false);
    const [viewer, setViewer] = useState<number | null>(null);
    const [editing, setEditing] = useState<"label" | "note" | null>(null);
    const saved = savedItem !== undefined;
    const editingNow = saved ? editing : null;
    const coordinates = formatCoordinates(selection.point);
    const place = selection.status === "ready" ? selection.place : null;
    const match = matchListings(place, selection.point);
    const kind = place?.kind ?? "unknown";
    const distance = place?.distanceM ?? null;
    const approximate = distance !== null && distance > PRECISE_PLACE_M;
    const searchHref = place ? `${root}/properties?q=${encodeURIComponent(place.name)}` : null;

    async function copy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(coordinates);
            setCopied(true);
            showToast({ title: "Đã sao chép tọa độ", description: coordinates });
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }

    const tertiary =
        "inline-flex min-h-8 items-center gap-1.5 rounded-md bg-transparent px-2 text-xs font-semibold whitespace-nowrap text-charcoal/75 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green";
    const secondary =
        "inline-flex min-h-10 items-center whitespace-nowrap justify-center gap-2 rounded-lg border border-charcoal/15 bg-white px-3 text-sm font-semibold text-charcoal hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green disabled:opacity-60";

    const headerButton =
        "inline-flex size-10 items-center justify-center rounded-md bg-transparent text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green aria-pressed:bg-green/10 aria-pressed:text-green";
    const actions = savedItem ? (
        <>
            <button
                type="button"
                aria-label="Đặt tên gợi nhớ"
                title="Đặt tên gợi nhớ"
                aria-pressed={editingNow === "label"}
                onClick={() => setEditing((current) => (current === "label" ? null : "label"))}
                className={headerButton}
            >
                <Pencil size={17} aria-hidden />
            </button>
            <button
                type="button"
                aria-label={savedItem.note ? "Sửa ghi chú" : "Thêm ghi chú"}
                title={savedItem.note ? "Sửa ghi chú" : "Thêm ghi chú"}
                aria-pressed={editingNow === "note"}
                onClick={() => setEditing((current) => (current === "note" ? null : "note"))}
                className={`${headerButton} relative`}
            >
                <NotebookPen size={17} aria-hidden />
                {savedItem.note ? <span className="absolute top-2 right-2 size-1.5 rounded-full bg-green" aria-hidden /> : null}
            </button>
        </>
    ) : null;

    async function saveField(field: "label" | "note", value: string): Promise<string | null> {
        const message = await onUpdateSaved(field === "label" ? { label: value || null } : { note: value });
        if (!message) {
            setEditing(null);
            showToast({
                title: field === "label" ? (value ? "Đã đặt tên gợi nhớ" : "Đã dùng lại tên gốc") : value ? "Đã lưu ghi chú" : "Đã xóa ghi chú",
                description: field === "label" ? value || place?.name : undefined,
            });
        }
        return message;
    }

    return (
        <MapPanel
            title="Địa điểm"
            titleId="tieu-de-dia-diem"
            onClose={onClose}
            size="wide"
            actions={actions}
            onBack={onBack}
            backLabel={backLabel}
            peek={activeCriterionId !== null && activeCriterionId !== undefined}
        >
            {selection.status === "loading" ? (
                <div aria-busy="true" className="grid gap-2">
                    <p className="m-0 flex items-center gap-2 text-sm text-charcoal/70" role="status">
                        <Loader2 size={16} className="animate-spin" aria-hidden /> Đang lấy thông tin địa điểm…
                    </p>
                    <div className="h-6 w-2/3 animate-pulse rounded bg-charcoal/5 motion-reduce:animate-none" />
                    <div className="h-4 w-full animate-pulse rounded bg-charcoal/5 motion-reduce:animate-none" />
                </div>
            ) : null}
            {selection.status === "error" ? (
                <p className="m-0 text-sm text-red-700" role="alert">
                    {selection.message}
                </p>
            ) : null}

            {match.images.length > 0 ? (
                <div className={`grid gap-1.5 ${match.images.length > 1 ? "grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid-cols-1"}`}>
                    <button
                        type="button"
                        onClick={() => setViewer(0)}
                        aria-label={`Xem ${match.images.length} ảnh của địa điểm`}
                        className="relative row-span-2 aspect-[4/3] cursor-zoom-in overflow-hidden rounded-md bg-charcoal/5 p-0"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={match.images[0]} alt={place?.name ?? ""} className="h-full w-full object-cover" />
                        <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded bg-charcoal/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                            <Images size={12} aria-hidden /> {match.images.length}
                        </span>
                    </button>
                    {match.images.slice(1, 3).map((src, index) => (
                        <button
                            key={src}
                            type="button"
                            onClick={() => setViewer(index + 1)}
                            aria-label={`Xem ảnh ${index + 2}`}
                            className="h-full cursor-zoom-in overflow-hidden rounded-md bg-charcoal/5 p-0"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" className="h-full w-full object-cover" />
                        </button>
                    ))}
                </div>
            ) : null}

            {selection.status === "ready" ? (
                <div>
                    <p className="m-0 inline-flex rounded-md bg-charcoal/5 px-2 py-0.5 text-xs font-semibold text-charcoal/75">
                        {PLACE_KIND_LABEL[kind]}
                    </p>
                    <h3 className="m-0 mt-1.5 text-xl leading-snug font-semibold text-balance">
                        {savedItem?.label || place?.name || "Điểm đã chọn"}
                    </h3>
                    {savedItem?.label && place?.name ? <p className="m-0 mt-0.5 text-xs text-charcoal/55">Tên gốc: {place.name}</p> : null}
                    {place ? <p className="m-0 mt-0.5 text-sm text-charcoal/70">{place.address || place.display}</p> : null}
                    {approximate ? (
                        <p className="m-0 mt-2 rounded-md bg-gold/15 px-2.5 py-1.5 text-xs text-charcoal/80">
                            Chưa có địa điểm chính xác tại điểm bấm. Đây là địa chỉ gần nhất, cách khoảng {Math.round(distance)} m.
                        </p>
                    ) : null}
                    {!place ? <p className="m-0 mt-1 text-sm text-charcoal/70">Không có địa chỉ gần điểm này.</p> : null}
                </div>
            ) : null}

            {savedItem && editingNow ? (
                <SavedPlaceEditor
                    key={editingNow}
                    mode={editingNow}
                    initial={editingNow === "label" ? (savedItem.label ?? "") : savedItem.note}
                    placeholder={place?.name}
                    onSave={(value) => saveField(editingNow, value)}
                    onCancel={() => setEditing(null)}
                />
            ) : savedItem?.note ? (
                <button
                    type="button"
                    onClick={() => setEditing("note")}
                    title="Sửa ghi chú"
                    className="grid gap-0.5 rounded-lg bg-gold/10 px-3 py-2 text-left hover:bg-gold/15 focus-visible:outline-2 focus-visible:outline-green"
                >
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal/70">
                        <NotebookPen size={13} aria-hidden /> Ghi chú của bạn
                    </span>
                    <span className="text-sm whitespace-pre-line text-charcoal">{savedItem.note}</span>
                </button>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg whitespace-nowrap bg-green px-3 text-sm font-semibold text-cream hover:bg-green/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    onClick={onDirectionsTo}
                >
                    <Navigation size={16} aria-hidden /> Chỉ đường
                </button>
                <button type="button" title="Xuất phát từ đây" aria-label="Xuất phát từ đây" className={`${secondary} flex-1`} onClick={onDirectionsFrom}>
                    <Route size={16} aria-hidden /> Đi từ đây
                </button>
                <button
                    type="button"
                    aria-pressed={saved}
                    disabled={saving || selection.status !== "ready"}
                    onClick={onToggleSave}
                    className={`${secondary} flex-1 ${saved ? "border-green/40 bg-green/5 text-green hover:bg-green/10" : ""}`}
                >
                    {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : saved ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
                    {saved ? "Đã lưu" : "Lưu địa điểm"}
                </button>
                <button
                    type="button"
                    aria-pressed={savedItem?.compared ?? false}
                    disabled={saving || selection.status !== "ready"}
                    title={
                        savedItem?.compared
                            ? "Bỏ khỏi danh sách so sánh"
                            : savedItem
                              ? "Thêm vào danh sách so sánh"
                              : "Lưu địa điểm và thêm vào danh sách so sánh"
                    }
                    onClick={onToggleCompare}
                    className={`${secondary} flex-1 ${savedItem?.compared ? "border-green/40 bg-green/5 text-green hover:bg-green/10" : ""}`}
                >
                    <GitCompareArrows size={16} aria-hidden />
                    {savedItem?.compared ? "Đang so sánh" : "So sánh"}
                </button>
            </div>

            {/* Các thao tác còn lại của menu chuột phải. */}
            <div className="-mt-1 flex flex-wrap gap-1">
                <button type="button" onClick={onNearby} className={tertiary}>
                    <Radar size={15} aria-hidden /> Tìm lân cận
                </button>
                <button type="button" onClick={() => void copy()} className={tertiary}>
                    {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} Sao chép tọa độ
                </button>
                <button type="button" onClick={onCopyLink} className={tertiary}>
                    <Link2 size={15} aria-hidden /> Sao chép liên kết
                </button>
            </div>

            <dl className="m-0 rounded-lg border border-charcoal/10 px-3">
                <Row label="Địa chỉ chính xác">
                    {place ? (
                        <>
                            <span className="block">{place.display || place.address}</span>
                            {place.addressOld ? <span className="block text-xs text-charcoal/55">Trước sáp nhập: {place.addressOld}</span> : null}
                        </>
                    ) : (
                        <span className="text-charcoal/55">Chưa xác định</span>
                    )}
                </Row>
                <Row label="Tọa độ">
                    <span className="flex items-center justify-between gap-2">
                        <span className="tabular-nums">{coordinates}</span>
                        <button
                            type="button"
                            aria-label="Sao chép tọa độ"
                            title="Sao chép tọa độ"
                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-charcoal/65 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-green"
                            onClick={() => void copy()}
                        >
                            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                        </button>
                    </span>
                </Row>
                {match.listings.length > 0 ? (
                    <Row label="Người quan tâm">
                        <span className="inline-flex items-center gap-1.5">
                            <Eye size={14} className="text-charcoal/55" aria-hidden />
                            <b className="tabular-nums">{match.watchers.toLocaleString("vi-VN")}</b> người theo dõi {match.listings.length} tin rao
                        </span>
                    </Row>
                ) : null}
                {searchHref && place ? (
                    <Row label="Tin rao">
                        <Link href={searchHref} className="font-semibold text-green underline-offset-2 hover:underline">
                            <Search size={14} aria-hidden className="mr-1.5 inline align-[-2px]" />
                            Tìm tin rao “{place.name}”
                        </Link>
                    </Row>
                ) : null}
            </dl>

            {selection.status === "ready" ? <MapPlaceEvaluation
                    key={coordinates}
                    point={selection.point}
                    placeName={place?.name || coordinates}
                    onCriterionSelect={onCriterionSelect}
                    activeCriterionId={activeCriterionId}
                    onEvaluated={onEvaluated}
                /> : null}

            <p className="m-0 text-xs text-charcoal/55">Địa chỉ có thể lệch vài chục mét. Phân tích bám tọa độ của ghim, không bám chuỗi địa chỉ.</p>

            {viewer !== null ? (
                <ImageLightbox
                    images={match.images.map((src, index) => ({ src, alt: `${place?.name ?? "Địa điểm"} – ${index + 1}` }))}
                    start={viewer}
                    onClose={() => setViewer(null)}
                />
            ) : null}
        </MapPanel>
    );
}
