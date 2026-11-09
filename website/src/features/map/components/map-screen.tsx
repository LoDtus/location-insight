"use client";

import { Bookmark, Loader2, MapPinned, Scale, Settings, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ShellRoot } from "@/features/app/shell";
import { MAP_PLACE_SLUG } from "@/features/landing-page/data/listings";
import MapCanvas, {
    type MapHandle,
    type MapInitialView,
    type MapViewport,
} from "@/features/map/components/map-canvas";
import MapContextMenu, { type ContextAction } from "@/features/map/components/map-context-menu";
import MapDirectionsPanel from "@/features/map/components/map-directions-panel";
import MapFilterPanel, { countFilters } from "@/features/map/components/map-filter-panel";
import MapLayerPicker from "@/features/map/components/map-layer-picker";
import MapListingPanel from "@/features/map/components/map-listing-panel";
import MapPlaceDetail from "@/features/map/components/map-place-detail";
import MapPlacePanel from "@/features/map/components/map-place-panel";
import MapResultsPanel, { type ResultsState } from "@/features/map/components/map-results-panel";
import MapSavedPanel from "@/features/map/components/map-saved-panel";
import MapSearchBar from "@/features/map/components/map-search-bar";
import MapScaleBar from "@/features/map/components/map-scale-bar";
import MapUrlErrors from "@/features/map/components/map-url-errors";
import MapUsageCard from "@/features/map/components/map-usage-card";
import MapWeightsDialog from "@/features/map/components/map-weights-dialog";
import MapZoomControls from "@/features/map/components/map-zoom-controls";
import { useDirections } from "@/features/map/hooks/use-directions";
import { useMapConfig } from "@/features/map/hooks/use-map-config";
import { useCriterionWeights } from "@/features/map/hooks/use-criterion-weights";
import { useMapOverlays } from "@/features/map/hooks/use-map-overlays";
import { POI_MIN_ZOOM, POI_STYLE, listingPins, shortPrice, type ListingPin, type OverlayId } from "@/features/map/map-overlays";
import { usePlaceSelection } from "@/features/map/hooks/use-place-selection";
import { COMPARE_MAX, pendingKey, useSavedPlaces } from "@/features/map/hooks/use-saved-places";
import { showToast } from "@/shared/components/toast/toast-store";
import {
    buildMapUrl,
    canonicalQuery,
    parseMapUrl,
    type MapUrlError,
    type MapUrlParseResult,
    type MapUrlState,
    type SearchFilters,
} from "@/features/map/map-url";
import {
    PIN_ZOOM,
    SEARCH_RADIUS,
    zoomForRadius,
    formatRadius,
    formatCoordinates,
    placeLink,
} from "@/features/map/map.geo";
import { planEvidence, withRoute, type EvidenceOverlay } from "@/features/map/evidence-overlay";
import { getRoutes, isAbortError, mapErrorMessage, reverseGeocode, searchPinResults } from "@/features/map/map.service";
import {
    DEFAULT_MAP_CENTER,
    DEFAULT_MAP_ZOOM,
    readSavedMapView,
    writeSavedMapView,
    type SavedMapView,
} from "@/features/map/map-view-memory";
import type {
    EvaluatedCriterion,
    MapConfig,
    MapPlace,
    MapPoint,
    MapStyleId,
    PinResult,
    SavedPlace,
    Waypoint,
} from "@/features/map/map.types";

interface MapScreenProps {
    placeId?: string;
    root?: ShellRoot;
}

type Panel = "place" | "directions" | "usage" | "detail" | "saved" | "results" | "listing" | null;

const POINT_LABEL_FALLBACK = "Điểm đã chọn";
const NO_RESULTS: PinResult[] = [];
const NO_LISTINGS: never[] = [];
const URL_WRITE_DELAY_MS = 500;

function toWaypoint(place: MapPlace): Waypoint {
    return { lat: place.lat, lng: place.lng, label: place.name || place.display || POINT_LABEL_FALLBACK };
}

function provisional(point: MapPoint | null): Waypoint | null {
    return point ? { ...point, label: POINT_LABEL_FALLBACK } : null;
}

/** Camera ban đầu: `c`/`z`/`b`/`p` nếu có, không thì quanh ghim/điểm đi-đến, không thì mặc định của cấu hình. */
function computeInitialView(state: MapUrlState, config: MapConfig): MapInitialView {
    const anchor =
        state.c ??
        state.pin ??
        (state.from && state.to
            ? { lat: (state.from.lat + state.to.lat) / 2, lng: (state.from.lng + state.to.lng) / 2 }
            : (state.from ?? state.to));
    const fallbackZoom = state.c ? config.zoom : state.pin ? PIN_ZOOM : state.from || state.to ? 13 : config.zoom;
    return {
        center: anchor ? [anchor.lng, anchor.lat] : config.center,
        zoom: state.z ?? fallbackZoom,
        bearing: state.b ?? 0,
        pitch: state.p ?? 0,
    };
}

/** URL có chỉ định khung nhìn (tâm/zoom, ghim hoặc điểm đi-đến) → URL được ưu tiên hơn khung nhìn đã nhớ. */
function hasUrlView(state: MapUrlState): boolean {
    return state.c !== null || state.z !== null || state.pin !== null || state.from !== null || state.to !== null;
}

/**
 * Khung nhìn khởi đầu khi URL không chỉ định: khung nhìn đã nhớ trong phiên, không có thì Hồ Hoàn Kiếm
 * (rồi bay tới vị trí người dùng nếu trình duyệt cho phép).
 */
function sessionInitialView(saved: SavedMapView | null): MapInitialView {
    const point = saved ?? DEFAULT_MAP_CENTER;
    return { center: [point.lng, point.lat], zoom: saved?.zoom ?? DEFAULT_MAP_ZOOM, bearing: 0, pitch: 0 };
}

