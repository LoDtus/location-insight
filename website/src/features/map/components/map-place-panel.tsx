"use client";

import { Bookmark, BookmarkCheck, Check, Copy, Eye, Images, Link2, Loader2, Navigation, Radar, Route, Search } from "lucide-react";
import Link from "next/link";
import { useState, type JSX, type ReactNode } from "react";

import MapPanel from "@/features/map/components/map-panel";
import MapPlaceEvaluation from "@/features/map/components/map-place-evaluation";
import { PRECISE_PLACE_M, formatCoordinates } from "@/features/map/map.geo";
import { PLACE_KIND_LABEL, matchListings } from "@/features/map/map-place-match";
import type { PlaceSelection } from "@/features/map/hooks/use-place-selection";
import type { EvaluatedCriterion } from "@/features/map/map.types";
import ImageLightbox from "@/shared/components/lightbox/image-lightbox";
import { showToast } from "@/shared/components/toast/toast-store";

interface MapPlacePanelProps {
    selection: Exclude<PlaceSelection, { status: "none" }>;
    /** `/app` hoặc `/admin`: nơi trang tin rao nằm. */
    root: string;
    saved: boolean;
    saving: boolean;
    onToggleSave: () => void;
    onClose: () => void;
    onDirectionsTo: () => void;
    onDirectionsFrom: () => void;
    /** Mở chế độ tìm kiếm lân cận quanh điểm này (giống menu chuột phải). */
    onNearby: () => void;
    /** Sao chép liên kết mở lại đúng điểm này (giống "Sao chép địa điểm" ở menu chuột phải). */
    onCopyLink: () => void;
    /** Chọn tiêu chí trong phần đánh giá: chỗ nối để sau này vẽ dẫn chứng của tiêu chí lên bản đồ. */
    onCriterionSelect?: (criterion: EvaluatedCriterion | null) => void;
    /** Sau một lượt đánh giá mới. */
    onEvaluated?: () => void;
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
    saved,
    saving,
    onToggleSave,
    onClose,
    onDirectionsTo,
    onDirectionsFrom,
    onNearby,
    onCopyLink,
    onCriterionSelect,
    onEvaluated,
}: MapPlacePanelProps) {
    const [copied, setCopied] = useState(false);
    const [viewer, setViewer] = useState<number | null>(null);
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

    return (
        <MapPanel title="Địa điểm" titleId="tieu-de-dia-diem" onClose={onClose} size="wide">
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
                    <h3 className="m-0 mt-1.5 text-xl leading-snug font-semibold text-balance">{place?.name ?? "Điểm đã chọn"}</h3>
                    {place ? <p className="m-0 mt-0.5 text-sm text-charcoal/70">{place.address || place.display}</p> : null}
                    {approximate ? (
                        <p className="m-0 mt-2 rounded-md bg-gold/15 px-2.5 py-1.5 text-xs text-charcoal/80">
                            Chưa có địa điểm chính xác tại điểm bấm. Đây là địa chỉ gần nhất, cách khoảng {Math.round(distance)} m.
                        </p>
                    ) : null}
                    {!place ? <p className="m-0 mt-1 text-sm text-charcoal/70">Không có địa chỉ gần điểm này.</p> : null}
                </div>
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
