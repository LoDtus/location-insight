"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getRoutes, isAbortError, mapErrorMessage } from "@/features/map/map.service";
import type { MapRoute, RouteVehicle, Waypoint } from "@/features/map/map.types";

export type RouteStatus = "idle" | "loading" | "ready" | "error";

export interface DirectionsInitial {
    open?: boolean;
    from?: Waypoint | null;
    to?: Waypoint | null;
    vehicle?: RouteVehicle;
    alternatives?: boolean;
    avoid?: string | null;
    departAt?: string | null;
    routeIndex?: number;
}

function key(point: Waypoint | null): string | null {
    return point ? `${point.lat},${point.lng}` : null;
}

export function useDirections(initial: DirectionsInitial = {}) {
    const [open, setOpen] = useState(initial.open ?? false);
    const [from, setFrom] = useState<Waypoint | null>(initial.from ?? null);
    const [to, setTo] = useState<Waypoint | null>(initial.to ?? null);
    const [vehicle, setVehicle] = useState<RouteVehicle>(initial.vehicle ?? "motorcycle");
    const [alternatives, setAlternatives] = useState(initial.alternatives ?? true);
    const [avoid, setAvoid] = useState<string | null>(initial.avoid ?? null);
    const [departAt, setDepartAt] = useState<string | null>(initial.departAt ?? null);
    const [routes, setRoutes] = useState<MapRoute[]>([]);
    const [active, setActive] = useState(initial.routeIndex ?? 0);
    const [status, setStatus] = useState<RouteStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [indexError, setIndexError] = useState<string | null>(null);
    const [fitVersion, setFitVersion] = useState(0);
    const controllerRef = useRef<AbortController | null>(null);
    /** Tuyến được chọn sẵn từ URL: áp dụng một lần khi kết quả về. */
    const pendingIndexRef = useRef(initial.routeIndex ?? 0);
    const pointsRef = useRef({ from, to });
    useEffect(() => {
        pointsRef.current = { from, to };
    });

    // Chỉ chạy lại khi TỌA ĐỘ đổi (nhãn được cập nhật sau reverse không gọi lại Route).
    const fromKey = key(from);
    const toKey = key(to);
    useEffect(() => {
        controllerRef.current?.abort();
        const { from: start, to: end } = pointsRef.current;
        if (!open || !start || !end) {
            setRoutes([]);
            setStatus("idle");
            setError(null);
            return;
        }
        const controller = new AbortController();
        controllerRef.current = controller;
        setStatus("loading");
        setError(null);
        getRoutes(start, end, vehicle, { alternatives, avoid, departAt }, controller.signal)
            .then((result) => {
                const pending = pendingIndexRef.current;
                pendingIndexRef.current = 0;
                setRoutes(result);
                if (pending < result.length) {
                    setActive(pending);
                    setIndexError(null);
                } else {
                    setActive(0);
                    setIndexError(`route=${pending}: chỉ có ${result.length} tuyến, đã dùng tuyến 0.`);
                }
                setStatus("ready");
                setFitVersion((value) => value + 1);
            })
            .catch((failure: unknown) => {
                if (isAbortError(failure)) return;
                setRoutes([]);
                setStatus("error");
                setError(mapErrorMessage(failure, "Không tìm được đường, vui lòng thử lại."));
            });
        return () => controller.abort();
    }, [open, fromKey, toKey, vehicle, alternatives, avoid, departAt]);

    const swap = useCallback((): void => {
        setFrom(to);
        setTo(from);
    }, [from, to]);

    const close = useCallback((): void => {
        setOpen(false);
        setRoutes([]);
        setStatus("idle");
    }, []);

    const setPendingIndex = useCallback((index: number): void => {
        pendingIndexRef.current = index;
    }, []);

    return {
        open,
        setOpen,
        close,
        from,
        setFrom,
        to,
        setTo,
        swap,
        vehicle,
        setVehicle,
        alternatives,
        setAlternatives,
        avoid,
        setAvoid,
        departAt,
        setDepartAt,
        routes,
        active,
        setActive,
        status,
        error,
        indexError,
        setPendingIndex,
        /** Tăng mỗi khi có kết quả tuyến mới: dùng để `fitBounds` đúng một lần. */
        fitVersion,
    };
}
