"use client";

import { ArrowUpDown, Bike, Car, Crosshair, Loader2, LocateFixed, X } from "lucide-react";

import MapPanel from "@/features/map/components/map-panel";
import PlaceSearchBox from "@/features/map/components/place-search-box";
import { formatDistance, formatDuration, signLabel } from "@/features/map/map.geo";
import type { MapPlace, MapPoint, MapRoute, RouteVehicle, Waypoint } from "@/features/map/map.types";
import type { RouteStatus } from "@/features/map/hooks/use-directions";

interface MapDirectionsPanelProps {
    from: Waypoint | null;
    to: Waypoint | null;
    vehicle: RouteVehicle;
    routes: MapRoute[];
    active: number;
    status: RouteStatus;
    error: string | null;
    indexError: string | null;
    alternatives: boolean;
    avoid: string | null;
    departAt: string | null;
    onAlternatives: (value: boolean) => void;
    onClearAvoid: () => void;
    onClearDepartAt: () => void;
    focus: MapPoint | null;
    picking: "from" | "to" | null;
    onPick: (target: "from" | "to" | null) => void;
    onFrom: (place: MapPlace | null) => void;
    onTo: (place: MapPlace | null) => void;
    onSwap: () => void;
    onVehicle: (vehicle: RouteVehicle) => void;
    onSelectRoute: (index: number) => void;
    onMyLocation: () => void;
    onStep: (point: [number, number]) => void;
    onClose: () => void;
}