function MapScreenInner({ placeId, root = "/app" }: MapScreenProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const paramsString = searchParams.toString();

    const mapRef = useRef<MapHandle>(null);
    const configState = useMapConfig();
    const { selection, selectPoint, clear } = usePlaceSelection();
    const saved = useSavedPlaces();

    // URL được đọc đúng một lần khi vào trang; các lần đổi sau xử lý ở effect bên dưới.
    const [initialParse] = useState<MapUrlParseResult>(() => parseMapUrl(new URLSearchParams(paramsString)));
    const init = initialParse.state;
    const hasDirectionsInUrl = init.from !== null || init.to !== null;
    // Khung nhìn nhớ trong phiên (sessionStorage) chỉ dùng khi URL không chỉ định khung nhìn.
    const [savedView] = useState<SavedMapView | null>(() => (hasUrlView(init) ? null : readSavedMapView()));
    const needsGeolocation = !hasUrlView(init) && savedView === null;
    // Chờ định vị lần đầu: chưa ghi nhớ khung nhìn mặc định để lần sau còn hỏi vị trí.
    const geoRef = useRef<{ status: "pending" | "done"; point: MapPoint | null; mapLoaded: boolean; moved: boolean }>({
        status: needsGeolocation ? "pending" : "done",
        point: null,
        mapLoaded: false,
        moved: false,
    });

    const directions = useDirections({
        open: hasDirectionsInUrl,
        from: provisional(init.from),
        to: provisional(init.to),
        vehicle: init.v ?? undefined,
        alternatives: init.alt ?? undefined,
        avoid: init.avoid,
        departAt: init.t,
        routeIndex: init.route ?? 0,
    });

    const [styleId, setStyleId] = useState<MapStyleId>(init.s ?? "tm");
    const [trafficOn, setTrafficOn] = useState(init.traffic);
    const [filters, setFilters] = useState<SearchFilters>(init.filters);
    const [query, setQuery] = useState<string | null>(init.q);
    const [queryValue, setQueryValue] = useState(init.q ?? "");
    const [urlErrors, setUrlErrors] = useState<MapUrlError[]>(initialParse.errors);
    const [viewport, setViewport] = useState<MapViewport>({ zoom: 12, lat: 21.03, lng: 105.83, bearing: 0, pitch: 0, bounds: [0, 0, 0, 0] });
    const [overlays, setOverlays] = useState<OverlayId[]>(init.overlays);
    const [openListing, setOpenListing] = useState<ListingPin | null>(null);
    const [weightsOpen, setWeightsOpen] = useState(false);
    const criterionWeights = useCriterionWeights();
    const [viewportReady, setViewportReady] = useState(false);
    const [panel, setPanel] = useState<Panel>(
        hasDirectionsInUrl ? "directions" : init.pin ? "place" : placeId !== undefined ? "detail" : null,
    );
    const [picking, setPicking] = useState<"from" | "to" | null>(null);
    const [failed, setFailed] = useState(false);
    const [locating, setLocating] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [menu, setMenu] = useState<{
        point: MapPoint;
        at: { x: number; y: number };
        size: { width: number; height: number };
        /** map: chuột phải trên nền; me: chấm vị trí của tôi; result: ghim kết quả có số. */
        kind: "map" | "me" | "result";
        resultId?: string;
    } | null>(null);
    /** Điểm đang ghim (chuột phải, chọn địa điểm…): tâm tìm kiếm lân cận. Bỏ bằng menu chuột phải hoặc bấm chuột trái chỗ khác. */
    const [ping, setPing] = useState<MapPoint | null>(init.pin);
    /** Điểm ghim trùng một ghim đã có (vị trí của tôi, ghim kết quả): không thả thêm ghim đỏ đè lên. */
    const [pingSilent, setPingSilent] = useState(false);
    /** Điểm tiện ích (lớp "Hiện trên bản đồ") đang mở thẻ Địa điểm: chỉ vẽ vòng nhấn, không thả ghim mới. */
    const [activePoi, setActivePoi] = useState<MapPoint | null>(null);
    /** Ghim kết quả đang xem (làm nổi bật trên bản đồ). */
    const [activeResultId, setActiveResultId] = useState<string | null>(null);
    /** Thẻ Địa điểm đang mở từ danh sách kết quả: có nút quay lại danh sách. */
    /** Thẻ Địa điểm mở từ danh sách nào (để hiện nút quay lại đúng danh sách đó). */
    const [placeOrigin, setPlaceOrigin] = useState<"results" | "saved" | "compare" | null>(() =>
        init.pin && searchParams.get("ve") === "so-sanh" ? "compare" : null,
    );
    const [searchFocus, setSearchFocus] = useState(0);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [results, setResults] = useState<ResultsState | null>(null);
    const resultsRef = useRef<AbortController | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    /** Vùng bản đồ còn thấy (không bị panel che): để đưa dẫn chứng vào giữa phần nhìn được. */
    const mapAreaRef = useRef<HTMLDivElement>(null);

    // ---- Dẫn chứng của tiêu chí trên bản đồ (bấm một dòng trong bảng đánh giá) ----
    const [evidence, setEvidence] = useState<EvidenceOverlay | null>(null);
    const [evidenceLoading, setEvidenceLoading] = useState(false);
    const evidenceAbortRef = useRef<AbortController | null>(null);

    const fitEvidence = useCallback((overlay: EvidenceOverlay) => {
        const root = rootRef.current;
        const area = mapAreaRef.current;
        // Chừa thêm chỗ cho nhãn của ghim dẫn chứng (nhãn rộng ~200 px, neo giữa) và thẻ chú thích ở dưới.
        const LABEL_ROOM = 90;
        // Mobile: panel là bottom sheet nằm đè lên bản đồ, khi xem dẫn chứng thu còn ~34% chiều cao.
        const sheet = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches && root ? root.clientHeight * 0.36 : 0;
        const inset = {
            right: (root && area ? Math.max(0, root.clientWidth - area.clientWidth) : 0) + LABEL_ROOM,
            bottom: Math.max(sheet, root && area ? Math.max(0, root.clientHeight - area.clientHeight) : 0) + 60,
        };
        mapRef.current?.fitBounds(overlay.bbox, LABEL_ROOM, inset);
    }, []);

    const clearEvidence = useCallback(() => {
        evidenceAbortRef.current?.abort();
        evidenceAbortRef.current = null;
        setEvidenceLoading(false);
        setEvidence(null);
    }, []);

    /** Vẽ dẫn chứng: lớp phủ dựng ngay (nét nối thẳng), rồi thay bằng đường đi thật khi Vietmap trả tuyến. */
    const showEvidence = useCallback(
        (item: EvaluatedCriterion | null, origin: MapPoint) => {
            clearEvidence();
            if (!item) return;
            const plan = planEvidence(item, origin);
            if (!plan) {
                showToast({
                    title: `${item.label}: chưa có dẫn chứng trên bản đồ`,
                    description:
                        item.status === "not_implemented"
                            ? "Tiêu chí này chưa được thực hiện, điểm hiện là số minh họa."
                            : "Tiêu chí chưa đo được nên chưa có gì để vẽ.",
                    tone: "info",
                    duration: 3500,
                });
                return;
            }
            setEvidence(plan.overlay);
            fitEvidence(plan.overlay);
            if (!plan.routeTo) return;
            const controller = new AbortController();
            evidenceAbortRef.current = controller;
            setEvidenceLoading(true);
            getRoutes(origin, plan.routeTo, "motorcycle", { alternatives: false, avoid: null, departAt: null }, controller.signal)
                .then((routes) => {
                    if (controller.signal.aborted || routes.length === 0) return;
                    const next = withRoute(plan.overlay, routes[0]);
                    setEvidence(next);
                    fitEvidence(next);
                })
                .catch(() => {
                    // Không lấy được tuyến (hết hạn mức, lỗi mạng): giữ nét nối thẳng, chú thích vẫn đúng.
                })
                .finally(() => {
                    if (evidenceAbortRef.current === controller) {
                        evidenceAbortRef.current = null;
                        setEvidenceLoading(false);
                    }
                });
        },
        [clearEvidence, fitEvidence],
    );
    const lastWrittenRef = useRef(canonicalQuery(paramsString));
    const isAdmin = root === "/admin";
    const focus: MapPoint = { lat: viewport.lat, lng: viewport.lng };
    const radiusM = filters.radius ?? SEARCH_RADIUS.initial;
    const searchCenter: MapPoint = ping ?? focus;
    const filterCount = countFilters(filters);
    const resultPins = results?.status === "ready" ? results.items : NO_RESULTS;
    const overlayData = useMapOverlays({ overlays, zoom: viewport.zoom, bounds: viewportReady ? viewport.bounds : null });
    const showListings = overlays.includes("listing");
    const allListingPins = useMemo(() => listingPins(), []);
    const listingMarkers = useMemo(
        () =>
            showListings
                ? allListingPins.map((pin) => ({
                      id: pin.listing.id,
                      lat: pin.point.lat,
                      lng: pin.point.lng,
                      label: shortPrice(pin.listing),
                      title: pin.listing.title,
                      approximate: pin.approximate,
                  }))
                : NO_LISTINGS,
        [showListings, allListingPins],
    );
    const resultMarkers = useMemo(
        () => resultPins.map((item) => ({ id: item.refId, lat: item.lat, lng: item.lng, name: item.name })),
        [resultPins],
    );
    const config = configState.status === "ready" ? configState.config : null;
    const trafficAvailable = config?.trafficStyleUrl != null;

    function labelPoint(target: "from" | "to", point: MapPoint): void {
        const named = (label: string): Waypoint => ({ ...point, label });
        const set = target === "from" ? directions.setFrom : directions.setTo;
        set(named(POINT_LABEL_FALLBACK));
        reverseGeocode(point)
            .then((place) => {
                if (!place) return;
                set((current) => (current && current.lat === point.lat && current.lng === point.lng ? named(place.name || place.display) : current));
            })
            .catch((error: unknown) => {
                if (!isAbortError(error)) setNotice("Không lấy được tên địa điểm; vẫn dùng tọa độ đã chọn.");
            });
    }

    // Vào trang bằng URL có pin/from/to: lấy địa chỉ cho các điểm đó.
    useEffect(() => {
        if (init.pin) selectPoint(init.pin);
        if (init.from) labelPoint("from", init.from);
        if (init.to) labelPoint("to", init.to);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy một lần khi vào trang
    }, []);

    /** Bay tới vị trí vừa lấy được khi bản đồ đã tải xong và người dùng chưa tự kéo bản đồ. */
    function applyGeolocation(): void {
        const geo = geoRef.current;
        if (!geo.point || !geo.mapLoaded || geo.moved) return;
        const point = geo.point;
        geo.point = null;
        mapRef.current?.showMyLocation(point);
    }

    /** Mỗi lần khung nhìn đổi: nhớ lại trong phiên (trừ lúc còn chờ định vị lần đầu). */
    function rememberViewport(next: MapViewport): void {
        const geo = geoRef.current;
        if (!geo.mapLoaded) {
            geo.mapLoaded = true;
            applyGeolocation();
            if (geo.status === "pending") return;
        } else if (geo.status === "pending") {
            // Người dùng tự di chuyển trước khi có vị trí: không kéo bản đồ đi nữa.
            geo.moved = true;
        }
        writeSavedMapView({ lat: next.lat, lng: next.lng, zoom: next.zoom });
    }

    // Lần đầu mở bản đồ trong phiên (không URL, chưa nhớ khung nhìn): bay tới vị trí người dùng nếu được phép.
    useEffect(() => {
        if (!needsGeolocation) return;
        const geo = geoRef.current;
        if (!("geolocation" in navigator)) {
            geo.status = "done";
            return;
        }
        let cancelled = false;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (cancelled) return;
                geo.status = "done";
                geo.point = { lat: position.coords.latitude, lng: position.coords.longitude };
                applyGeolocation();
            },
            () => {
                // Bị từ chối/không khả dụng: giữ Hồ Hoàn Kiếm.
                if (!cancelled) geo.status = "done";
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
        );
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy một lần khi vào trang
    }, []);

    // `layers=traffic` mà hệ thống chưa bật Traffic → báo lỗi, không bật.
    useEffect(() => {
        if (configState.status !== "ready" || !trafficOn || trafficAvailable) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- phản ứng với cấu hình vừa tải
        setTrafficOn(false);
        setUrlErrors((current) => [
            ...current,
            { param: "layers", message: "lớp giao thông chưa được bật trên hệ thống (cần bật API Traffic cho khóa Tilemap)" },
        ]);
    }, [configState.status, trafficOn, trafficAvailable]);

    // Fit tuyến đúng một lần cho mỗi kết quả mới (trừ khi URL đã chỉ định tâm `c`).
    const { fitVersion, routes, active } = directions;
    const skipFitRef = useRef(init.c !== null);
    useEffect(() => {
        const route = routes[active];
        if (fitVersion === 0 || !route) return;
        if (skipFitRef.current) {
            skipFitRef.current = false;
            return;
        }
        mapRef.current?.fitBounds(route.bbox);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi có kết quả mới
    }, [fitVersion]);

    // ---- Trạng thái → URL (replaceState, dồn nhịp) ----
    const urlState: MapUrlState = {
        c: viewportReady ? { lat: viewport.lat, lng: viewport.lng } : null,
        z: viewportReady ? viewport.zoom : null,
        b: viewportReady ? viewport.bearing : null,
        p: viewportReady ? viewport.pitch : null,
        s: styleId,
        traffic: trafficOn,
        overlays,
        q: query && query.trim().length >= 2 ? query.trim() : null,
        filters,
        pin: selection.status === "none" ? null : selection.point,
        from: directions.open ? directions.from : null,
        to: directions.open ? directions.to : null,
        v: directions.vehicle,
        alt: directions.alternatives,
        route: directions.routes.length > 0 ? directions.active : init.route,
        avoid: directions.avoid as MapUrlState["avoid"],
        t: directions.departAt,
    };
    const built = buildMapUrl(urlState);
    useEffect(() => {
        if (!viewportReady) return;
        const canonical = canonicalQuery(built);
        if (canonical === lastWrittenRef.current) return;
        const timer = setTimeout(() => {
            lastWrittenRef.current = canonical;
            window.history.replaceState(null, "", built ? `${pathname}?${built}` : pathname);
        }, URL_WRITE_DELAY_MS);
        return () => clearTimeout(timer);
    }, [built, viewportReady, pathname]);

    // ---- URL → trạng thái (khi URL đổi từ bên ngoài: Back/Forward, liên kết) ----
    useEffect(() => {
        const canonical = canonicalQuery(paramsString);
        if (canonical === lastWrittenRef.current) return;
        lastWrittenRef.current = canonical;
        const { state, errors } = parseMapUrl(new URLSearchParams(paramsString));
        /* eslint-disable react-hooks/set-state-in-effect -- đồng bộ trạng thái với URL (nguồn bên ngoài) */
        setUrlErrors(errors);
        setStyleId(state.s ?? "tm");
        setTrafficOn(state.traffic && trafficAvailable);
        setOverlays(state.overlays);
        setFilters(state.filters);
        setQuery(state.q);
        setQueryValue(state.q ?? "");
        directions.setVehicle(state.v ?? "motorcycle");
        directions.setAlternatives(state.alt ?? true);
        directions.setAvoid(state.avoid);
        directions.setDepartAt(state.t);
        directions.setPendingIndex(state.route ?? 0);
        if (state.from || state.to) {
            clear();
            if (state.from) labelPoint("from", state.from);
            else directions.setFrom(null);
            if (state.to) labelPoint("to", state.to);
            else directions.setTo(null);
            directions.setOpen(true);
            setPanel("directions");
        } else {
            directions.close();
            directions.setFrom(null);
            directions.setTo(null);
            if (state.pin) {
                selectPoint(state.pin);
                setPing(state.pin);
                setPingSilent(false);
                setPanel("place");
            } else {
                clear();
                setPanel((current) => (current === "place" || current === "directions" ? null : current));
            }
        }
        const center = state.c ?? state.pin;
        if (center || state.z !== null || state.b !== null || state.p !== null) {
            mapRef.current?.setView({
                ...(center ?? {}),
                ...(state.z !== null ? { zoom: state.z } : !state.c && state.pin ? { zoom: PIN_ZOOM } : {}),
                ...(state.b !== null ? { bearing: state.b } : {}),
                ...(state.p !== null ? { pitch: state.p } : {}),
            });
        }
        /* eslint-enable react-hooks/set-state-in-effect */
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ phản ứng với thay đổi URL
    }, [paramsString]);

    const setWaypoint = useCallback(
        (target: "from" | "to", place: MapPlace | null): void => {
            const waypoint = place ? toWaypoint(place) : null;
            if (target === "from") directions.setFrom(waypoint);
            else directions.setTo(waypoint);
            if (waypoint) mapRef.current?.flyTo(waypoint, 15);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps -- setters ổn định
        [directions.setFrom, directions.setTo],
    );

    // Chuột trái: chọn điểm đi/đến khi đang "chọn trên bản đồ"; còn lại bỏ điểm đang ghim (và thẻ Địa điểm của nó).
    const onMapClick = useCallback(
        (point: MapPoint): void => {
            if (picking && directions.open) {
                setNotice(null);
                labelPoint(picking, point);
                setPicking(null);
                return;
            }
            clearPing();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps -- labelPoint/clearPing đọc state mới nhất qua closure mỗi lần render
        [picking, directions.open, panel],
    );

    // Chỉ một ghim chính: điểm vừa bấm chuột phải, không thì điểm đang ghim (ẩn khi đang chỉ đường).
    const dropped = menu?.kind === "map" ? menu.point : directions.open || pingSilent ? null : ping;
    const droppedLat = dropped?.lat;
    const droppedLng = dropped?.lng;
    useEffect(() => {
        mapRef.current?.dropPin(droppedLat !== undefined && droppedLng !== undefined ? { lat: droppedLat, lng: droppedLng } : null);
    }, [droppedLat, droppedLng, config]);

    // Thông báo tự tắt sau vài giây.
    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 5000);
        return () => clearTimeout(timer);
    }, [notice]);

    // Menu chuột phải đóng khi bản đồ di chuyển.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- đóng menu khi khung nhìn đổi
        setMenu(null);
    }, [viewport.lat, viewport.lng, viewport.zoom, viewport.bearing, viewport.pitch]);

    useEffect(() => () => resultsRef.current?.abort(), []);

    // Chuột phải: ghim luôn điểm đó (làm tâm tìm kiếm) và mở menu.
    const openMenu = useCallback((point: MapPoint, at: { x: number; y: number }): void => {
        const box = rootRef.current?.getBoundingClientRect();
        setMenu({ point, at, size: { width: box?.width ?? 0, height: box?.height ?? 0 }, kind: "map" });
        setPing(point);
        setPingSilent(false);
        setActiveResultId(null);
        setPopoverOpen(false);
    }, []);

    // Chuột trái/phải lên chấm vị trí của tôi hoặc ghim kết quả: menu tại ghim đó, không thả ghim mới.
    const openMarkerMenu = useCallback(
        (target: { kind: "me" | "result"; id?: string; point: MapPoint; at: { x: number; y: number } }): void => {
            const box = rootRef.current?.getBoundingClientRect();
            setMenu({ point: target.point, at: target.at, size: { width: box?.width ?? 0, height: box?.height ?? 0 }, kind: target.kind, resultId: target.id });
            setPopoverOpen(false);
        },
        [],
    );

    const closeMenu = useCallback((): void => setMenu(null), []);

    async function copyText(text: string, done: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(text);
            setNotice(done);
        } catch {
            setNotice("Không sao chép được. Hãy cấp quyền clipboard cho trang này.");
        }
    }

    function directionsTo(point: MapPoint): void {
        clear();
        if (!directions.open) {
            directions.setOpen(true);
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const here = { lat: position.coords.latitude, lng: position.coords.longitude };
                        directions.setFrom({ ...here, label: "Vị trí của tôi" });
                        mapRef.current?.showMyLocation(here);
                    },
                    () => setNotice("Không xác định được vị trí của bạn. Hãy chọn điểm đi."),
                    { timeout: 8000, maximumAge: 60000 },
                );
            } else {
                setNotice("Trình duyệt không hỗ trợ định vị. Hãy chọn điểm đi.");
            }
        }
        labelPoint("to", point);
        setPanel("directions");
    }

    /** "Xem thông tin địa điểm này": luôn mở thẻ Địa điểm; thẻ tự ghi chú khi chỉ có địa chỉ gần đúng. */
    function whereIsThis(point: MapPoint, silent = false): void {
        setNotice(null);
        directions.close();
        setPicking(null);
        pinAt(point, silent);
        selectPoint(point);
        setPanel("place");
    }

    /** Đặt điểm ghim (tâm tìm kiếm). `silent`: đã có ghim khác ở đó nên không vẽ thêm ghim đỏ. */
    function pinAt(point: MapPoint, silent = false): void {
        setPing(point);
        setPingSilent(silent);
        if (!silent) setActiveResultId(null);
        setPlaceOrigin(null);
        setActivePoi(null);
    }

    /** Bỏ điểm đang ghim; thẻ Địa điểm của điểm đó đóng theo. */
    function clearPing(): void {
        setPing(null);
        setPingSilent(false);
        setActiveResultId(null);
        if (panel === "place") {
            clear();
            setPanel(null);
        }
    }

    /** Mở ô tìm kiếm để tìm quanh điểm vừa ghim, hiện phạm vi hiện tại. */
    function searchAround(point: MapPoint, silent = false): void {
        pinAt(point, silent);
        setFilterOpen(false);
        setSearchFocus((value) => value + 1);
        mapRef.current?.flashRadius(point, radiusM);
    }

    function setRadius(next: number): void {
        setFilters((current) => ({ ...current, radius: next === SEARCH_RADIUS.initial ? undefined : next }));
        mapRef.current?.flashRadius(searchCenter, next);
    }

    /** Tìm theo loại hình: kéo bản đồ về điểm ghim, chỉnh zoom vừa phạm vi rồi ghim mọi kết quả liên quan. */
    function searchAll(text: string): void {
        const center = searchCenter;
        resultsRef.current?.abort();
        const controller = new AbortController();
        resultsRef.current = controller;
        setResults({ status: "loading", text, radiusM });
        if (panel !== "directions") {
            if (panel === "place") clear();
            setPanel("results");
        }
        // Về đúng điểm ghim, zoom theo bán kính (10 km → 12,3).
        mapRef.current?.flyTo(center, zoomForRadius(radiusM));
        mapRef.current?.flashRadius(center, radiusM);
        searchPinResults(text, center, { ...filters, radius: radiusM }, controller.signal)
            .then((items) => setResults({ status: "ready", text, radiusM, items }))
            .catch((error: unknown) => {
                if (isAbortError(error)) return;
                setResults({ status: "error", text, radiusM, message: mapErrorMessage(error, "Không tìm được lúc này, vui lòng thử lại.") });
            });
    }

    function clearResults(): void {
        resultsRef.current?.abort();
        setResults(null);
        setActiveResultId(null);
        setPlaceOrigin((current) => (current === "results" ? null : current));
        setPanel((current) => (current === "results" ? null : current));
    }

    /** Mở một kết quả: dùng chính ghim tròn có số (làm nổi), không thả thêm ghim đè lên. */
    function openResult(item: PinResult, fly: boolean): void {
        const point = { lat: item.lat, lng: item.lng };
        directions.close();
        setPicking(null);
        pinAt(point, true);
        setActiveResultId(item.refId);
        setPlaceOrigin("results");
        // distanceM của kết quả là khoảng cách tới tâm tìm kiếm, không phải độ lệch điểm bấm: kết quả là đúng điểm đó.
        selectPoint(point, { ...item, distanceM: 0, kind: item.kind ?? "poi" });
        setPanel("place");
        if (fly) mapRef.current?.flyTo(point, PIN_ZOOM);
    }

    function openSavedItem(item: SavedPlace): void {
        const point = { lat: item.lat, lng: item.lng };
        directions.close();
        setPicking(null);
        pinAt(point);
        setPlaceOrigin("saved");
        selectPoint(point);
        setPanel("place");
        mapRef.current?.flyTo(point, PIN_ZOOM);
    }

    async function updateSaved(item: SavedPlace, patch: { label?: string | null; note?: string }): Promise<string | null> {
        return saved.update(item, patch);
    }

    function toggleCompare(item: SavedPlace): void {
        const adding = !item.compared;
        void saved.update(item, { compared: adding }).then((message) => {
            if (message) {
                showToast({ title: adding ? "Chưa thêm được vào so sánh" : "Chưa bỏ được khỏi so sánh", description: message, tone: "error" });
                return;
            }
            showToast(
                adding
                    ? { title: "Đã thêm vào so sánh", description: `${item.label || item.name} · xem ở mục “So sánh” trên thanh bên.` }
                    : { title: "Đã bỏ khỏi so sánh", description: item.label || item.name, tone: "info" },
            );
        });
    }

    /** Thêm nhiều mục vào so sánh, dừng khi chạm giới hạn 6. */
    async function compareMany(items: SavedPlace[]): Promise<void> {
        const pending = items.filter((item) => !item.compared);
        const room = Math.max(0, COMPARE_MAX - saved.state.items.filter((item) => item.compared).length);
        const batch = pending.slice(0, room);
        let failed: string | null = null;
        for (const item of batch) {
            const message = await saved.update(item, { compared: true });
            if (message) {
                failed = message;
                break;
            }
        }
        if (pending.length === 0) {
            showToast({ title: "Các địa điểm đã chọn đều đang được so sánh", tone: "info" });
        } else if (failed) {
            showToast({ title: "Chưa thêm hết vào so sánh", description: failed, tone: "error" });
        } else if (batch.length < pending.length) {
            showToast({
                title: `Đã thêm ${batch.length} địa điểm vào so sánh`,
                description: `So sánh tối đa ${COMPARE_MAX} địa điểm; còn ${pending.length - batch.length} địa điểm chưa thêm. Bỏ bớt rồi thêm tiếp.`,
                tone: "info",
            });
        } else {
            showToast({ title: `Đã thêm ${batch.length} địa điểm vào so sánh`, description: "Xem ở mục “So sánh” trên thanh bên." });
        }
    }

    async function removeMany(items: SavedPlace[]): Promise<void> {
        let removed = 0;
        let failed: string | null = null;
        for (const item of items) {
            const message = await saved.remove(item);
            if (message) failed = message;
            else removed += 1;
        }
        showToast(
            failed
                ? { title: `Đã xóa ${removed}/${items.length} địa điểm`, description: failed, tone: "error" }
                : { title: `Đã xóa ${removed} địa điểm đã lưu`, tone: "info" },
        );
    }

    function runContextAction(action: ContextAction): void {
        if (!menu) return;
        const { point, kind, resultId } = menu;
        setMenu(null);
        const result = kind === "result" ? resultPins.find((item) => item.refId === resultId) : undefined;
        if (action === "copy-coordinates") {
            void copyText(formatCoordinates(point), "Đã sao chép tọa độ.");
        } else if (action === "copy-link") {
            void copyText(placeLink(window.location.origin, pathname, point), "Đã sao chép liên kết tới địa điểm.");
        } else if (action === "directions") {
            directionsTo(point);
            return;
        } else if (action === "where") {
            if (result) openResult(result, false);
            else whereIsThis(point, kind === "me");
            return;
        } else if (action === "clear-pin") {
            clearPing();
            return;
        } else {
            searchAround(point, kind !== "map");
            return;
        }
    }

    function onSearchSelect(place: MapPlace): void {
        const point = { lat: place.lat, lng: place.lng };
        directions.close();
        setPicking(null);
        pinAt(point);
        selectPoint(point, place);
        setPanel("place");
        mapRef.current?.flyTo(point, PIN_ZOOM);
    }

    function openDirections(patch: { from?: Waypoint; to?: Waypoint }): void {
        if (patch.from) directions.setFrom(patch.from);
        if (patch.to) directions.setTo(patch.to);
        directions.setOpen(true);
        setPanel("directions");
    }

    function currentWaypoint(): Waypoint | null {
        if (selection.status === "none") return null;
        const place = selection.status === "ready" ? selection.place : null;
        return { ...selection.point, label: place?.name ?? POINT_LABEL_FALLBACK };
    }

    function closePanel(): void {
        if (panel === "directions") {
            directions.close();
            setPicking(null);
        }
        if (panel === "place") clear();
        if (panel === "detail" && placeId !== undefined) router.push(`${root}/map`);
        setPanel(null);
    }

    function locate(): void {
        if (!("geolocation" in navigator)) {
            setNotice("Trình duyệt không hỗ trợ định vị.");
            return;
        }
        setLocating(true);
        setNotice(null);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocating(false);
                mapRef.current?.showMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            (error) => {
                setLocating(false);
                setNotice(
                    error.code === error.PERMISSION_DENIED
                        ? "Bạn chưa cho phép truy cập vị trí. Hãy bật quyền vị trí cho trang này."
                        : "Không xác định được vị trí của bạn.",
                );
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
        );
    }

    function useMyLocationAsStart(): void {
        if (!("geolocation" in navigator)) {
            setNotice("Trình duyệt không hỗ trợ định vị.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const point = { lat: position.coords.latitude, lng: position.coords.longitude };
                directions.setFrom({ ...point, label: "Vị trí của tôi" });
                mapRef.current?.showMyLocation(point);
            },
            () => setNotice("Không xác định được vị trí của bạn."),
            { timeout: 8000, maximumAge: 60000 },
        );
    }

    if (configState.status === "loading") {
        return (
            <div className="flex h-full w-full items-center justify-center bg-white" role="status">
                <Loader2 className="animate-spin text-charcoal/60" aria-hidden />
                <span className="ml-2 text-sm text-charcoal/70">Đang tải bản đồ…</span>
            </div>
        );
    }
    if (configState.status === "error" || !configState.config.tilesEnabled) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-white p-6 text-center" role="alert">
                <p className="m-0 max-w-sm text-sm text-charcoal/80">
                    {configState.status === "error"
                        ? configState.message
                        : "Bản đồ chưa được cấu hình. Quản trị viên cần đặt khóa Tilemap của Vietmap."}
                </p>
            </div>
        );
    }
    const readyConfig = configState.config;
    // Dẫn chứng chỉ hiện khi đang mở đúng địa điểm đã bấm (đóng panel hay chọn chỗ khác thì tự ẩn).
    const visibleEvidence =
        evidence && panel === "place" && selection.status !== "none" && sameSpot(evidence.origin, selection.point) ? evidence : null;

    const sidePanel =
        panel === "directions" ? (
            <MapDirectionsPanel
                from={directions.from}
                to={directions.to}
                vehicle={directions.vehicle}
                routes={directions.routes}
                active={directions.active}
                status={directions.status}
                error={directions.error}
                indexError={directions.indexError}
                alternatives={directions.alternatives}
                avoid={directions.avoid}
                departAt={directions.departAt}
                onAlternatives={directions.setAlternatives}
                onClearAvoid={() => directions.setAvoid(null)}
                onClearDepartAt={() => directions.setDepartAt(null)}
                focus={focus}
                picking={picking}
                onPick={setPicking}
                onFrom={(place) => setWaypoint("from", place)}
                onTo={(place) => setWaypoint("to", place)}
                onSwap={directions.swap}
                onVehicle={directions.setVehicle}
                onSelectRoute={directions.setActive}
                onMyLocation={useMyLocationAsStart}
                onStep={(point) => mapRef.current?.flyTo({ lat: point[1], lng: point[0] }, 17)}
                onClose={closePanel}
            />
        ) : panel === "place" && selection.status !== "none" ? (
            <MapPlacePanel
                selection={selection}
                root={root}
                activeCriterionId={visibleEvidence?.criterionId ?? null}
                onCriterionSelect={(item) => showEvidence(item, selection.point)}
                onBack={
                    placeOrigin === "results" && results
                        ? () => {
                              clear();
                              setPlaceOrigin(null);
                              setPanel("results");
                          }
                        : placeOrigin === "saved"
                          ? () => {
                                clear();
                                setPlaceOrigin(null);
                                setPanel("saved");
                            }
                          : placeOrigin === "compare"
                            ? () => router.push(`${root}/compare`)
                            : undefined
                }
                backLabel={
                    placeOrigin === "saved"
                        ? "Quay lại địa điểm đã lưu"
                        : placeOrigin === "compare"
                          ? "Quay lại bảng so sánh"
                          : "Quay lại danh sách kết quả"
                }
                savedItem={saved.find(selection.point)}
                onUpdateSaved={(patch) => {
                    const item = saved.find(selection.point);
                    return item ? updateSaved(item, patch) : Promise.resolve("Hãy lưu địa điểm trước.");
                }}
                onToggleCompare={() => {
                    const item = saved.find(selection.point);
                    if (item) {
                        toggleCompare(item);
                        return;
                    }
                    if (selection.status !== "ready") return;
                    const place = selection.place;
                    void saved
                        .addToCompare({
                            point: selection.point,
                            name: place?.name || formatCoordinates(selection.point),
                            address: place?.display || place?.address || "",
                            kind: place?.kind,
                        })
                        .then((message) =>
                            showToast(
                                message
                                    ? { title: "Chưa thêm được vào so sánh", description: message, tone: "error" }
                                    : {
                                          title: "Đã lưu và thêm vào so sánh",
                                          description: `${place?.name ?? "Địa điểm"} · xem ở mục “So sánh” trên thanh bên.`,
                                      },
                            ),
                        );
                }}
                saving={saved.busyKey !== null && saved.busyKey === (saved.find(selection.point)?.id ?? pendingKey(selection.point))}
                onToggleSave={() => {
                    if (selection.status !== "ready") return;
                    const place = selection.place;
                    void saved
                        .toggle({
                            point: selection.point,
                            name: place?.name || formatCoordinates(selection.point),
                            address: place?.display || place?.address || "",
                            kind: place?.kind,
                        })
                        .then((message) => {
                            if (message) {
                                showToast({ title: "Chưa lưu được địa điểm", description: message, tone: "error" });
                                return;
                            }
                            const wasSaved = saved.find(selection.point) !== undefined;
                            showToast(
                                wasSaved
                                    ? { title: "Đã bỏ lưu địa điểm", description: place?.name, tone: "info" }
                                    : { title: "Đã lưu địa điểm", description: `${place?.name ?? "Địa điểm"} có trong mục “Đã lưu” cạnh ô tìm kiếm. Bạn có thể đặt tên gợi nhớ, ghi chú và so sánh.` },
                            );
                        });
                }}
                onEvaluated={saved.reload}
                onNearby={() => {
                    const point = selection.point;
                    clear();
                    setPanel(null);
                    searchAround(point);
                }}
                onCopyLink={() => {
                    void navigator.clipboard
                        .writeText(placeLink(window.location.origin, pathname, selection.point))
                        .then(() => showToast({ title: "Đã sao chép liên kết", description: "Dán liên kết để mở lại đúng điểm này trên bản đồ." }))
                        .catch(() => showToast({ title: "Không sao chép được", description: "Hãy cấp quyền clipboard cho trang này.", tone: "error" }));
                }}
                onClose={closePanel}
                onDirectionsTo={() => {
                    const target = currentWaypoint();
                    if (target) openDirections({ to: target });
                }}
                onDirectionsFrom={() => {
                    const target = currentWaypoint();
                    if (target) openDirections({ from: target });
                }}
            />
        ) : panel === "saved" ? (
            <MapSavedPanel
                state={saved.state}
                busyKey={saved.busyKey}
                compareHref={`${root}/compare`}
                onOpen={openSavedItem}
                onUpdate={async (item, patch) => {
                    const message = await updateSaved(item, patch);
                    if (!message) {
                        const field = patch.label !== undefined ? "label" : "note";
                        const value = field === "label" ? patch.label : patch.note;
                        showToast({
                            title: field === "label" ? (value ? "Đã đặt tên gợi nhớ" : "Đã dùng lại tên gốc") : value ? "Đã lưu ghi chú" : "Đã xóa ghi chú",
                            description: field === "label" ? value || item.name : item.label || item.name,
                        });
                    }
                    return message;
                }}
                onToggleCompare={toggleCompare}
                onCompareMany={compareMany}
                onRemoveMany={removeMany}
                onRemove={(item) => {
                    void saved.remove(item).then((message) => {
                        if (message) setNotice(message);
                    });
                }}
                onClose={closePanel}
            />
        ) : panel === "listing" && openListing ? (
            <MapListingPanel
                pin={openListing}
                root={root}
                onClose={() => {
                    setOpenListing(null);
                    setPanel(null);
                }}
                onDirections={() => openDirections({ to: { ...openListing.point, label: openListing.listing.title } })}
            />
        ) : panel === "results" && results ? (
            <MapResultsPanel state={results} activeId={activeResultId} onOpen={(item) => openResult(item, true)} onClose={clearResults} />
        ) : panel === "usage" ? (
            <MapUsageCard onClose={closePanel} />
        ) : panel === "detail" ? (
            <MapPlaceDetail listingHref={`${root}/properties/${MAP_PLACE_SLUG}`} onClose={closePanel} />
        ) : null;

    return (
        <div ref={rootRef} className="relative h-full w-full">
            <MapCanvas
                handleRef={mapRef}
                config={readyConfig}
                initialView={hasUrlView(init) ? computeInitialView(init, readyConfig) : sessionInitialView(savedView)}
                styleId={styleId}
                trafficOn={trafficOn}
                from={directions.open ? directions.from : null}
                to={directions.open ? directions.to : null}
                routes={directions.routes}
                activeRoute={directions.active}
                circle={null}
                results={resultMarkers}
                pois={overlayData.features}
                activePoi={panel === "place" ? activePoi : null}
                onPoiClick={(poi) => {
                    const point = { lat: poi.lat, lng: poi.lng };
                    directions.close();
                    setPicking(null);
                    // Chấm tiện ích đã có trên bản đồ: ghim "im lặng" (không vẽ ghim đè) và vẽ vòng nhấn quanh chấm.
                    pinAt(point, true);
                    setActiveResultId(null);
                    setActivePoi(point);
                    selectPoint(point, undefined, poi.name || POI_STYLE[poi.category].label);
                    setPanel("place");
                }}
                listings={listingMarkers}
                onListingClick={(id) => {
                    const pin = allListingPins.find((item) => item.listing.id === id);
                    if (!pin) return;
                    setOpenListing(pin);
                    setPanel("listing");
                }}
                onMarkerMenu={openMarkerMenu}
                activeResultId={activeResultId}
                onMapClick={onMapClick}
                onContextMenu={openMenu}
                onViewport={(next) => {
                    rememberViewport(next);
                    setViewport(next);
                    setViewportReady(true);
                }}
                onFailure={setFailed}
                evidence={visibleEvidence}
            />
            <div className="pointer-events-none absolute inset-0">
                <div className="flex h-full w-full min-h-0">
                    <div className="relative flex min-h-0 min-w-0 flex-1">
                        <div ref={mapAreaRef} className="relative min-h-0 min-w-0 flex-1">
                            {readyConfig.searchEnabled ? (
                                <div className="pointer-events-auto absolute top-2 right-2 left-2 z-20 flex max-w-xl items-start gap-2">
                                    <MapSearchBar
                                        value={queryValue}
                                        center={searchCenter}
                                        centerIsPin={ping !== null}
                                        radiusM={radiusM}
                                        filters={filters}
                                        open={popoverOpen}
                                        onOpenChange={(open) => {
                                            setPopoverOpen(open);
                                            if (open) setFilterOpen(false);
                                        }}
                                        focusSignal={searchFocus}
                                        onQueryChange={setQuery}
                                        onRadius={setRadius}
                                        onSelectPlace={onSearchSelect}
                                        onSearchAll={searchAll}
                                        onClear={clearResults}
                                    />
                                    <div className={`${popoverOpen ? "hidden sm:flex" : "flex"} shrink-0 items-start gap-2`}>
                                    <TopButton
                                        label={
                                            criterionWeights.changed > 0
                                                ? `Trọng số tiêu chí (${criterionWeights.changed} tiêu chí đã đổi)`
                                                : "Trọng số tiêu chí"
                                        }
                                        pressed={weightsOpen}
                                        badge={criterionWeights.changed}
                                        onClick={() => {
                                            setPopoverOpen(false);
                                            setFilterOpen(false);
                                            setWeightsOpen(true);
                                        }}
                                    >
                                        <Scale size={18} aria-hidden />
                                    </TopButton>
                                    <TopButton
                                        label={filterCount > 0 ? `Bộ lọc (${filterCount} đang áp dụng)` : "Bộ lọc"}
                                        pressed={filterOpen}
                                        badge={filterCount}
                                        onClick={() => {
                                            setPopoverOpen(false);
                                            setFilterOpen((open) => !open);
                                        }}
                                    >
                                        <SlidersHorizontal size={18} aria-hidden />
                                    </TopButton>
                                    <TopButton
                                        label="Địa điểm đã lưu"
                                        pressed={panel === "saved"}
                                        badge={saved.state.items.length}
                                        onClick={() => setPanel((current) => (current === "saved" ? null : "saved"))}
                                    >
                                        <Bookmark size={18} aria-hidden className={panel === "saved" ? "fill-green/20" : ""} />
                                    </TopButton>
                                    {isAdmin ? (
                                        <TopButton label="Mức dùng Vietmap" pressed={panel === "usage"} onClick={() => setPanel((current) => (current === "usage" ? null : "usage"))}>
                                            <Settings size={18} aria-hidden />
                                        </TopButton>
                                    ) : null}
                                    </div>
                                </div>
                            ) : (
                                <p className="pointer-events-auto absolute top-2 left-2 z-10 m-0 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                                    Tìm kiếm chưa được cấu hình.
                                </p>
                            )}
                            {filterOpen ? (
                                <div className="pointer-events-none absolute top-14 bottom-2 left-2 z-20 flex w-[calc(100%-1rem)] items-start sm:w-auto">
                                    <MapFilterPanel
                                        filters={filters}
                                        onClose={() => setFilterOpen(false)}
                                        onApply={setFilters}
                                    />
                                </div>
                            ) : null}
                            <div className="pointer-events-none absolute top-14 right-2 left-2 z-10 flex max-w-md flex-col gap-2">
                                {results?.status === "ready" && panel !== "results" ? (
                                    <p className="pointer-events-auto m-0 flex items-center gap-2 self-start rounded-full bg-white py-1 pr-1 pl-3 text-xs shadow-sm ring-1 ring-charcoal/10">
                                        <span>
                                            {results.items.length} kết quả “{results.text}” trong {formatRadius(results.radiusM)}
                                        </span>
                                        <button type="button" onClick={() => setPanel("results")} className="rounded-full bg-charcoal/5 px-2 py-1 font-semibold hover:bg-charcoal/10">
                                            Xem
                                        </button>
                                        <button type="button" onClick={clearResults} className="rounded-full bg-charcoal/5 px-2 py-1 font-semibold hover:bg-charcoal/10">
                                            Bỏ ghim
                                        </button>
                                    </p>
                                ) : null}
                                {overlayData.tooFar ? (
                                    <p className="pointer-events-auto m-0 flex items-center gap-2 self-start rounded-full bg-white py-1 pr-1 pl-3 text-xs shadow-sm ring-1 ring-charcoal/10">
                                        Phóng to để xem các điểm tiện ích đã bật
                                        <button
                                            type="button"
                                            onClick={() => mapRef.current?.setView({ zoom: POI_MIN_ZOOM + 1 })}
                                            className="rounded-full bg-charcoal/5 px-2 py-1 font-semibold hover:bg-charcoal/10"
                                        >
                                            Phóng to
                                        </button>
                                    </p>
                                ) : null}
                                {overlayData.failed ? (
                                    <p role="alert" className="pointer-events-auto m-0 self-start rounded-full bg-white px-3 py-1.5 text-xs text-red-700 shadow-sm">
                                        Không tải được một phần điểm tiện ích. Kéo bản đồ để thử lại.
                                    </p>
                                ) : null}
                                <MapUrlErrors errors={urlErrors} onDismiss={() => setUrlErrors([])} />
                                {failed ? (
                                    <p role="alert" className="pointer-events-auto m-0 rounded-lg bg-white px-3 py-2 text-sm text-red-700 shadow-sm">
                                        Không tải được bản đồ. Kiểm tra kết nối rồi tải lại trang.
                                    </p>
                                ) : null}
                                {notice ? (
                                    <p role="status" className="pointer-events-auto m-0 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                                        {notice}
                                    </p>
                                ) : null}
                            </div>
                            <MapLayerPicker
                                styleId={styleId}
                                onStyleChange={setStyleId}
                                trafficAvailable={trafficAvailable}
                                trafficOn={trafficOn}
                                onTrafficChange={setTrafficOn}
                                overlays={overlays}
                                onOverlaysChange={setOverlays}
                                listingCount={allListingPins.length}
                                onOverlayEnabled={() => {
                                    if (viewport.zoom < POI_MIN_ZOOM) mapRef.current?.zoomTo(POI_MIN_ZOOM);
                                }}
                            />
                            {visibleEvidence ? (
                                <EvidenceCaption overlay={visibleEvidence} loading={evidenceLoading} onFit={() => fitEvidence(visibleEvidence)} onClose={clearEvidence} />
                            ) : null}
                            <MapScaleBar zoom={viewport.zoom} latitude={viewport.lat} />
                            <MapZoomControls
                                onZoomIn={() => mapRef.current?.zoomIn()}
                                onZoomOut={() => mapRef.current?.zoomOut()}
                                onLocate={locate}
                                locating={locating}
                                bearing={viewport.bearing}
                                onResetNorth={() => mapRef.current?.resetNorth()}
                            />
                        </div>
                    </div>
                    {sidePanel}
                </div>
                {weightsOpen ? <MapWeightsDialog onClose={() => setWeightsOpen(false)} /> : null}
                {menu ? (
                    <MapContextMenu
                        at={menu.at}
                        bounds={menu.size}
                        onSelect={runContextAction}
                        onClose={closeMenu}
                        omit={menu.kind === "map" ? [] : ["clear-pin"]}
                        heading={
                            menu.kind === "me"
                                ? "Vị trí của tôi"
                                : menu.kind === "result"
                                  ? (() => {
                                        const index = resultPins.findIndex((item) => item.refId === menu.resultId);
                                        return index >= 0 ? `Kết quả ${index + 1}: ${resultPins[index].name}` : undefined;
                                    })()
                                  : undefined
                        }
                    />
                ) : null}
            </div>
        </div>
    );
}

