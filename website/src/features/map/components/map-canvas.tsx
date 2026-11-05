"use client";

import "@vietmap/vietmap-gl-js/dist/vietmap-gl.css";

import type {
    Map as VietmapMap,
    Marker as VietmapMarker,
} from "@vietmap/vietmap-gl-js/dist/vietmap-gl.js";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

import {
    CONGESTION_COLORS,
    circleToPolygon,
    emptyFeatures,
    routeToFeatures,
    type RouteFeatureCollection,
} from "@/features/map/map.geo";
import { loadVietmap, styleUrl, type VietmapModule } from "@/features/map/map-gl";
import type { PoiFeatureCollection } from "@/features/map/hooks/use-map-overlays";
import { POI_CATEGORIES, POI_DENSE_CATEGORIES, POI_DENSE_MIN_ZOOM, POI_MIN_ZOOM, POI_STYLE, isPoiCategory, type PoiCategory } from "@/features/map/map-overlays";
import type { MapConfig, MapPoint, MapRoute, MapStyleId } from "@/features/map/map.types";


export interface MapHandle {
    zoomIn: () => void;
    zoomOut: () => void;
    resetNorth: () => void;
    flyTo: (point: MapPoint, zoom?: number) => void;
    fitBounds: (bbox: [number, number, number, number], paddingLeft?: number) => void;
    /** Hiện chấm "vị trí của tôi" và bay tới đó. */
    showMyLocation: (point: MapPoint) => void;
    /** Thả (hoặc gỡ, khi null) ghim của chuột phải, kèm hiệu ứng bật xuống. */
    dropPin: (point: MapPoint | null) => void;
    /**
     * Hiện vòng tròn phạm vi tìm kiếm. Gọi liên tục khi đang kéo/nhập bán kính; dừng một lúc thì vòng tròn mờ dần
     * rồi biến mất.
     */
    flashRadius: (center: MapPoint, radiusM: number) => void;
    /** Đặt lại camera tức thì (khi URL đổi từ bên ngoài). */
    setView: (view: Partial<MapPoint> & { zoom?: number; bearing?: number; pitch?: number }) => void;
}

export interface MapInitialView {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
}

export interface MapViewport {
    zoom: number;
    lat: number;
    lng: number;
    bearing: number;
    pitch: number;
    /** [west, south, east, north] của khung nhìn. */
    bounds: [number, number, number, number];
}

export interface ListingMarker {
    id: string;
    lat: number;
    lng: number;
    /** Nhãn giá ngắn. */
    label: string;
    title: string;
    approximate: boolean;
}

interface MapCanvasProps {
    config: MapConfig;
    initialView: MapInitialView;
    styleId: MapStyleId;
    trafficOn: boolean;
    from: MapPoint | null;
    to: MapPoint | null;
    routes: MapRoute[];
    activeRoute: number;
    /** Vòng tròn tìm lân cận (mét). */
    circle: { center: MapPoint; radiusM: number } | null;
    /** Kết quả tìm theo loại hình: mỗi kết quả một ghim nhỏ, khác ghim chính. */
    results: ReadonlyArray<{ id: string; lat: number; lng: number; name: string }>;
    /** Bấm vào một ghim kết quả. */
    onResultClick: (id: string) => void;
    /** Điểm tiện ích của các lớp đang bật (đã lọc theo nhóm). */
    pois: PoiFeatureCollection;
    onPoiClick: (poi: { category: PoiCategory; name: string; kind: string; lat: number; lng: number }) => void;
    /** Tin rao (lớp "Tin đang rao"): nhãn giá. */
    listings: readonly ListingMarker[];
    onListingClick: (id: string) => void;
    /** Chuột trái lên nền bản đồ (không trúng ghim). */
    onMapClick: (point: MapPoint) => void;
    /** Chuột phải: điểm trên bản đồ và vị trí pixel so với khung bản đồ. */
    onContextMenu: (point: MapPoint, at: { x: number; y: number }) => void;
    onViewport: (viewport: MapViewport) => void;
    onFailure: (failed: boolean) => void;
    handleRef: Ref<MapHandle>;
}

