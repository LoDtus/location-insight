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
import { POI_CATEGORIES, POI_MIN_ZOOM, POI_STYLE, isPoiCategory, type PoiCategory } from "@/features/map/map-overlays";
import type { EvidenceOverlay } from "@/features/map/evidence-overlay";
import type { MapConfig, MapPoint, MapRoute, MapStyleId } from "@/features/map/map.types";


export interface MapHandle {
    zoomIn: () => void;
    zoomOut: () => void;
    resetNorth: () => void;
    flyTo: (point: MapPoint, zoom?: number) => void;
    /** `inset`: phần khung bị panel che (px) để đưa nội dung vào vùng còn thấy. */
    fitBounds: (bbox: [number, number, number, number], paddingLeft?: number, inset?: { right?: number; bottom?: number }) => void;
    /** Hiện chấm "vị trí của tôi" và bay tới đó. */
    showMyLocation: (point: MapPoint) => void;
    /** Thả (hoặc gỡ, khi null) ghim của chuột phải, kèm hiệu ứng bật xuống. */
    dropPin: (point: MapPoint | null) => void;
    /**
     * Hiện vòng tròn phạm vi tìm kiếm. Gọi liên tục khi đang kéo/nhập bán kính; dừng một lúc thì vòng tròn mờ dần
     * rồi biến mất.
     */
    flashRadius: (center: MapPoint, radiusM: number) => void;
    /** Phóng mượt tới mức zoom, giữ nguyên tâm. */
    zoomTo: (zoom: number) => void;
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
    /** Điểm tiện ích của các lớp đang bật (đã lọc theo nhóm). */
    pois: PoiFeatureCollection;
    onPoiClick: (poi: { category: PoiCategory; name: string; kind: string; lat: number; lng: number }) => void;
    /** Điểm tiện ích đang mở thẻ Địa điểm: vẽ vòng nhấn quanh chấm thay vì thả thêm một ghim đè lên. */
    activePoi?: { lat: number; lng: number } | null;
    /** Tin rao (lớp "Tin đang rao"): nhãn giá. */
    listings: readonly ListingMarker[];
    onListingClick: (id: string) => void;
    /** Chuột trái lên nền bản đồ (không trúng ghim). */
    onMapClick: (point: MapPoint) => void;
    /** Chuột phải: điểm trên bản đồ và vị trí pixel so với khung bản đồ. */
    onContextMenu: (point: MapPoint, at: { x: number; y: number }) => void;
    /**
     * Bấm (trái hoặc phải) lên chấm "vị trí của tôi" hoặc ghim kết quả: mở menu tại ghim đó. `id` là mã kết quả
     * (chỉ có với ghim kết quả).
     */
    onMarkerMenu: (target: { kind: "me" | "result"; id?: string; point: MapPoint; at: { x: number; y: number } }) => void;
    /** Ghim kết quả đang xem (được làm nổi bật). */
    activeResultId: string | null;
    onViewport: (viewport: MapViewport) => void;
    onFailure: (failed: boolean) => void;
    /** Dẫn chứng của tiêu chí đang chọn trong bảng đánh giá (evidence-overlay.ts). */
    evidence?: EvidenceOverlay | null;
    /** Bấm ghim lựa chọn số `choice` (0 = gần nhất) để đổi tuyến dẫn chứng. */
    onEvidencePick?: (choice: number) => void;
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
const SRC_POI_ACTIVE = "li-poi-active";
const LAYER_POI_ACTIVE = "li-poi-active-ring";
const LAYER_POIS = "li-pois-circle";
const LAYER_POI_CLUSTERS = "li-pois-cluster";
const LAYER_POI_COUNTS = "li-pois-cluster-count";
const POI_LAYERS = [LAYER_POIS];
/** Điểm tiện ích gom cụm tới zoom này; phóng to hơn thì tách hết. */
const POI_CLUSTER_MAX_ZOOM = 15;
/** Tin rao gom cụm khi zoom dưới mức này (ô lưới ~56 px theo zoom nguyên để kéo bản đồ không đổi cụm). */
const LISTING_CLUSTER_MAX_ZOOM = 15;
const LISTING_CLUSTER_CELL_PX = 56;
/** Chỉ tạo nhãn tin rao trong khung nhìn nới thêm chừng này (tỷ lệ mỗi cạnh). */
const LISTING_VIEW_PADDING = 0.25;
const SRC_EVIDENCE = "li-evidence";
const LAYER_EVIDENCE_FILL = "li-evidence-fill";
const LAYER_EVIDENCE_OUTLINE = "li-evidence-outline";
const LAYER_EVIDENCE_ROAD = "li-evidence-road";
const LAYER_EVIDENCE_CASING = "li-evidence-route-casing";
const LAYER_EVIDENCE_ROUTE = "li-evidence-route";
const LAYER_EVIDENCE_CONNECTOR = "li-evidence-connector";
const LAYER_EVIDENCE_POINTS = "li-evidence-points";
/** Nhãn cho chấm phụ chỉ khi ít chấm (ứng viên bệnh viện); nhiều chấm (quán ăn) thì chỉ có title. */
const EVIDENCE_LABEL_MAX = 5;
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
    pois,
    onPoiClick,
    activePoi = null,
    listings,
    onListingClick,
    onMapClick,
    onContextMenu,
    onMarkerMenu,
    activeResultId,
    onViewport,
    onFailure,
    evidence = null,
    onEvidencePick,
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
    const resultMarkersRef = useRef<Array<{ id: string; marker: VietmapMarker }>>([]);
    const listingMarkersRef = useRef<Map<string, VietmapMarker>>(new Map());
    const evidenceRef = useRef<EvidenceOverlay | null>(evidence);
    const evidenceMarkersRef = useRef<VietmapMarker[]>([]);
    const evidencePickRef = useRef(onEvidencePick);
    useEffect(() => {
        evidencePickRef.current = onEvidencePick;
    }, [onEvidencePick]);
    const initialStyleRef = useRef(styleId);
    const appliedStyleRef = useRef(styleId);

