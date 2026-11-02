"use client";

import { Loader2, Navigation } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { ShellRoot } from "@/features/app/shell";
import { MAP_PLACE_SLUG } from "@/features/landing-page/data/listings";
import MapCanvas, { type MapHandle, type MapViewport } from "@/features/map/components/map-canvas";
import MapDirectionsPanel from "@/features/map/components/map-directions-panel";
import MapLayerPicker from "@/features/map/components/map-layer-picker";
import MapPlaceDetail from "@/features/map/components/map-place-detail";
import MapPlacePanel from "@/features/map/components/map-place-panel";
import MapScaleBar from "@/features/map/components/map-scale-bar";
import MapSidebar from "@/features/map/components/map-sidebar";
import MapUsageCard from "@/features/map/components/map-usage-card";
import MapZoomControls from "@/features/map/components/map-zoom-controls";
import PlaceSearchBox from "@/features/map/components/place-search-box";
import { useDirections } from "@/features/map/hooks/use-directions";
import { useMapConfig } from "@/features/map/hooks/use-map-config";
import { usePlaceSelection } from "@/features/map/hooks/use-place-selection";
import { isAbortError, reverseGeocode } from "@/features/map/map.service";
import type { MapPlace, MapPoint, MapStyleId, Waypoint } from "@/features/map/map.types";

interface MapScreenProps {
    placeId?: string;
    root?: ShellRoot;
}

type Panel = "place" | "directions" | "usage" | "detail" | null;

const POINT_LABEL_FALLBACK = "Điểm đã chọn";

function toWaypoint(place: MapPlace): Waypoint {
    return { lat: place.lat, lng: place.lng, label: place.name || place.display || POINT_LABEL_FALLBACK };
}

export default function MapScreen({ placeId, root = "/app" }: MapScreenProps) {
    const router = useRouter();
    const mapRef = useRef<MapHandle>(null);
    const configState = useMapConfig();
    const { selection, selectPoint, clear } = usePlaceSelection();
    const directions = useDirections();

    const [styleId, setStyleId] = useState<MapStyleId>("tm");
    const [trafficOn, setTrafficOn] = useState(false);
    const [viewport, setViewport] = useState<MapViewport>({ zoom: 12, lat: 21.03, lng: 105.83, bearing: 0 });
    const [panel, setPanel] = useState<Panel>(placeId !== undefined ? "detail" : null);
    const [picking, setPicking] = useState<"from" | "to" | null>(null);
    const [failed, setFailed] = useState(false);
    const [locating, setLocating] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const isAdmin = root === "/admin";
    const focus: MapPoint = { lat: viewport.lat, lng: viewport.lng };

    // Fit tuyến đúng một lần cho mỗi kết quả mới.
    const { fitVersion, routes, active } = directions;
    useEffect(() => {
        const route = routes[active];
        if (fitVersion === 0 || !route) return;
        mapRef.current?.fitBounds(route.bbox);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi có kết quả mới
    }, [fitVersion]);

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

    function labelPoint(target: "from" | "to", point: MapPoint): void {
        const provisional: Waypoint = { ...point, label: POINT_LABEL_FALLBACK };
        if (target === "from") directions.setFrom(provisional);
        else directions.setTo(provisional);
        const controller = new AbortController();
        reverseGeocode(point, controller.signal)
            .then((place) => {
                if (!place) return;
                const named: Waypoint = { ...point, label: place.name || place.display };
                if (target === "from") directions.setFrom((current) => (current && current.lat === point.lat ? named : current));
                else directions.setTo((current) => (current && current.lat === point.lat ? named : current));
            })
            .catch((error: unknown) => {
                if (!isAbortError(error)) setNotice("Không lấy được tên địa điểm; vẫn dùng tọa độ đã chọn.");
            });
    }

    const onMapClick = useCallback(
        (point: MapPoint): void => {
            setNotice(null);
            if (directions.open) {
                const target = picking ?? (!directions.from ? "from" : !directions.to ? "to" : null);
                if (!target) return;
                labelPoint(target, point);
                setPicking(null);
                return;
            }
            selectPoint(point);
            setPanel("place");
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps -- labelPoint đọc state mới nhất qua closure mỗi lần render
        [directions.open, directions.from, directions.to, picking, selectPoint],
    );

    function onSearchSelect(place: MapPlace): void {
        const point = { lat: place.lat, lng: place.lng };
        selectPoint(point, place);
        setPanel("place");
        mapRef.current?.flyTo(point, 16);
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
            <div className="flex h-full w-full items-center justify-center bg-neutral-100" role="status">
                <Loader2 className="animate-spin text-charcoal/60" aria-hidden />
                <span className="ml-2 text-sm text-charcoal/70">Đang tải bản đồ…</span>
            </div>
        );
    }
    if (configState.status === "error" || !configState.config.tilesEnabled) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-neutral-100 p-6 text-center" role="alert">
                <p className="m-0 max-w-sm text-sm text-charcoal/80">
                    {configState.status === "error"
                        ? configState.message
                        : "Bản đồ chưa được cấu hình. Quản trị viên cần đặt khóa Tilemap của Vietmap."}
                </p>
            </div>
        );
    }
    const config = configState.config;
    const pin = selection.status === "none" || directions.open ? null : selection.point;
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
        ) : panel === "usage" ? (
            <MapUsageCard onClose={closePanel} />
        ) : panel === "detail" ? (
            <MapPlaceDetail listingHref={`${root}/properties/${MAP_PLACE_SLUG}`} onClose={closePanel} />
        ) : null;

    return (
        <div className="relative h-full w-full">
            <MapCanvas
                handleRef={mapRef}
                config={config}
                styleId={styleId}
                trafficOn={trafficOn}
                pin={pin}
                from={directions.open ? directions.from : null}
                to={directions.open ? directions.to : null}
                routes={directions.routes}
                activeRoute={directions.active}
                onMapClick={onMapClick}
                onPinDrag={(point) => selectPoint(point)}
                onViewport={setViewport}
                onFailure={setFailed}
            />
            <div className="pointer-events-none absolute inset-0">
                <div className="flex h-full w-full min-h-0">
                    <div className="relative flex min-h-0 min-w-0 flex-1">
                        <div className="hidden h-full lg:block">
                            <MapSidebar onSettings={isAdmin ? () => setPanel("usage") : undefined} />
                        </div>
                        <div className="relative min-h-0 min-w-0 flex-1">
                            {config.searchEnabled ? (
                                <div className="pointer-events-auto absolute top-2 right-2 left-2 z-10 flex max-w-md items-center gap-2">
                                    <PlaceSearchBox
                                        className="min-w-0 flex-1"
                                        label="Tìm kiếm địa điểm"
                                        placeholder="Tìm kiếm địa điểm, địa chỉ"
                                        value=""
                                        focus={focus}
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
                            {failed ? (
                                <p
                                    role="alert"
                                    className="pointer-events-auto absolute top-16 left-2 z-10 m-0 rounded-lg bg-white px-3 py-2 text-sm text-red-700 shadow-sm"
                                >
                                    Không tải được bản đồ. Kiểm tra kết nối rồi tải lại trang.
                                </p>
                            ) : null}
                            {notice ? (
                                <p
                                    role="status"
                                    className="pointer-events-auto absolute top-16 right-2 z-10 m-0 max-w-xs rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
                                >
                                    {notice}
                                </p>
                            ) : null}
                            <MapLayerPicker
                                styleId={styleId}
                                onStyleChange={setStyleId}
                                trafficAvailable={config.trafficStyleUrl !== null}
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
            </div>
        </div>
    );
}
