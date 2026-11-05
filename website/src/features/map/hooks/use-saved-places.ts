"use client";

import { useCallback, useEffect, useState } from "react";

import { listSavedPlaces, mapErrorMessage, removeSavedPlace, savePlace } from "@/features/map/map.service";
import type { MapPlaceKind, MapPoint, SavedPlace } from "@/features/map/map.types";

/** Khóa tọa độ giống backend (`lat,lng` 5 chữ số) để biết một điểm đã được lưu chưa. */
export function placeKey(point: MapPoint): string {
    return `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
}

export type SavedState =
    | { status: "loading"; items: SavedPlace[] }
    | { status: "ready"; items: SavedPlace[] }
    | { status: "error"; items: SavedPlace[]; message: string };

/** Danh sách địa điểm đã lưu của người dùng, tải một lần khi vào bản đồ. */
export function useSavedPlaces() {
    const [state, setState] = useState<SavedState>({ status: "loading", items: [] });
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const reload = useCallback((): void => {
        const controller = new AbortController();
        listSavedPlaces(controller.signal)
            .then((items) => setState({ status: "ready", items }))
            .catch((error: unknown) =>
                setState((current) => ({ status: "error", items: current.items, message: mapErrorMessage(error, "Không tải được địa điểm đã lưu.") })),
            );
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const find = useCallback((point: MapPoint): SavedPlace | undefined => state.items.find((item) => item.placeKey === placeKey(point)), [state.items]);

    /** Lưu nếu chưa lưu, bỏ lưu nếu đã lưu. Trả về thông báo lỗi (nếu có) để màn hình hiện. */
    const toggle = useCallback(
        async (input: { point: MapPoint; name: string; address: string; kind?: MapPlaceKind }): Promise<string | null> => {
            const key = placeKey(input.point);
            const existing = state.items.find((item) => item.placeKey === key);
            setBusyKey(key);
            try {
                if (existing) {
                    await removeSavedPlace(existing.id);
                    setState((current) => ({ ...current, items: current.items.filter((item) => item.id !== existing.id) }));
                } else {
                    const saved = await savePlace({ lat: input.point.lat, lng: input.point.lng, name: input.name, address: input.address, kind: input.kind });
                    setState((current) => ({ ...current, items: [saved, ...current.items.filter((item) => item.id !== saved.id)] }));
                }
                return null;
            } catch (error) {
                return mapErrorMessage(error, existing ? "Không bỏ lưu được địa điểm." : "Không lưu được địa điểm.");
            } finally {
                setBusyKey(null);
            }
        },
        [state.items],
    );

    const remove = useCallback(async (item: SavedPlace): Promise<string | null> => {
        setBusyKey(item.placeKey);
        try {
            await removeSavedPlace(item.id);
            setState((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }));
            return null;
        } catch (error) {
            return mapErrorMessage(error, "Không xóa được địa điểm đã lưu.");
        } finally {
            setBusyKey(null);
        }
    }, []);

    return { state, busyKey, find, toggle, remove, reload };
}
