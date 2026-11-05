"use client";

import "@vietmap/vietmap-gl-js/dist/vietmap-gl.css";

import type { Map as VietmapMap } from "@vietmap/vietmap-gl-js/dist/vietmap-gl.js";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";

import { useMapConfig } from "@/features/map/hooks/use-map-config";
import { loadVietmap, styleUrl } from "@/features/map/map-gl";
import type { MapPoint } from "@/features/map/map.types";

const PIN_COLOR = "#026a4e";

/**
 * Bản đồ VietMap nhúng trong trang (chi tiết tin, landing): kéo thả, nút phóng to/thu nhỏ, thước tỷ lệ.
 * Cuộn chuột chỉ phóng to sau khi người dùng bấm vào bản đồ, để không chặn việc cuộn trang.
 */
export default function VietmapView({
    center,
    zoom = 15,
    marker = true,
    label = "Bản đồ",
    className = "",
    onMapClick,
}: {
    center?: MapPoint;
    zoom?: number;
    marker?: boolean;
    label?: string;
    className?: string;
    onMapClick?: (point: MapPoint) => void;
}): JSX.Element {
    const configState = useMapConfig(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const clickRef = useRef(onMapClick);
    const [failed, setFailed] = useState(false);
    const lat = center?.lat;
    const lng = center?.lng;

    useEffect(() => {
        clickRef.current = onMapClick;
    });

    useEffect(() => {
        if (configState.status !== "ready") return;
        const config = configState.config;
        const url = styleUrl(config, "tm");
        const container = containerRef.current;
        if (!url || !container) return;
        let cancelled = false;
        let map: VietmapMap | null = null;
        void loadVietmap()
            .then((lib) => {
                if (cancelled) return;
                const focus: [number, number] = lat !== undefined && lng !== undefined ? [lng, lat] : config.center;
                map = new lib.Map({
                    container,
                    style: url,
                    center: focus,
                    zoom: lat !== undefined ? zoom : config.zoom,
                    minZoom: 5,
                    maxZoom: 19,
                    maxBounds: [
                        [config.maxBounds[0], config.maxBounds[1]],
                        [config.maxBounds[2], config.maxBounds[3]],
                    ],
                    attributionControl: { compact: true },
                    scrollZoom: false,
                    dragRotate: false,
                });
                map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
                map.addControl(new lib.ScaleControl({ unit: "metric" }), "bottom-left");
                map.on("click", (event) => {
                    map?.scrollZoom.enable();
                    clickRef.current?.({ lat: event.lngLat.lat, lng: event.lngLat.lng });
                });
                map.on("error", () => {
                    if (map && !map.isStyleLoaded()) setFailed(true);
                });
                const resize = new ResizeObserver(() => map?.resize());
                resize.observe(container);
                map.on("remove", () => resize.disconnect());
                if (marker && lat !== undefined && lng !== undefined) {
                    new lib.Marker({ color: PIN_COLOR }).setLngLat([lng, lat]).addTo(map);
                }
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
            map?.remove();
        };
    }, [configState, lat, lng, zoom, marker]);

    const unavailable = failed || configState.status === "error" || (configState.status === "ready" && !configState.config.tilesEnabled);
    return (
        <div className={`relative overflow-hidden bg-white ${className}`}>
            {/* `.vietmapgl-map` đặt position:relative lên khung chứa, nên bọc thêm một lớp absolute để giữ kích thước. */}
            <div className="absolute inset-0">
                <div ref={containerRef} role="application" aria-label={label} className="h-full w-full" />
            </div>
            {configState.status === "loading" ? (
                <p role="status" className="absolute inset-0 m-0 flex items-center justify-center gap-2 text-sm text-charcoal/70">
                    <Loader2 size={16} className="animate-spin" aria-hidden /> Đang tải bản đồ…
                </p>
            ) : null}
            {unavailable ? (
                <p role="alert" className="absolute inset-0 m-0 flex items-center justify-center p-4 text-center text-sm text-charcoal/70">
                    Chưa tải được bản đồ. Vui lòng thử lại sau.
                </p>
            ) : null}
        </div>
    );
}
