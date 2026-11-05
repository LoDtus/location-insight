"use client";

import { useCallback, useEffect, useState } from "react";

import { listSavedPlaces, mapErrorMessage, removeSavedPlace, savePlace } from "@/features/map/map.service";
import type { MapPlaceKind, MapPoint, SavedPlace } from "@/features/map/map.types";

/** Bán kính coi một điểm là địa điểm đã lưu, khớp PLACE_RADIUS_M ở backend (place-identity.ts). */
export const SAVED_MATCH_M = 20;

function distanceM(a: MapPoint, b: MapPoint): number {
    const rad = (deg: number): number => (deg * Math.PI) / 180;
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

/** Mục đã lưu gần điểm nhất trong bán kính (backend gom địa điểm theo địa chỉ/bán kính nên lệch vài mét vẫn là một). */
export function nearestSaved(items: readonly SavedPlace[], point: MapPoint): SavedPlace | undefined {
    let best: { item: SavedPlace; distance: number } | null = null;
    for (const item of items) {
        const distance = distanceM(point, item);
        if (distance <= SAVED_MATCH_M && (!best || distance < best.distance)) best = { item, distance };
    }
    return best?.item;
}

/** Khóa "đang bận" cho một điểm chưa có mục đã lưu. */
export function pendingKey(point: MapPoint): string {
    return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
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

    const find = useCallback((point: MapPoint): SavedPlace | undefined => nearestSaved(state.items, point), [state.items]);

    /** Lưu nếu chưa lưu, bỏ lưu nếu đã lưu. Trả về thông báo lỗi (nếu có) để màn hình hiện. */
    const toggle = useCallback(
        async (input: { point: MapPoint; name: string; address: string; kind?: MapPlaceKind }): Promise<string | null> => {
            const existing = nearestSaved(state.items, input.point);
            const key = existing?.id ?? pendingKey(input.point);
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
        setBusyKey(item.id);
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
