"use client";

import { Loader2, Navigation } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import type { ShellRoot } from "@/features/app/shell";
import { MAP_PLACE_SLUG } from "@/features/landing-page/data/listings";
import MapCanvas, {
    type MapHandle,
    type MapInitialView,
    type MapViewport,
} from "@/features/map/components/map-canvas";
import MapContextMenu, { type ContextAction } from "@/features/map/components/map-context-menu";
import MapDirectionsPanel from "@/features/map/components/map-directions-panel";
import MapFilterChips from "@/features/map/components/map-filter-chips";
import MapLayerPicker from "@/features/map/components/map-layer-picker";
import MapNearbyBar from "@/features/map/components/map-nearby-bar";
import MapPlaceDetail from "@/features/map/components/map-place-detail";
import MapPlacePanel from "@/features/map/components/map-place-panel";
import MapSavedPanel from "@/features/map/components/map-saved-panel";
import MapScaleBar from "@/features/map/components/map-scale-bar";
import MapSidebar from "@/features/map/components/map-sidebar";
import MapUrlErrors from "@/features/map/components/map-url-errors";
import MapUsageCard from "@/features/map/components/map-usage-card";
import MapZoomControls from "@/features/map/components/map-zoom-controls";
import PlaceSearchBox from "@/features/map/components/place-search-box";
import { useDirections } from "@/features/map/hooks/use-directions";
import { useMapConfig } from "@/features/map/hooks/use-map-config";
import { usePlaceSelection } from "@/features/map/hooks/use-place-selection";
import { placeKey, useSavedPlaces } from "@/features/map/hooks/use-saved-places";
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
    NEARBY_RADIUS,
    PIN_ZOOM,
    circleBounds,
    formatCoordinates,
    placeLink,
} from "@/features/map/map.geo";
import { isAbortError, reverseGeocode } from "@/features/map/map.service";
import {
    DEFAULT_MAP_CENTER,
    DEFAULT_MAP_ZOOM,
    readSavedMapView,
    writeSavedMapView,
    type SavedMapView,
} from "@/features/map/map-view-memory";
import type {
    MapConfig,
    MapPlace,
    MapPoint,
    MapStyleId,
    Waypoint,
} from "@/features/map/map.types";

interface MapScreenProps {
    placeId?: string;
    root?: ShellRoot;
}

type Panel = "place" | "directions" | "usage" | "detail" | "saved" | null;

