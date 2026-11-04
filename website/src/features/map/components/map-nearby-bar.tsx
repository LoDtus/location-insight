"use client";

import { Radar, X } from "lucide-react";
import type { JSX } from "react";

import { NEARBY_RADIUS, formatCoordinates, formatDistance } from "@/features/map/map.geo";
import type { MapPoint } from "@/features/map/map.types";

interface MapNearbyBarProps {
    center: MapPoint;
    radiusM: number;
    onRadius: (radiusM: number) => void;
    onExit: () => void;
}

/** Thanh chế độ "Tìm kiếm lân cận": hiện tâm tìm kiếm và chỉnh bán kính vòng tròn trên bản đồ. */
export default function MapNearbyBar({ center, radiusM, onRadius, onExit }: MapNearbyBarProps): JSX.Element {
    return (
        <section aria-label="Tìm kiếm lân cận" className="pointer-events-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-green/40">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="m-0 flex items-center gap-1.5 text-sm font-semibold text-green">
                        <Radar size={16} aria-hidden /> Tìm kiếm lân cận
                    </p>
                    <p className="m-0 mt-0.5 truncate font-mono text-xs text-charcoal/70">{formatCoordinates(center)}</p>
                </div>
                <button
                    type="button"
                    aria-label="Thoát tìm kiếm lân cận"
                    onClick={onExit}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-charcoal/70 hover:bg-charcoal/10"
                >
                    <X size={16} aria-hidden />
                </button>
            </div>
            <div className="mt-2 flex items-center gap-3">
                <label htmlFor="nearby-radius" className="text-xs font-semibold text-charcoal/80">
                    Bán kính
                </label>
                <input
                    id="nearby-radius"
                    type="range"
                    min={NEARBY_RADIUS.min}
                    max={NEARBY_RADIUS.max}
                    step={NEARBY_RADIUS.step}
                    value={radiusM}
                    onChange={(event) => onRadius(Number(event.target.value))}
                    aria-valuetext={formatDistance(radiusM)}
                    className="h-2 min-w-0 flex-1 accent-green"
                />
                <output htmlFor="nearby-radius" className="w-14 text-right text-sm font-semibold tabular-nums">
                    {radiusM >= 1000 ? `${(radiusM / 1000).toString().replace(".", ",")} km` : `${radiusM} m`}
                </output>
            </div>
            <p className="m-0 mt-2 text-xs text-charcoal/65">Nhập tên địa điểm hoặc loại hình ở ô tìm kiếm phía trên để tìm trong vòng tròn.</p>
        </section>
    );
}
