"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getRoutes, isAbortError, mapErrorMessage } from "@/features/map/map.service";
import type { MapRoute, RouteVehicle, Waypoint } from "@/features/map/map.types";

export type RouteStatus = "idle" | "loading" | "ready" | "error";

export function useDirections() {
    const [open, setOpen] = useState(false);
    const [from, setFrom] = useState<Waypoint | null>(null);
    const [to, setTo] = useState<Waypoint | null>(null);
    const [vehicle, setVehicle] = useState<RouteVehicle>("motorcycle");
    const [routes, setRoutes] = useState<MapRoute[]>([]);
    const [active, setActive] = useState(0);
    const [status, setStatus] = useState<RouteStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [fitVersion, setFitVersion] = useState(0);
    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        controllerRef.current?.abort();
        if (!open || !from || !to) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- dọn kết quả khi điều kiện đầu vào mất
            setRoutes([]);
            setStatus("idle");
            setError(null);
            return;
        }
        const controller = new AbortController();
        controllerRef.current = controller;
        setStatus("loading");
        setError(null);
        getRoutes(from, to, vehicle, controller.signal)
            .then((result) => {
                setRoutes(result);
                setActive(0);
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
    }, [open, from, to, vehicle]);

    const swap = useCallback((): void => {
        setFrom(to);
        setTo(from);
    }, [from, to]);

    const close = useCallback((): void => {
        setOpen(false);
        setRoutes([]);
        setStatus("idle");
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
        routes,
        active,
        setActive,
        status,
        error,
        /** Tăng mỗi khi có kết quả tuyến mới: dùng để `fitBounds` đúng một lần. */
        fitVersion,
    };
}