const POINT_LABEL_FALLBACK = "Điểm đã chọn";
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
    const [viewport, setViewport] = useState<MapViewport>({ zoom: 12, lat: 21.03, lng: 105.83, bearing: 0, pitch: 0 });
    const [viewportReady, setViewportReady] = useState(false);
    const [panel, setPanel] = useState<Panel>(
        hasDirectionsInUrl ? "directions" : init.pin ? "place" : placeId !== undefined ? "detail" : null,
    );
    const [picking, setPicking] = useState<"from" | "to" | null>(null);
    const [failed, setFailed] = useState(false);
    const [locating, setLocating] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [menu, setMenu] = useState<{ point: MapPoint; at: { x: number; y: number }; size: { width: number; height: number } } | null>(null);
    const [nearby, setNearby] = useState<{ center: MapPoint; radiusM: number } | null>(null);
    const [searchFocus, setSearchFocus] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const lastWrittenRef = useRef(canonicalQuery(paramsString));
    const isAdmin = root === "/admin";
    const focus: MapPoint = { lat: viewport.lat, lng: viewport.lng };
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

    // Chuột trái chỉ dùng để chọn điểm đi/đến khi người dùng bấm "chọn trên bản đồ".
    const onMapClick = useCallback(
        (point: MapPoint): void => {
            if (!picking || !directions.open) return;
            setNotice(null);
            labelPoint(picking, point);
            setPicking(null);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps -- labelPoint đọc state mới nhất qua closure mỗi lần render
        [picking, directions.open],
    );

    // Chỉ một ghim duy nhất: điểm vừa bấm chuột phải, rồi điểm đang chọn, rồi tâm tìm lân cận.
    const dropped =
        menu?.point ?? (selection.status === "none" || directions.open ? null : selection.point) ?? nearby?.center ?? null;
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

    // Vừa mở chế độ lân cận hoặc đổi bán kính: đưa cả vòng tròn vào khung nhìn.
    const nearbyCenter = nearby?.center;
    const nearbyRadius = nearby?.radiusM;
    useEffect(() => {
        if (!nearbyCenter || !nearbyRadius) return;
        const timer = setTimeout(() => mapRef.current?.fitBounds(circleBounds(nearbyCenter, nearbyRadius)), 250);
        return () => clearTimeout(timer);
    }, [nearbyCenter, nearbyRadius]);

    const openMenu = useCallback((point: MapPoint, at: { x: number; y: number }): void => {
        const box = rootRef.current?.getBoundingClientRect();
        setMenu({ point, at, size: { width: box?.width ?? 0, height: box?.height ?? 0 } });
    }, []);

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
    function whereIsThis(point: MapPoint): void {
        setNotice(null);
        directions.close();
        setPicking(null);
        setNearby(null);
        selectPoint(point);
        setPanel("place");
    }

    function runContextAction(action: ContextAction): void {
        if (!menu) return;
        const { point } = menu;
        setMenu(null);
        if (action === "copy-coordinates") {
            void copyText(formatCoordinates(point), "Đã sao chép tọa độ.");
        } else if (action === "copy-link") {
            void copyText(placeLink(window.location.origin, pathname, point), "Đã sao chép liên kết tới địa điểm.");
        } else if (action === "directions") {
            directionsTo(point);
            return;
        } else if (action === "where") {
            whereIsThis(point);
            return;
        } else {
            clear();
            setPanel(null);
            setNearby({ center: point, radiusM: NEARBY_RADIUS.initial });
            setSearchFocus((value) => value + 1);
            return;
        }
    }

    function exitNearby(): void {
        setNearby(null);
    }

    function onSearchSelect(place: MapPlace): void {
        const point = { lat: place.lat, lng: place.lng };
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
                saved={saved.find(selection.point) !== undefined}
                saving={saved.busyKey === placeKey(selection.point)}
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
                            if (message) setNotice(message);
                        });
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
                onOpen={(item) => {
                    const point = { lat: item.lat, lng: item.lng };
                    directions.close();
                    setPicking(null);
                    selectPoint(point);
                    setPanel("place");
                    mapRef.current?.flyTo(point, PIN_ZOOM);
                }}
                onRemove={(item) => {
                    void saved.remove(item).then((message) => {
                        if (message) setNotice(message);
                    });
                }}
                onClose={closePanel}
            />
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
                circle={nearby}
                onMapClick={onMapClick}
                onContextMenu={openMenu}
                onViewport={(next) => {
                    rememberViewport(next);
                    setViewport(next);
                    setViewportReady(true);
                }}
                onFailure={setFailed}
            />
            <div className="pointer-events-none absolute inset-0">
                <div className="flex h-full w-full min-h-0">
                    <div className="relative flex min-h-0 min-w-0 flex-1">
                        <div className="hidden h-full lg:block">
                            <MapSidebar
                                root={root}
                                savedOpen={panel === "saved"}
                                savedCount={saved.state.items.length}
                                onSaved={() => setPanel((current) => (current === "saved" ? null : "saved"))}
                                onSettings={isAdmin ? () => setPanel("usage") : undefined}
                            />
                        </div>
                        <div className="relative min-h-0 min-w-0 flex-1">
                            {readyConfig.searchEnabled ? (
                                <div className="pointer-events-auto absolute top-2 right-2 left-2 z-10 flex max-w-md items-center gap-2">
                                    <PlaceSearchBox
                                        className="min-w-0 flex-1"
                                        label={nearby ? "Tìm kiếm lân cận" : "Tìm kiếm địa điểm"}
                                        placeholder={nearby ? `Tìm quanh đây trong ${nearby.radiusM} m` : "Tìm kiếm địa điểm, địa chỉ"}
                                        value={queryValue}
                                        searchOnValue
                                        filters={nearby ? { ...filters, radius: nearby.radiusM } : filters}
                                        focus={nearby ? nearby.center : focus}
                                        searchKey={nearby ? `${nearby.center.lat},${nearby.center.lng},${nearby.radiusM}` : ""}
                                        focusSignal={searchFocus}
                                        onQueryChange={setQuery}
                                        onSelect={onSearchSelect}
                                    />
                                    <button
                                        type="button"
                                        aria-label="Chỉ đường"
                                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-green text-cream shadow-sm"
                                        onClick={() => {
                                            directions.setOpen(true);
                                            setPanel("directions");
                                        }}
                                    >
                                        <Navigation size={18} aria-hidden />
                                    </button>
                                </div>
                            ) : (
                                <p className="pointer-events-auto absolute top-2 left-2 z-10 m-0 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                                    Tìm kiếm chưa được cấu hình.
                                </p>
                            )}
                            <div className="pointer-events-none absolute top-14 right-2 left-2 z-10 flex max-w-md flex-col gap-2">
                                {nearby ? (
                                    <MapNearbyBar
                                        center={nearby.center}
                                        radiusM={nearby.radiusM}
                                        onRadius={(radiusM) => setNearby({ ...nearby, radiusM })}
                                        onExit={exitNearby}
                                    />
                                ) : null}
                                <MapFilterChips filters={filters} onClear={() => setFilters({})} />
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
                            />
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
                {menu ? <MapContextMenu at={menu.at} bounds={menu.size} onSelect={runContextAction} onClose={closeMenu} /> : null}
            </div>
        </div>
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
