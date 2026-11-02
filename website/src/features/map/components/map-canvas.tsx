"use client";

import "@vietmap/vietmap-gl-js/dist/vietmap-gl.css";

import type {
    Map as VietmapMap,
    Marker as VietmapMarker,
} from "@vietmap/vietmap-gl-js/dist/vietmap-gl.js";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

import {
    CONGESTION_COLORS,
    emptyFeatures,
    routeToFeatures,
    type RouteFeatureCollection,
} from "@/features/map/map.geo";
import type { MapConfig, MapPoint, MapRoute, MapStyleId } from "@/features/map/map.types";

type VietmapModule = typeof import("@vietmap/vietmap-gl-js/dist/vietmap-gl.js");

export interface MapHandle {
    zoomIn: () => void;
    zoomOut: () => void;
    resetNorth: () => void;
    flyTo: (point: MapPoint, zoom?: number) => void;
    fitBounds: (bbox: [number, number, number, number], paddingLeft?: number) => void;
    /** Hiện chấm "vị trí của tôi" và bay tới đó. */
    showMyLocation: (point: MapPoint) => void;
}

export interface MapViewport {
    zoom: number;
    lat: number;
    lng: number;
    bearing: number;
}

interface MapCanvasProps {
    config: MapConfig;
    styleId: MapStyleId;
    trafficOn: boolean;
    pin: MapPoint | null;
    from: MapPoint | null;
    to: MapPoint | null;
    routes: MapRoute[];
    activeRoute: number;
    onMapClick: (point: MapPoint) => void;
    onPinDrag: (point: MapPoint) => void;
    onViewport: (viewport: MapViewport) => void;
    onFailure: (failed: boolean) => void;
    handleRef: Ref<MapHandle>;
}

const SRC_ACTIVE = "li-route-active";
const SRC_ALT = "li-route-alt";
const LAYER_CASING = "li-route-casing";
const LAYER_ALT = "li-route-alt-line";
const LAYER_ACTIVE = "li-route-active-line";
const MARKER_ATTR = "data-map-marker";
const PIN_COLOR = "#026a4e";

let vietmapPromise: Promise<VietmapModule> | null = null;

/** Nạp GL JS một lần, chỉ trên client. Bản UMD không có `main` nên import theo đường dẫn dist. */
function loadVietmap(): Promise<VietmapModule> {
    vietmapPromise ??= import("@vietmap/vietmap-gl-js/dist/vietmap-gl.js").then(
        (mod) => ((mod as { default?: VietmapModule }).default ?? mod) as VietmapModule,
    );
    return vietmapPromise;
}

function styleUrl(config: MapConfig, id: MapStyleId): string | null {
    return (config.styles.find((style) => style.id === id) ?? config.styles[0])?.url ?? null;
}

function lineColor(): unknown[] {
    return [
        "match",
        ["get", "level"],
        "low",
        CONGESTION_COLORS.low,
        "moderate",
        CONGESTION_COLORS.moderate,
        "heavy",
        CONGESTION_COLORS.heavy,
        "severe",
        CONGESTION_COLORS.severe,
        CONGESTION_COLORS.unknown,
    ];
}