    // Giá trị mới nhất cho trình xử lý sự kiện của bản đồ (tránh gắn lại sự kiện).
    const latest = useRef({ routes, activeRoute, trafficOn, from, to, circle, results, pois, activePoi, onPoiClick, listings, onListingClick, onMapClick, onContextMenu, onMarkerMenu, activeResultId, onViewport, onFailure });
    useEffect(() => {
        latest.current = { routes, activeRoute, trafficOn, from, to, circle, results, pois, activePoi, onPoiClick, listings, onListingClick, onMapClick, onContextMenu, onMarkerMenu, activeResultId, onViewport, onFailure };
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
            fitBounds: (bbox, paddingLeft = 0, inset = {}) => {
                mapRef.current?.fitBounds(
                    [
                        [bbox[0], bbox[1]],
                        [bbox[2], bbox[3]],
                    ],
                    { padding: { top: 80, bottom: 80 + (inset.bottom ?? 0), left: 80 + paddingLeft, right: 80 + (inset.right ?? 0) }, maxZoom: 17 },
                );
            },
            dropPin: (point) => {
                dropRef.current = point;
                placeDrop();
            },
            zoomTo: (zoom) => {
                mapRef.current?.easeTo({ zoom });
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
                    const dot = document.createElement("button");
                    dot.type = "button";
                    dot.setAttribute(MARKER_ATTR, "me");
                    dot.setAttribute("aria-label", "Vị trí của tôi: mở menu thao tác");
                    dot.title = "Vị trí của tôi";
                    dot.className =
                        "size-4 cursor-pointer rounded-full border-2 border-white bg-blue-600 p-0 shadow-[0_0_0_6px_rgba(37,99,235,0.25)] hover:shadow-[0_0_0_8px_rgba(37,99,235,0.3)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600";
                    attachMarkerMenu(dot, "me");
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

    /** Chuột trái và chuột phải lên một ghim (vị trí của tôi, kết quả) đều mở menu tại ghim đó. */
    function attachMarkerMenu(element: HTMLElement, kind: "me" | "result", id?: string): void {
        const open = (event: MouseEvent): void => {
            event.preventDefault();
            event.stopPropagation();
            const map = mapRef.current;
            const marker = kind === "me" ? markersRef.current.me : resultMarkersRef.current.find((item) => item.id === id)?.marker;
            if (!map || !marker) return;
            const lngLat = marker.getLngLat();
            const projected = map.project(lngLat);
            latest.current.onMarkerMenu({ kind, id, point: { lat: lngLat.lat, lng: lngLat.lng }, at: { x: projected.x, y: projected.y } });
        };
        element.addEventListener("click", open);
        element.addEventListener("contextmenu", open);
    }

    /** Ghim kết quả: chấm tròn đỏ đánh số; ghim đang xem to hơn, viền đậm và nằm trên cùng. */
    function syncResults(): void {
        const map = mapRef.current;
        const lib = libRef.current;
        for (const item of resultMarkersRef.current) item.marker.remove();
        resultMarkersRef.current = [];
        if (!map || !lib) return;
        latest.current.results.forEach((result, index) => {
            const element = document.createElement("button");
            element.type = "button";
            element.setAttribute(MARKER_ATTR, "result");
            element.setAttribute("aria-label", `Kết quả ${index + 1}: ${result.name}. Mở menu thao tác`);
            element.title = result.name;
            element.textContent = String(index + 1);
            attachMarkerMenu(element, "result", result.id);
            const marker = new lib.Marker({ element }).setLngLat([result.lng, result.lat]).addTo(map);
            resultMarkersRef.current.push({ id: result.id, marker });
        });
        styleResults();
    }

    function styleResults(): void {
        const active = latest.current.activeResultId;
        for (const { id, marker } of resultMarkersRef.current) {
            const element = marker.getElement();
            const on = id === active;
            element.className = `map-result-pin flex cursor-pointer items-center justify-center rounded-full border-2 border-white p-0 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c0392b] ${
                on
                    ? "size-9 bg-[#a93226] text-sm shadow-[0_0_0_4px_rgba(192,57,43,0.3),0_4px_10px_rgba(16,17,17,0.4)]"
                    : "size-7 bg-[#c0392b] text-[11px] shadow-[0_2px_6px_rgba(16,17,17,0.35)] hover:brightness-110"
            }`;
            element.setAttribute("aria-current", on ? "true" : "false");
            element.style.zIndex = on ? "3" : "1";
        }
    }

    /** Phông chữ cho số trên cụm: lấy từ một lớp chữ có sẵn của style Vietmap (style tự chọn phông). */
    function styleFont(map: VietmapMap): string[] | null {
        for (const layer of map.getStyle()?.layers ?? []) {
            if (layer.type !== "symbol") continue;
            const font = map.getLayoutProperty(layer.id, "text-font") as unknown;
            if (Array.isArray(font) && font.every((item) => typeof item === "string")) return font as string[];
        }
        return null;
    }

    /**
     * Lớp điểm tiện ích: nguồn GeoJSON gom cụm (đến zoom 15). Cụm là chấm xám đậm có số; điểm lẻ là chấm màu theo
     * nhóm. Chỉ có dữ liệu của các ô trong khung nhìn (tải lười theo ô ở hook), nên không vẽ điểm ngoài màn hình.
     */
    function activePoiData(): unknown {
        const point = latest.current.activePoi;
        return {
            type: "FeatureCollection",
            features: point ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [point.lng, point.lat] } }] : [],
        };
    }