function formatDepartAt(iso: string): string {
    return new Date(iso).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

const VEHICLES: Array<{ id: RouteVehicle; label: string; icon: typeof Car }> = [
    { id: "motorcycle", label: "Xe máy", icon: Bike },
    { id: "car", label: "Ô tô", icon: Car },
];

export default function MapDirectionsPanel(props: MapDirectionsPanelProps) {
    const { from, to, vehicle, routes, active, status, error, indexError, focus, picking } = props;
    const route = routes[active];
    const fastest = routes.length > 1 ? Math.min(...routes.map((item) => item.durationS)) : null;

    return (
        <MapPanel title="Chỉ đường" titleId="tieu-de-chi-duong" onClose={props.onClose}>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <PlaceSearchBox
                        className="min-w-0 flex-1"
                        label="Điểm đi"
                        placeholder="Chọn điểm đi"
                        value={from?.label ?? ""}
                        focus={focus}
                        onSelect={props.onFrom}
                        onClear={() => props.onFrom(null)}
                    />
                    <button
                        type="button"
                        aria-label="Chọn điểm đi trên bản đồ"
                        aria-pressed={picking === "from"}
                        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full border ${picking === "from" ? "border-green bg-green text-cream" : "border-charcoal/15 bg-white"}`}
                        onClick={() => props.onPick(picking === "from" ? null : "from")}
                    >
                        <Crosshair size={16} />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <PlaceSearchBox
                        className="min-w-0 flex-1"
                        label="Điểm đến"
                        placeholder="Chọn điểm đến"
                        value={to?.label ?? ""}
                        focus={focus}
                        onSelect={props.onTo}
                        onClear={() => props.onTo(null)}
                    />
                    <button
                        type="button"
                        aria-label="Chọn điểm đến trên bản đồ"
                        aria-pressed={picking === "to"}
                        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full border ${picking === "to" ? "border-green bg-green text-cream" : "border-charcoal/15 bg-white"}`}
                        onClick={() => props.onPick(picking === "to" ? null : "to")}
                    >
                        <Crosshair size={16} />
                    </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        className="inline-flex min-h-9 items-center gap-1 rounded-full border bg-white px-3 text-xs font-semibold border-charcoal/15"
                        onClick={props.onMyLocation}
                    >
                        <LocateFixed size={14} aria-hidden /> Vị trí của tôi làm điểm đi
                    </button>
                    <button
                        type="button"
                        aria-label="Đổi chiều điểm đi và điểm đến"
                        className="inline-flex size-9 items-center justify-center rounded-full border bg-white border-charcoal/15"
                        onClick={props.onSwap}
                    >
                        <ArrowUpDown size={16} />
                    </button>
                </div>
                {picking ? (
                    <p className="m-0 text-xs text-green" role="status">
                        Bấm vào bản đồ để chọn {picking === "from" ? "điểm đi" : "điểm đến"}.
                    </p>
                ) : null}
            </div>

            <div role="radiogroup" aria-label="Phương tiện" className="grid grid-cols-2 gap-2">
                {VEHICLES.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="radio"
                            aria-checked={vehicle === item.id}
                            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold ${vehicle === item.id ? "border-green bg-green text-cream" : "border-charcoal/15 bg-white"}`}
                            onClick={() => props.onVehicle(item.id)}
                        >
                            <Icon size={16} aria-hidden /> {item.label}
                        </button>
                    );
                })}
            </div>

            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={props.alternatives}
                    onChange={(event) => props.onAlternatives(event.target.checked)}
                />
                Hiện tuyến thay thế
            </label>
            {props.avoid || props.departAt ? (
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Tùy chọn tuyến đang áp dụng">
                    {props.avoid ? (
                        <li className="inline-flex items-center gap-1 rounded-full bg-charcoal/5 py-1 pr-1 pl-3 text-xs">
                            Tránh phà
                            <button type="button" aria-label="Bỏ tùy chọn tránh phà" className="inline-flex size-6 items-center justify-center rounded-full hover:bg-charcoal/10" onClick={props.onClearAvoid}>
                                <X size={12} />
                            </button>
                        </li>
                    ) : null}
                    {props.departAt ? (
                        <li className="inline-flex items-center gap-1 rounded-full bg-charcoal/5 py-1 pr-1 pl-3 text-xs">
                            Khởi hành {formatDepartAt(props.departAt)}
                            <button type="button" aria-label="Bỏ giờ khởi hành" className="inline-flex size-6 items-center justify-center rounded-full hover:bg-charcoal/10" onClick={props.onClearDepartAt}>
                                <X size={12} />
                            </button>
                        </li>
                    ) : null}
                </ul>
            ) : null}
            {indexError ? (
                <p className="m-0 text-xs text-amber-800" role="status">
                    {indexError}
                </p>
            ) : null}

            {status === "loading" ? (
                <p className="m-0 flex items-center gap-2 text-sm text-charcoal/70" role="status">
                    <Loader2 size={16} className="animate-spin" aria-hidden /> Đang tìm đường…
                </p>
            ) : null}
            {status === "error" && error ? (
                <p className="m-0 text-sm text-red-700" role="alert">
                    {error}
                </p>
            ) : null}
            {status === "idle" && (!from || !to) ? (
                <p className="m-0 text-sm text-charcoal/60">Chọn điểm đi và điểm đến để xem đường.</p>
            ) : null}

            {routes.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Các tuyến đường">
                    {routes.map((item, index) => (
                        <li key={index}>
                            <button
                                type="button"
                                aria-pressed={index === active}
                                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left ${index === active ? "border-green bg-green/5" : "border-charcoal/15 bg-white"}`}
                                onClick={() => props.onSelectRoute(index)}
                            >
                                <span>
                                    <span className="block text-base font-semibold">{formatDuration(item.durationS)}</span>
                                    <span className="block text-xs text-charcoal/65">{formatDistance(item.distanceM)}</span>
                                </span>
                                {fastest !== null && item.durationS === fastest ? (
                                    <span className="rounded-full bg-green px-2 py-0.5 text-xs font-semibold text-cream">Nhanh nhất</span>
                                ) : null}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}

            {route ? (
                <ol className="m-0 flex list-none flex-col p-0" aria-label="Các bước đi">
                    {route.steps.map((step, index) => (
                        <li key={index} className="border-t border-charcoal/10 first:border-t-0">
                            <button
                                type="button"
                                className="flex w-full items-start gap-3 px-1 py-2 text-left"
                                onClick={() => {
                                    const point = route.geometry[Math.min(index, route.geometry.length - 1)];
                                    if (point) props.onStep(point);
                                }}
                            >
                                <span aria-hidden className="w-6 shrink-0 text-center text-lg leading-6">
                                    {signLabel(step.sign)}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm">{step.text}</span>
                                    {step.distanceM > 0 ? (
                                        <span className="block text-xs text-charcoal/55">{formatDistance(step.distanceM)}</span>
                                    ) : null}
                                </span>
                            </button>
                        </li>
                    ))}
                </ol>
            ) : null}
            {route && route.congestion ? (
                <p className="m-0 text-[11px] text-charcoal/55">
                    Màu tuyến: xanh lá thông thoáng · vàng chậm · cam đông · đỏ ùn tắc · xanh dương chưa có dữ liệu.
                </p>
            ) : null}
        </MapPanel>
    );
}