/** Nút tròn trên thanh tìm kiếm, có badge số lượng. */
function TopButton({
    label,
    pressed,
    badge = 0,
    onClick,
    children,
}: {
    label: string;
    pressed: boolean;
    badge?: number;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            onClick={onClick}
            className={`relative inline-flex size-10 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${pressed ? "bg-white text-green ring-2 ring-green" : "bg-white text-charcoal/80 ring-charcoal/15 hover:bg-[#f4f4f4] hover:text-charcoal"}`}
        >
            {children}
            {badge > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] rounded-full bg-green px-1 text-center text-[10px] leading-[18px] font-semibold text-cream tabular-nums ring-2 ring-white">
                    {badge > 99 ? "99+" : badge}
                </span>
            ) : null}
        </button>
    );
}

/** `useSearchParams` cần Suspense để trang vẫn prerender được. */
export default function MapScreen(props: MapScreenProps) {
    return (
        <Suspense fallback={<div className="h-full w-full bg-white" />}>
            <MapScreenInner {...props} />
        </Suspense>
    );
}

/** Cùng một chỗ (lệch dưới ~1 m): dẫn chứng thuộc địa điểm đang mở. */
function sameSpot(a: MapPoint, b: MapPoint): boolean {
    return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5;
}

/** Thẻ giải thích dẫn chứng đang vẽ: câu mô tả, chú giải màu (nếu là lưới), nút đưa vào khung nhìn và đóng. */
function EvidenceCaption({
    overlay,
    loading,
    onFit,
    onClose,
}: {
    overlay: EvidenceOverlay;
    loading: boolean;
    onFit: () => void;
    onClose: () => void;
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-auto absolute top-14 left-1/2 z-10 w-[min(28rem,calc(100%-1rem))] -translate-x-1/2 rounded-lg bg-white/95 p-3 text-sm shadow-[0_4px_16px_rgba(16,17,17,0.18)] ring-1 ring-charcoal/10 backdrop-blur-sm lg:top-auto lg:bottom-6"
        >
            <div className="flex items-start gap-2">
                <MapPinned size={16} aria-hidden className="mt-0.5 shrink-0 text-green" />
                <p className="m-0 min-w-0 flex-1 leading-snug text-charcoal/85">
                    {overlay.caption}
                    {loading ? (
                        <span className="ml-1 inline-flex items-center gap-1 text-xs text-charcoal/55">
                            <Loader2 size={12} className="animate-spin" aria-hidden /> đang lấy đường đi…
                        </span>
                    ) : null}
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Ẩn dẫn chứng trên bản đồ"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-green"
                >
                    <X size={15} aria-hidden />
                </button>
            </div>
            {overlay.legend ? (
                <ul aria-label="Chú giải" className="m-0 mt-2 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[11px] text-charcoal/70">
                    {overlay.legend.map(([color, label]) => (
                        <li key={label} className="inline-flex items-center gap-1 tabular-nums">
                            <span aria-hidden className="size-3 rounded-sm ring-1 ring-charcoal/10" style={{ backgroundColor: color }} />
                            {label}
                        </li>
                    ))}
                </ul>
            ) : null}
            <button type="button" onClick={onFit} className="mt-1.5 bg-transparent p-0 text-xs font-semibold text-green hover:underline focus-visible:outline-2 focus-visible:outline-green">
                Xem toàn bộ dẫn chứng
            </button>
        </div>
    );
}