    /** Vòng nhấn quanh điểm tiện ích đang chọn (nằm trên lớp điểm, không bắt sự kiện bấm). */
    function ensureActivePoi(map: VietmapMap): void {
        const source = map.getSource(SRC_POI_ACTIVE);
        if (source && "setData" in source) {
            (source as unknown as { setData: (d: unknown) => void }).setData(activePoiData());
            return;
        }
        map.addSource(SRC_POI_ACTIVE, { type: "geojson", data: activePoiData() } as never);
        map.addLayer({
            id: LAYER_POI_ACTIVE,
            type: "circle",
            source: SRC_POI_ACTIVE,
            paint: {
                "circle-color": "rgba(0,0,0,0)",
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 8, 16, 11, 18, 13] as never,
                "circle-stroke-color": "#0f172a",
                "circle-stroke-width": 3,
            },
        });
    }

    function ensurePoiLayers(map: VietmapMap): void {
        const data = latest.current.pois as never;
        const source = map.getSource(SRC_POIS);
        if (source && "setData" in source) {
            (source as unknown as { setData: (d: unknown) => void }).setData(data);
            return;
        }
        map.addSource(SRC_POIS, { type: "geojson", data, cluster: true, clusterRadius: 44, clusterMaxZoom: POI_CLUSTER_MAX_ZOOM } as never);
        const color: unknown[] = ["match", ["get", "category"]];
        for (const category of POI_CATEGORIES) color.push(category, POI_STYLE[category].color);
        color.push("#64748b");
        map.addLayer({
            id: LAYER_POI_CLUSTERS,
            type: "circle",
            source: SRC_POIS,
            minzoom: POI_MIN_ZOOM,
            filter: ["has", "point_count"] as never,
            paint: {
                "circle-color": "#334155",
                "circle-opacity": 0.88,
                "circle-radius": ["step", ["get", "point_count"], 11, 10, 14, 50, 18, 200, 22] as never,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
            },
        });
        const font = styleFont(map);
        if (font) {
            map.addLayer({
                id: LAYER_POI_COUNTS,
                type: "symbol",
                source: SRC_POIS,
                minzoom: POI_MIN_ZOOM,
                filter: ["has", "point_count"] as never,
                layout: { "text-field": ["get", "point_count_abbreviated"] as never, "text-font": font, "text-size": 11, "text-allow-overlap": true },
                paint: { "text-color": "#ffffff" },
            });
        }
        map.addLayer({
            id: LAYER_POIS,
            type: "circle",
            source: SRC_POIS,
            minzoom: POI_MIN_ZOOM,
            filter: ["!", ["has", "point_count"]] as never,
            paint: {
                "circle-color": color as never,
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 4, 16, 6, 18, 8] as never,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 13, 1.25, 16, 1.75] as never,
            },
        });
    }

    /**
     * Tin rao: chỉ tạo nhãn cho tin trong khung nhìn (nới thêm một phần), gom cụm theo lưới ở zoom thấp. So khớp theo
     * khóa nên nhãn đã có giữ nguyên chỗ (không xóa đi vẽ lại), tránh nháy khi kéo, phóng to hay bật lớp khác.
     */
    function syncListings(): void {
        const map = mapRef.current;
        const lib = libRef.current;
        if (!map || !lib) return;
        const wanted = new Map<string, { lng: number; lat: number; build: () => HTMLElement }>();
        const items = latest.current.listings;
        if (items.length > 0) {
            const bounds = map.getBounds();
            const padLng = (bounds.getEast() - bounds.getWest()) * LISTING_VIEW_PADDING;
            const padLat = (bounds.getNorth() - bounds.getSouth()) * LISTING_VIEW_PADDING;
            const visible = items.filter(
                (item) =>
                    item.lng >= bounds.getWest() - padLng &&
                    item.lng <= bounds.getEast() + padLng &&
                    item.lat >= bounds.getSouth() - padLat &&
                    item.lat <= bounds.getNorth() + padLat,
            );
            const zoom = Math.floor(map.getZoom());
            if (zoom >= LISTING_CLUSTER_MAX_ZOOM) {
                for (const item of visible) wanted.set(`l:${item.id}`, { lng: item.lng, lat: item.lat, build: () => listingElement(item) });
            } else {
                // Lưới theo tọa độ thế giới ở zoom nguyên: kéo bản đồ không làm đổi cụm.
                const world = 512 * 2 ** zoom;
                const cells = new Map<string, ListingMarker[]>();
                for (const item of visible) {
                    const x = ((item.lng + 180) / 360) * world;
                    const sin = Math.sin((item.lat * Math.PI) / 180);
                    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world;
                    const key = `${Math.floor(x / LISTING_CLUSTER_CELL_PX)}:${Math.floor(y / LISTING_CLUSTER_CELL_PX)}`;
                    cells.set(key, [...(cells.get(key) ?? []), item]);
                }
                for (const [cell, members] of cells) {
                    if (members.length === 1) {
                        const item = members[0];
                        wanted.set(`l:${item.id}`, { lng: item.lng, lat: item.lat, build: () => listingElement(item) });
                        continue;
                    }
                    const lng = members.reduce((sum, item) => sum + item.lng, 0) / members.length;
                    const lat = members.reduce((sum, item) => sum + item.lat, 0) / members.length;
                    wanted.set(`c:${zoom}:${cell}:${members.length}`, { lng, lat, build: () => listingClusterElement(members) });
                }
            }
        }
        const current = listingMarkersRef.current;
        for (const [key, marker] of current) {
            if (!wanted.has(key)) {
                marker.remove();
                current.delete(key);
            }
        }
        for (const [key, entry] of wanted) {
            if (current.has(key)) continue;
            const element = entry.build();
            const anchor = key.startsWith("l:") ? "bottom" : "center";
            current.set(key, new lib.Marker({ element, anchor }).setLngLat([entry.lng, entry.lat]).addTo(map));
        }
    }

    function listingElement(item: ListingMarker): HTMLElement {
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
        return element;
    }

    /** Cụm tin rao: vòng xanh có số; bấm thì phóng vào vùng của cụm. */
    function listingClusterElement(members: ListingMarker[]): HTMLElement {
        const element = document.createElement("button");
        element.type = "button";
        element.setAttribute(MARKER_ATTR, "listing-cluster");
        element.setAttribute("aria-label", `${members.length} tin rao ở gần nhau. Phóng to để xem`);
        element.title = `${members.length} tin rao`;
        element.className =
            "flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-green p-0 text-xs font-bold text-cream shadow-[0_0_0_4px_rgba(2,106,78,0.25),0_2px_6px_rgba(16,17,17,0.3)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";
        element.textContent = String(members.length);
        element.addEventListener("click", (event) => {
            event.stopPropagation();
            const map = mapRef.current;
            if (!map) return;
            const lngs = members.map((item) => item.lng);
            const lats = members.map((item) => item.lat);
            map.fitBounds(
                [
                    [Math.min(...lngs), Math.min(...lats)],
                    [Math.max(...lngs), Math.max(...lats)],
                ],
                { padding: 80, maxZoom: LISTING_CLUSTER_MAX_ZOOM },
            );
        });
        return element;
    }

    /** GeoJSON của dẫn chứng: vùng (vòng ngưỡng, ô lưới), đường (tuyến thật, nét nối), chấm phụ. */
    function evidenceData(): unknown {
        const overlay = evidenceRef.current;
        if (!overlay) return emptyFeatures();
        return {
            type: "FeatureCollection",
            features: [
                ...overlay.areas.map((area) => ({
                    type: "Feature",
                    properties: { kind: "area", color: area.color, opacity: area.opacity, outline: area.outline },
                    geometry: { type: "Polygon", coordinates: [area.ring] },
                })),
                ...overlay.lines.map((line) => ({
                    type: "Feature",
                    properties: { kind: line.style, color: line.color },
                    geometry: { type: "LineString", coordinates: line.coordinates },
                })),
                ...overlay.points
                    .filter((point) => point.emphasis === "other")
                    .map((point) => ({
                        type: "Feature",
                        properties: { kind: "point", color: point.color, weight: point.weight },
                        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
                    })),
            ],
        };
    }

    function ensureEvidenceLayers(map: VietmapMap): void {
        const data = evidenceData() as never;
        const source = map.getSource(SRC_EVIDENCE);
        if (source && "setData" in source) {
            (source as unknown as { setData: (d: unknown) => void }).setData(data);
            return;
        }
        map.addSource(SRC_EVIDENCE, { type: "geojson", data });
        const color = ["get", "color"] as never;
        map.addLayer({
            id: LAYER_EVIDENCE_FILL,
            type: "fill",
            source: SRC_EVIDENCE,
            filter: ["==", ["get", "kind"], "area"] as never,
            paint: { "fill-color": color, "fill-opacity": ["get", "opacity"] as never },
        });
        map.addLayer({
            id: LAYER_EVIDENCE_OUTLINE,
            type: "line",
            source: SRC_EVIDENCE,
            filter: ["all", ["==", ["get", "kind"], "area"], ["==", ["get", "outline"], true]] as never,
            paint: { "line-color": color, "line-width": 2, "line-dasharray": [2, 1.5], "line-opacity": 0.8 },
        });
        const layout = { "line-cap": "round", "line-join": "round" } as const;
        // Hình dạng đường làm dẫn chứng (đường lớn, đường trục): nét dày bán trong suốt, nằm dưới tuyến đi.
        map.addLayer({
            id: LAYER_EVIDENCE_ROAD,
            type: "line",
            source: SRC_EVIDENCE,
            filter: ["==", ["get", "kind"], "road"] as never,
            layout,
            paint: { "line-color": color, "line-width": 8, "line-opacity": 0.6 },
        });
        map.addLayer({
            id: LAYER_EVIDENCE_CASING,
            type: "line",
            source: SRC_EVIDENCE,
            filter: ["==", ["get", "kind"], "route"] as never,
            layout,
            paint: { "line-color": "#ffffff", "line-width": 9 },
        });
        map.addLayer({
            id: LAYER_EVIDENCE_ROUTE,
            type: "line",
            source: SRC_EVIDENCE,
            filter: ["==", ["get", "kind"], "route"] as never,
            layout,
            paint: { "line-color": color, "line-width": 5 },
        });
        map.addLayer({
            id: LAYER_EVIDENCE_CONNECTOR,
            type: "line",
            source: SRC_EVIDENCE,
            filter: ["==", ["get", "kind"], "connector"] as never,
            layout,
            paint: { "line-color": color, "line-width": 3, "line-dasharray": [1, 2] },
        });
        map.addLayer({
            id: LAYER_EVIDENCE_POINTS,
            type: "circle",
            source: SRC_EVIDENCE,
            filter: ["==", ["get", "kind"], "point"] as never,
            paint: {
                "circle-color": color,
                "circle-opacity": ["get", "weight"] as never,
                "circle-radius": 6,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5,
            },
        });
    }

    /**
     * Ghim có nhãn (lựa chọn đang chọn và các lựa chọn khác khi ít), dạng DOM để chữ rõ trên mọi nền. Lựa chọn có
     * `choice` là nút: bấm để đổi tuyến sang lựa chọn đó.
     */
    function syncEvidenceMarkers(): void {
        const map = mapRef.current;
        const lib = libRef.current;
        for (const marker of evidenceMarkersRef.current) marker.remove();
        evidenceMarkersRef.current = [];
        const overlay = evidenceRef.current;
        if (!map || !lib || !overlay) return;
        const labelled = overlay.points.filter(
            (point) => point.label && (point.emphasis === "target" || overlay.points.length <= EVIDENCE_LABEL_MAX),
        );
        for (const point of labelled) {
            const target = point.emphasis === "target";
            const clickable = point.choice !== null && !target;
            const element = document.createElement(clickable ? "button" : "div");
            element.setAttribute(MARKER_ATTR, "evidence");
            if (clickable && element instanceof HTMLButtonElement) {
                element.type = "button";
                element.setAttribute("aria-label", `Xem đường tới ${point.label ?? ""}`);
                element.title = "Xem đường tới lựa chọn này";
                element.addEventListener("click", (event) => {
                    event.stopPropagation();
                    if (point.choice !== null) evidencePickRef.current?.(point.choice);
                });
            } else {
                element.setAttribute("role", "img");
                element.setAttribute("aria-label", point.label ?? "");
            }
            element.className = `flex flex-col items-center border-0 bg-transparent p-0 ${clickable ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green" : "pointer-events-none"}`;
            const chip = document.createElement("span");
            chip.className = `mb-1 max-w-72 truncate rounded-md px-2 py-0.5 text-[11px] leading-4 font-semibold whitespace-nowrap shadow-[0_2px_6px_rgba(16,17,17,0.25)] ${target ? "text-white" : "bg-white text-charcoal ring-1 ring-charcoal/15"} ${clickable ? "hover:ring-2 hover:ring-green" : ""}`;
            if (target) chip.style.backgroundColor = point.color;
            chip.textContent = point.label;
            const dot = document.createElement("span");
            dot.className = `rounded-full border-2 border-white shadow-[0_1px_4px_rgba(16,17,17,0.35)] ${target ? "size-4" : "size-3"}`;
            dot.style.backgroundColor = target ? point.color : "#4b5563";
            element.append(chip, dot);
            evidenceMarkersRef.current.push(new lib.Marker({ element, anchor: "bottom", offset: [0, 6] }).setLngLat([point.lng, point.lat]).addTo(map));
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
        const listingMarkers = listingMarkersRef.current;

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
                    ensureActivePoi(map);
                    ensureCircleLayers(map);
                    ensureRadiusLayers(map);
                    ensureRouteLayers(map);
                    ensureEvidenceLayers(map);
                    void ensureTraffic(map);
                };
                map.on("load", () => {
                    latest.current.onFailure(false);
                    setup();
                    syncMarkers();
                    syncResults();
                    syncListings();
                    placeDrop();
                    syncEvidenceMarkers();
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
                map.on("moveend", syncListings);
                for (const layer of [...POI_LAYERS, LAYER_POI_CLUSTERS]) {
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
                    if (map?.getLayer(LAYER_POI_CLUSTERS)) {
                        const cluster = map.queryRenderedFeatures(event.point, { layers: [LAYER_POI_CLUSTERS] })[0];
                        const geometry = cluster?.geometry as { type: string; coordinates: [number, number] } | undefined;
                        if (geometry?.type === "Point") {
                            map.easeTo({ center: geometry.coordinates, zoom: Math.min(map.getZoom() + 2, POI_CLUSTER_MAX_ZOOM + 1) });
                            return;
                        }
                    }
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
            for (const item of resultMarkersRef.current) item.marker.remove();
            resultMarkersRef.current = [];
            for (const marker of listingMarkers.values()) marker.remove();
            listingMarkers.clear();
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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- hàm vẽ đọc giá trị mới nhất qua ref
    }, [pois]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        try {
            ensureActivePoi(map);
        } catch {
            // style chưa sẵn sàng: lần "load"/"styledata" sẽ vẽ
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- hàm vẽ đọc giá trị mới nhất qua ref
    }, [activePoi]);

    // Tin rao.
    useEffect(() => {
        syncListings();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- hàm vẽ đọc giá trị mới nhất qua ref
    }, [listings]);

    // Làm nổi ghim kết quả đang xem.
    useEffect(() => {
        styleResults();
    }, [activeResultId]);

    // Ghim kết quả tìm theo loại hình.
    useEffect(() => {
        syncResults();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- hàm vẽ đọc giá trị mới nhất qua ref
    }, [results]);

    // Ghim và điểm đi/đến.
    useEffect(() => {
        syncMarkers();
    }, [from, to]);

    // Dẫn chứng của tiêu chí đang chọn.
    useEffect(() => {
        evidenceRef.current = evidence;
        const map = mapRef.current;
        // Không chặn theo isStyleLoaded(): hàm này trả false cả khi chỉ đang tải ô nền (vừa fitBounds), làm lỡ
        // lần cập nhật tuyến. Nguồn đã có thì setData luôn được; style chưa sẵn sàng thì "load"/"styledata" sẽ vẽ.
        if (map) {
            try {
                ensureEvidenceLayers(map);
            } catch {
                // style chưa sẵn sàng
            }
        }
        syncEvidenceMarkers();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- hàm vẽ đọc giá trị mới nhất qua ref
    }, [evidence]);

    // `.vietmapgl-map` đặt position:relative nên không dùng chung với absolute: bọc ngoài để giữ kích thước.
    return (
        <div className="absolute inset-0">
            <div ref={containerRef} className="h-full w-full" role="application" aria-label="Bản đồ" />
        </div>
    );
}
