"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isAbortError, mapErrorMessage, reverseGeocode } from "@/features/map/map.service";
import type { MapPlace, MapPoint } from "@/features/map/map.types";

export type PlaceSelection =
    | { status: "none" }
    | { status: "loading"; point: MapPoint }
    | { status: "ready"; point: MapPoint; place: MapPlace | null }
    | { status: "error"; point: MapPoint; message: string };

/** Ghim đang chọn + địa chỉ của nó. Mỗi lần chọn mới hủy lần reverse trước. */
export function usePlaceSelection() {
    const [selection, setSelection] = useState<PlaceSelection>({ status: "none" });
    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => controllerRef.current?.abort(), []);

    /** `nameOverride`: điểm đã biết tên (vd. điểm tiện ích trên lớp bản đồ) nhưng vẫn lấy địa chỉ bằng Reverse. */
    const selectPoint = useCallback((point: MapPoint, known?: MapPlace, nameOverride?: string): void => {
        controllerRef.current?.abort();
        if (known) {
            setSelection({ status: "ready", point, place: known });
            return;
        }
        const controller = new AbortController();
        controllerRef.current = controller;
        setSelection({ status: "loading", point });
        reverseGeocode(point, controller.signal)
            .then((place) =>
                setSelection({
                    status: "ready",
                    point,
                    place: nameOverride
                        ? {
                              ...(place ?? { lat: point.lat, lng: point.lng, address: "", addressOld: null, display: "" }),
                              name: nameOverride,
                              kind: "poi",
                              distanceM: 0,
                          }
                        : place,
                }),
            )
            .catch((error: unknown) => {
                if (isAbortError(error)) return;
                setSelection({
                    status: "error",
                    point,
                    message: mapErrorMessage(error, "Không lấy được địa chỉ cho điểm này."),
                });
            });
    }, []);

    const clear = useCallback((): void => {
        controllerRef.current?.abort();
        setSelection({ status: "none" });
    }, []);

    return { selection, selectPoint, clear };
}