export default function MapCanvas({
    config,
    styleId,
    trafficOn,
    pin,
    from,
    to,
    routes,
    activeRoute,
    onMapClick,
    onPinDrag,
    onViewport,
    onFailure,
    handleRef,
}: MapCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<VietmapMap | null>(null);
    const libRef = useRef<VietmapModule | null>(null);
    const markersRef = useRef<{
        pin: VietmapMarker | null;
        from: VietmapMarker | null;
        to: VietmapMarker | null;
        me: VietmapMarker | null;
    }>({ pin: null, from: null, to: null, me: null });
    const trafficIdsRef = useRef<{ sources: string[]; layers: string[] }>({
        sources: [],
        layers: [],
    });
    const trafficStyleRef = useRef<Promise<{ sources: Record<string, unknown>; layers: Array<{ id: string }> } | null> | null>(null);
    const initialStyleRef = useRef(styleId);
    const appliedStyleRef = useRef(styleId);

    // Giá trị mới nhất cho trình xử lý sự kiện của bản đồ (tránh gắn lại sự kiện).
    const latest = useRef({ routes, activeRoute, trafficOn, pin, from, to, onMapClick, onPinDrag, onViewport, onFailure });
    useEffect(() => {
        latest.current = { routes, activeRoute, trafficOn, pin, from, to, onMapClick, onPinDrag, onViewport, onFailure };
    });

    useImperativeHandle(
        handleRef,
        () => ({
            zoomIn: () => mapRef.current?.zoomIn(),
            zoomOut: () => mapRef.current?.zoomOut(),
            resetNorth: () => mapRef.current?.resetNorthPitch(),
            flyTo: (point, zoom) => {
                const map = mapRef.current;
                if (!map) return;
                map.flyTo({
                    center: [point.lng, point.lat],
                    zoom: zoom ?? Math.max(map.getZoom(), 16),
                });
            },
            fitBounds: (bbox, paddingLeft = 0) => {
                mapRef.current?.fitBounds(
                    [
                        [bbox[0], bbox[1]],
                        [bbox[2], bbox[3]],
                    ],
                    { padding: { top: 80, bottom: 80, left: 80 + paddingLeft, right: 80 }, maxZoom: 17 },
                );
            },
            showMyLocation: (point) => {
                const map = mapRef.current;
                const lib = libRef.current;
                if (!map || !lib) return;
                if (!markersRef.current.me) {
                    const dot = document.createElement("div");
                    dot.setAttribute(MARKER_ATTR, "me");
                    dot.setAttribute("aria-label", "Vị trí của tôi");
                    dot.className =
                        "size-4 rounded-full border-2 border-white bg-blue-600 shadow-[0_0_0_6px_rgba(37,99,235,0.25)]";
                    markersRef.current.me = new lib.Marker({ element: dot });
                }
                markersRef.current.me.setLngLat([point.lng, point.lat]).addTo(map);
                map.flyTo({ center: [point.lng, point.lat], zoom: Math.max(map.getZoom(), 16) });
            },
        }),
        [],
    );

    function applyRoutes(map: VietmapMap): void {
        const { routes: currentRoutes, activeRoute: active } = latest.current;
        const activeData: RouteFeatureCollection = currentRoutes[active]
            ? routeToFeatures(currentRoutes[active])
            : emptyFeatures();
        const altData: RouteFeatureCollection = {
            type: "FeatureCollection",
            features: currentRoutes
                .filter((_, index) => index !== active)
                .flatMap((route) => routeToFeatures({ ...route, congestion: null }).features),
        };
        const activeSource = map.getSource(SRC_ACTIVE);
        const altSource = map.getSource(SRC_ALT);
        if (activeSource && "setData" in activeSource) {
            (activeSource as unknown as { setData: (d: unknown) => void }).setData(activeData);
        }
        if (altSource && "setData" in altSource) {
            (altSource as unknown as { setData: (d: unknown) => void }).setData(altData);
        }
    }

    function ensureRouteLayers(map: VietmapMap): void {
        if (!map.getSource(SRC_ALT)) {
            map.addSource(SRC_ALT, { type: "geojson", data: emptyFeatures() as never });
        }
        if (!map.getSource(SRC_ACTIVE)) {
            map.addSource(SRC_ACTIVE, { type: "geojson", data: emptyFeatures() as never });
        }
        const layout = { "line-cap": "round", "line-join": "round" } as const;
        if (!map.getLayer(LAYER_ALT)) {
            map.addLayer({
                id: LAYER_ALT,
                type: "line",
                source: SRC_ALT,
                layout,
                paint: { "line-color": "#6b7280", "line-width": 5, "line-opacity": 0.7 },
            });
        }
        if (!map.getLayer(LAYER_CASING)) {
            map.addLayer({
                id: LAYER_CASING,
                type: "line",
                source: SRC_ACTIVE,
                layout,
                paint: { "line-color": "#ffffff", "line-width": 10 },
            });
        }
        if (!map.getLayer(LAYER_ACTIVE)) {
            map.addLayer({
                id: LAYER_ACTIVE,
                type: "line",
                source: SRC_ACTIVE,
                layout,
                paint: { "line-color": lineColor() as never, "line-width": 6 },
            });
        }
        applyRoutes(map);
    }

    function removeTraffic(map: VietmapMap): void {
        const ids = trafficIdsRef.current;
        for (const id of ids.layers) if (map.getLayer(id)) map.removeLayer(id);
        for (const id of ids.sources) if (map.getSource(id)) map.removeSource(id);
        trafficIdsRef.current = { sources: [], layers: [] };
    }

    async function ensureTraffic(map: VietmapMap): Promise<void> {
        const url = config.trafficStyleUrl;
        if (!url || !latest.current.trafficOn || trafficIdsRef.current.layers.length) return;
        trafficStyleRef.current ??= fetch(url, { credentials: "omit" })
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null);
        const style = await trafficStyleRef.current;
        if (!style || !mapRef.current || !latest.current.trafficOn) return;
        if (trafficIdsRef.current.layers.length) return;
        const before = map.getLayer(LAYER_ALT) ? LAYER_ALT : undefined;
        for (const [id, source] of Object.entries(style.sources)) {
            if (!map.getSource(id)) map.addSource(id, source as never);
            trafficIdsRef.current.sources.push(id);
        }
        for (const layer of style.layers) {
            if (!map.getLayer(layer.id)) map.addLayer(layer as never, before);
            trafficIdsRef.current.layers.push(layer.id);
        }
    }

    // Khởi tạo bản đồ một lần cho mỗi cấu hình; hủy hoàn toàn khi rời trang (tránh rò WebGL context).
    useEffect(() => {
        const url = styleUrl(config, initialStyleRef.current);
        const container = containerRef.current;
        if (!url || !container) return;
        let cancelled = false;
        let map: VietmapMap | null = null;
        const markers = markersRef.current;

        void loadVietmap()
            .then((lib) => {
                if (cancelled) return;
                libRef.current = lib;
                map = new lib.Map({
                    container,
                    style: url,
                    center: config.center,
                    zoom: config.zoom,
                    minZoom: 4,
                    maxZoom: 20,
                    maxBounds: [
                        [config.maxBounds[0], config.maxBounds[1]],
                        [config.maxBounds[2], config.maxBounds[3]],
                    ],
                    attributionControl: { compact: true },
                    pitchWithRotate: true,
                    maxPitch: 60,
                });
                mapRef.current = map;
                appliedStyleRef.current = initialStyleRef.current;

                const report = (): void => {
                    if (!map) return;
                    const center = map.getCenter();
                    latest.current.onViewport({
                        zoom: map.getZoom(),
                        lat: center.lat,
                        lng: center.lng,
                        bearing: map.getBearing(),
                    });
                };
                const setup = (): void => {
                    if (!map) return;
                    ensureRouteLayers(map);
                    void ensureTraffic(map);
                };
                map.on("load", () => {
                    latest.current.onFailure(false);
                    setup();
                    syncMarkers();
                    report();
                });
                map.on("styledata", () => {
                    // setStyle xóa mọi nguồn/lớp tùy biến: thiếu nguồn tuyến nghĩa là style mới vừa thay vào.
                    if (!map || map.getSource(SRC_ACTIVE)) return;
                    trafficIdsRef.current = { sources: [], layers: [] };
                    try {
                        setup();
                    } catch {
                        // style chưa sẵn sàng; lần styledata kế tiếp sẽ thử lại
                    }
                });
                map.on("move", report);
                map.on("error", () => {
                    if (map && !map.isStyleLoaded()) latest.current.onFailure(true);
                });
                map.on("click", (event) => {
                    const target = event.originalEvent.target as HTMLElement | null;
                    if (target?.closest(`[${MARKER_ATTR}]`)) return;
                    latest.current.onMapClick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
                });
                map.getCanvas().style.cursor = "crosshair";
            })
            .catch(() => {
                if (!cancelled) latest.current.onFailure(true);
            });

        return () => {
            cancelled = true;
            for (const key of Object.keys(markers) as Array<keyof typeof markers>) {
                markers[key]?.remove();
                markers[key] = null;
            }
            mapRef.current = null;
            map?.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- khởi tạo theo config; style đổi bằng effect riêng
    }, [config]);

    // Đổi nền bản đồ.
    useEffect(() => {
        const map = mapRef.current;
        const url = styleUrl(config, styleId);
        if (!map || !url || appliedStyleRef.current === styleId) return;
        appliedStyleRef.current = styleId;
        map.setStyle(url);
    }, [config, styleId]);

    // Bật/tắt giao thông.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        if (trafficOn) void ensureTraffic(map);
        else removeTraffic(map);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trafficOn]);

    // Vẽ tuyến.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        ensureRouteLayers(map);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routes, activeRoute]);

    function syncMarkers(): void {
        const map = mapRef.current;
        const lib = libRef.current;
        if (!map || !lib) return;
        const { pin: pinPoint, from: fromPoint, to: toPoint } = latest.current;
        const slots: Array<["pin" | "from" | "to", MapPoint | null, string, boolean]> = [
            ["pin", pinPoint, PIN_COLOR, true],
            ["from", fromPoint, "#2563eb", false],
            ["to", toPoint, "#c0392b", false],
        ];
        for (const [slot, point, color, draggable] of slots) {
            const existing = markersRef.current[slot];
            if (!point) {
                existing?.remove();
                markersRef.current[slot] = null;
                continue;
            }
            if (existing) {
                existing.setLngLat([point.lng, point.lat]);
                continue;
            }
            const marker = new lib.Marker({ color, draggable });
            marker.getElement().setAttribute(MARKER_ATTR, slot);
            if (draggable) {
                marker.on("dragend", () => {
                    const position = marker.getLngLat();
                    latest.current.onPinDrag({ lat: position.lat, lng: position.lng });
                });
            }
            marker.setLngLat([point.lng, point.lat]).addTo(map);
            markersRef.current[slot] = marker;
        }
    }

    // Ghim và điểm đi/đến.
    useEffect(() => {
        syncMarkers();
    }, [pin, from, to]);

    // `.vietmapgl-map` đặt position:relative nên không dùng chung với absolute: bọc ngoài để giữ kích thước.
    return (
        <div className="absolute inset-0">
            <div ref={containerRef} className="h-full w-full" role="application" aria-label="Bản đồ" />
        </div>
    );
}