const SRC_ACTIVE = "li-route-active";
const SRC_ALT = "li-route-alt";
const LAYER_CASING = "li-route-casing";
const LAYER_ALT = "li-route-alt-line";
const LAYER_ACTIVE = "li-route-active-line";
const SRC_CIRCLE = "li-nearby-circle";
const LAYER_CIRCLE_FILL = "li-nearby-fill";
const LAYER_CIRCLE_LINE = "li-nearby-line";
const SRC_RADIUS = "li-search-radius";
const LAYER_RADIUS_FILL = "li-search-radius-fill";
const LAYER_RADIUS_LINE = "li-search-radius-line";
/** Đứng yên chừng này mili giây thì vòng tròn bắt đầu mờ; mờ trong RADIUS_FADE_MS. */
const RADIUS_IDLE_MS = 900;
const RADIUS_FADE_MS = 900;
const SRC_POIS = "li-pois";
const LAYER_POIS = "li-pois-circle";
const LAYER_POIS_DENSE = "li-pois-dense";
const POI_LAYERS = [LAYER_POIS, LAYER_POIS_DENSE];
const MARKER_ATTR = "data-map-marker";
const PIN_COLOR = "#026a4e";
const DROPPED_PIN_SRC = "/icons/map-pin.svg";


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
    initialView,
    styleId,
    trafficOn,
    from,
    to,
    routes,
    activeRoute,
    circle,
    results,
    onResultClick,
    pois,
    onPoiClick,
    listings,
    onListingClick,
    onMapClick,
    onContextMenu,
    onViewport,
    onFailure,
    handleRef,
}: MapCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<VietmapMap | null>(null);
    const libRef = useRef<VietmapModule | null>(null);
    const markersRef = useRef<{
        from: VietmapMarker | null;
        to: VietmapMarker | null;
        me: VietmapMarker | null;
        drop: VietmapMarker | null;
    }>({ from: null, to: null, me: null, drop: null });
    const trafficIdsRef = useRef<{ sources: string[]; layers: string[] }>({
        sources: [],
        layers: [],
    });
    const trafficStyleRef = useRef<Promise<{ sources: Record<string, unknown>; layers: Array<{ id: string }> } | null> | null>(null);
    const dropRef = useRef<MapPoint | null>(null);
    const radiusRef = useRef<{ center: MapPoint; radiusM: number } | null>(null);
    const radiusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resultMarkersRef = useRef<VietmapMarker[]>([]);
    const listingMarkersRef = useRef<VietmapMarker[]>([]);
    const initialStyleRef = useRef(styleId);
    const appliedStyleRef = useRef(styleId);

    // Giá trị mới nhất cho trình xử lý sự kiện của bản đồ (tránh gắn lại sự kiện).
    const latest = useRef({ routes, activeRoute, trafficOn, from, to, circle, results, onResultClick, pois, onPoiClick, listings, onListingClick, onMapClick, onContextMenu, onViewport, onFailure });
    useEffect(() => {
        latest.current = { routes, activeRoute, trafficOn, from, to, circle, results, onResultClick, pois, onPoiClick, listings, onListingClick, onMapClick, onContextMenu, onViewport, onFailure };
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
            dropPin: (point) => {
                dropRef.current = point;
                placeDrop();
            },
            flashRadius: (center, radiusM) => {
                radiusRef.current = { center, radiusM };
                const map = mapRef.current;
                if (!map) return;
                try {
                    // isStyleLoaded() là false khi tile còn đang tải: vẫn vẽ được nếu style đã có.
                    ensureRadiusLayers(map);
                    setRadiusOpacity(map, 1);
                } catch {
                    return;
                }
                if (radiusTimerRef.current) clearTimeout(radiusTimerRef.current);
                radiusTimerRef.current = setTimeout(() => {
                    radiusTimerRef.current = null;
                    const current = mapRef.current;
                    if (!current?.getLayer(LAYER_RADIUS_FILL)) return;
                    setRadiusOpacity(current, 0);
                    radiusTimerRef.current = setTimeout(() => {
                        radiusTimerRef.current = null;
                        radiusRef.current = null;
                    }, RADIUS_FADE_MS);
                }, RADIUS_IDLE_MS);
            },
            setView: (view) => {
                const map = mapRef.current;
                if (!map) return;
                map.jumpTo({
                    ...(view.lat !== undefined && view.lng !== undefined ? { center: [view.lng, view.lat] as [number, number] } : {}),
                    ...(view.zoom !== undefined ? { zoom: view.zoom } : {}),
                    ...(view.bearing !== undefined ? { bearing: view.bearing } : {}),
                    ...(view.pitch !== undefined ? { pitch: view.pitch } : {}),
                });
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

    /** Đặt ghim thả tại điểm đã yêu cầu; tạo phần tử mới để hiệu ứng rơi chạy lại. */
    function placeDrop(): void {
        const map = mapRef.current;
        const lib = libRef.current;
        markersRef.current.drop?.remove();
        markersRef.current.drop = null;
        const point = dropRef.current;
        if (!point || !map || !lib) return;
        const element = document.createElement("div");
        element.setAttribute(MARKER_ATTR, "drop");
        element.setAttribute("role", "img");
        element.setAttribute("aria-label", "Điểm đã chọn");
        element.className = "h-10 w-10";
        const image = document.createElement("img");
        image.src = DROPPED_PIN_SRC;
        image.alt = "";
        image.draggable = false;
        image.className = "map-pin-drop pointer-events-none h-full w-full";
        element.append(image);
        markersRef.current.drop = new lib.Marker({ element, anchor: "bottom" })
            .setLngLat([point.lng, point.lat])
            .addTo(map);
    }

    function ensureCircleLayers(map: VietmapMap): void {
        const circleNow = latest.current.circle;
        const data = (circleNow ? circleToPolygon(circleNow.center, circleNow.radiusM) : emptyFeatures()) as never;
        const source = map.getSource(SRC_CIRCLE);
        if (source && "setData" in source) {
            (source as unknown as { setData: (d: unknown) => void }).setData(data);
            return;
        }
        map.addSource(SRC_CIRCLE, { type: "geojson", data });
        map.addLayer({ id: LAYER_CIRCLE_FILL, type: "fill", source: SRC_CIRCLE, paint: { "fill-color": PIN_COLOR, "fill-opacity": 0.12 } });
        map.addLayer({ id: LAYER_CIRCLE_LINE, type: "line", source: SRC_CIRCLE, paint: { "line-color": PIN_COLOR, "line-width": 2, "line-dasharray": [2, 1] } });
    }

    /** Vòng tròn phạm vi tìm kiếm; độ mờ có transition để mờ dần. */
    function ensureRadiusLayers(map: VietmapMap): void {
        const current = radiusRef.current;
        const data = (current ? circleToPolygon(current.center, current.radiusM) : emptyFeatures()) as never;
        const source = map.getSource(SRC_RADIUS);
        if (source && "setData" in source) {
            (source as unknown as { setData: (d: unknown) => void }).setData(data);
            return;
        }
        map.addSource(SRC_RADIUS, { type: "geojson", data });
        const transition = { duration: RADIUS_FADE_MS, delay: 0 };
        map.addLayer({
            id: LAYER_RADIUS_FILL,
            type: "fill",
            source: SRC_RADIUS,
            paint: { "fill-color": PIN_COLOR, "fill-opacity": 0, "fill-opacity-transition": transition },
        });
        map.addLayer({
            id: LAYER_RADIUS_LINE,
            type: "line",
            source: SRC_RADIUS,
            paint: { "line-color": PIN_COLOR, "line-width": 2, "line-opacity": 0, "line-opacity-transition": transition },
        });
    }

    /** Hiện lên gần như tức thì, mờ đi chậm. */
    function setRadiusOpacity(map: VietmapMap, value: 0 | 1): void {
        if (!map.getLayer(LAYER_RADIUS_FILL)) return;
        const transition = { duration: value === 1 ? 120 : RADIUS_FADE_MS, delay: 0 };
        map.setPaintProperty(LAYER_RADIUS_FILL, "fill-opacity-transition", transition);
        map.setPaintProperty(LAYER_RADIUS_LINE, "line-opacity-transition", transition);
        map.setPaintProperty(LAYER_RADIUS_FILL, "fill-opacity", value * 0.12);
        map.setPaintProperty(LAYER_RADIUS_LINE, "line-opacity", value * 0.9);
    }

    /** Ghim kết quả: chấm tròn đỏ có viền trắng, nhỏ hơn ghim chính; bấm để mở thẻ Địa điểm. */
    function syncResults(): void {
        const map = mapRef.current;
        const lib = libRef.current;
        for (const marker of resultMarkersRef.current) marker.remove();
        resultMarkersRef.current = [];
        if (!map || !lib) return;
        latest.current.results.forEach((result, index) => {
            const element = document.createElement("button");
            element.type = "button";
            element.setAttribute(MARKER_ATTR, "result");
            element.setAttribute("aria-label", `Kết quả ${index + 1}: ${result.name}`);
            element.title = result.name;
            element.className =
                "map-result-pin flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#c0392b] p-0 text-[11px] font-bold text-white shadow-[0_2px_6px_rgba(16,17,17,0.35)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c0392b]";
            element.textContent = String(index + 1);
            element.addEventListener("click", (event) => {
                event.stopPropagation();
                latest.current.onResultClick(result.id);
            });
            resultMarkersRef.current.push(new lib.Marker({ element }).setLngLat([result.lng, result.lat]).addTo(map));
        });
    }

    /** Lớp điểm tiện ích: chấm tròn màu theo nhóm, viền trắng, to dần theo zoom. Nằm dưới tuyến đường. */
    function ensurePoiLayers(map: VietmapMap): void {
        const data = latest.current.pois as never;
        const source = map.getSource(SRC_POIS);
        if (source && "setData" in source) {
            (source as unknown as { setData: (d: unknown) => void }).setData(data);
            return;
        }
        map.addSource(SRC_POIS, { type: "geojson", data });
        const color: unknown[] = ["match", ["get", "category"]];
        for (const category of POI_CATEGORIES) color.push(category, POI_STYLE[category].color);
        color.push("#64748b");
        const paint = {
            "circle-color": color as never,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 3.5, 16, 6, 18, 8] as never,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 13, 1, 16, 1.75] as never,
        };
        const dense = ["in", ["get", "category"], ["literal", [...POI_DENSE_CATEGORIES]]];
        // Nhóm dày đặc (quán ăn, xe buýt) chỉ hiện khi đã phóng to hơn để bản đồ không rối.
        map.addLayer({ id: LAYER_POIS, type: "circle", source: SRC_POIS, minzoom: POI_MIN_ZOOM, filter: ["!", dense] as never, paint });
        map.addLayer({ id: LAYER_POIS_DENSE, type: "circle", source: SRC_POIS, minzoom: POI_DENSE_MIN_ZOOM, filter: dense as never, paint });
    }

    /** Tin rao: nhãn giá dạng viên thuốc, có mũi nhọn chỉ xuống điểm; tin vị trí gần đúng nền nhạt hơn. */
    function syncListings(): void {
        const map = mapRef.current;
        const lib = libRef.current;
        for (const marker of listingMarkersRef.current) marker.remove();
        listingMarkersRef.current = [];
        if (!map || !lib) return;
        for (const item of latest.current.listings) {
            const element = document.createElement("button");
            element.type = "button";
            element.setAttribute(MARKER_ATTR, "listing");
            element.setAttribute("aria-label", `Tin rao ${item.title}, giá ${item.label}${item.approximate ? ", vị trí gần đúng" : ""}`);
            element.title = item.approximate ? `${item.title} (vị trí gần đúng)` : item.title;
            element.className = `map-listing-pin cursor-pointer rounded-full border-2 border-white px-2 py-0.5 text-[11px] leading-4 font-bold whitespace-nowrap text-cream shadow-[0_2px_6px_rgba(16,17,17,0.3)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${item.approximate ? "bg-green/80" : "bg-green"}`;
            element.textContent = item.label;
            const tip = document.createElement("span");
            tip.setAttribute("aria-hidden", "true");
            tip.className = "absolute top-full left-1/2 -mt-px -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-green";
            element.append(tip);
            element.addEventListener("click", (event) => {
                event.stopPropagation();
                latest.current.onListingClick(item.id);
            });
            listingMarkersRef.current.push(new lib.Marker({ element, anchor: "bottom" }).setLngLat([item.lng, item.lat]).addTo(map));
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
        let onContextMenu: ((event: MouseEvent) => void) | null = null;
        const markers = markersRef.current;

        void loadVietmap()
            .then((lib) => {
                if (cancelled) return;
                libRef.current = lib;
                map = new lib.Map({
                    container,
                    style: url,
                    center: initialView.center,
                    zoom: initialView.zoom,
                    bearing: initialView.bearing,
                    pitch: initialView.pitch,
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
                    const box = map.getBounds();
                    latest.current.onViewport({
                        zoom: map.getZoom(),
                        lat: center.lat,
                        lng: center.lng,
                        bearing: map.getBearing(),
                        pitch: map.getPitch(),
                        bounds: [box.getWest(), box.getSouth(), box.getEast(), box.getNorth()],
                    });
                };
                const setup = (): void => {
                    if (!map) return;
                    ensurePoiLayers(map);
                    ensureCircleLayers(map);
                    ensureRadiusLayers(map);
                    ensureRouteLayers(map);
                    void ensureTraffic(map);
                };
                map.on("load", () => {
                    latest.current.onFailure(false);
                    setup();
                    syncMarkers();
                    syncResults();
                    syncListings();
                    placeDrop();
                    report();
                });
                map.on("styledata", () => {
                    // setStyle xóa mọi nguồn/lớp tùy biến: thiếu nguồn tuyến nghĩa là style mới vừa thay vào.
                    if (!map || map.getSource(SRC_ACTIVE) || map.getSource(SRC_CIRCLE) || map.getSource(SRC_POIS)) return;
                    trafficIdsRef.current = { sources: [], layers: [] };
                    try {
                        setup();
                    } catch {
                        // style chưa sẵn sàng; lần styledata kế tiếp sẽ thử lại
                    }
                });
                map.on("move", report);
                for (const layer of POI_LAYERS) {
                    map.on("mouseenter", layer, () => {
                        if (map) map.getCanvas().style.cursor = "pointer";
                    });
                    map.on("mouseleave", layer, () => {
                        if (map) map.getCanvas().style.cursor = "crosshair";
                    });
                }
                map.on("error", () => {
                    if (map && !map.isStyleLoaded()) latest.current.onFailure(true);
                });
                map.on("click", (event) => {
                    const target = event.originalEvent.target as HTMLElement | null;
                    if (target?.closest(`[${MARKER_ATTR}]`)) return;
                    if (map?.getLayer(LAYER_POIS)) {
                        const hit = map.queryRenderedFeatures(event.point, { layers: POI_LAYERS })[0];
                        const props = hit?.properties as { category?: string; name?: string; kind?: string } | undefined;
                        const geometry = hit?.geometry as { type: string; coordinates: [number, number] } | undefined;
                        if (props?.category && isPoiCategory(props.category) && geometry?.type === "Point") {
                            latest.current.onPoiClick({
                                category: props.category,
                                name: props.name ?? "",
                                kind: props.kind ?? "",
                                lat: geometry.coordinates[1],
                                lng: geometry.coordinates[0],
                            });
                            return;
                        }
                    }
                    latest.current.onMapClick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
                });
                onContextMenu = (event: MouseEvent): void => {
                    event.preventDefault();
                    if (!map || event.target !== map.getCanvas()) return;
                    const canvas = map.getCanvas();
                    const rect = canvas.getBoundingClientRect();
                    const point = map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
                    latest.current.onContextMenu(
                        { lat: point.lat, lng: point.lng },
                        { x: event.clientX - rect.left, y: event.clientY - rect.top },
                    );
                };
                container.addEventListener("contextmenu", onContextMenu);
                map.getCanvas().style.cursor = "crosshair";
            })
            .catch(() => {
                if (!cancelled) latest.current.onFailure(true);
            });

        return () => {
            cancelled = true;
            if (onContextMenu) container.removeEventListener("contextmenu", onContextMenu);
            for (const key of Object.keys(markers) as Array<keyof typeof markers>) {
                markers[key]?.remove();
                markers[key] = null;
            }
            for (const marker of resultMarkersRef.current) marker.remove();
            resultMarkersRef.current = [];
            for (const marker of listingMarkersRef.current) marker.remove();
            listingMarkersRef.current = [];
            if (radiusTimerRef.current) clearTimeout(radiusTimerRef.current);
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

    // Vòng tròn tìm lân cận.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        ensureCircleLayers(map);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [circle]);

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
        const { from: fromPoint, to: toPoint } = latest.current;
        const slots: Array<["from" | "to", MapPoint | null, string]> = [
            ["from", fromPoint, "#2563eb"],
            ["to", toPoint, "#c0392b"],
        ];
        for (const [slot, point, color] of slots) {
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
            const marker = new lib.Marker({ color });
            marker.getElement().setAttribute(MARKER_ATTR, slot);
            marker.setLngLat([point.lng, point.lat]).addTo(map);
            markersRef.current[slot] = marker;
        }
    }

    // Lớp điểm tiện ích.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        try {
            ensurePoiLayers(map);
        } catch {
            // style chưa sẵn sàng: lần "load"/"styledata" sẽ vẽ
        }
    }, [pois]);

    // Tin rao.
    useEffect(() => {
        syncListings();
    }, [listings]);

    // Ghim kết quả tìm theo loại hình.
    useEffect(() => {
        syncResults();
    }, [results]);

    // Ghim và điểm đi/đến.
    useEffect(() => {
        syncMarkers();
    }, [from, to]);

    // `.vietmapgl-map` đặt position:relative nên không dùng chung với absolute: bọc ngoài để giữ kích thước.
    return (
        <div className="absolute inset-0">
            <div ref={containerRef} className="h-full w-full" role="application" aria-label="Bản đồ" />
        </div>
    );
}
