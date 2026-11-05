"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { listSavedPlaces, mapErrorMessage, removeSavedPlace, savePlace, updateSavedPlace } from "@/features/map/map.service";
import type { MapPlaceKind, MapPoint, SavedPlace } from "@/features/map/map.types";

/** Bán kính coi một điểm là địa điểm đã lưu, khớp PLACE_RADIUS_M ở backend (place-identity.ts). */
export const SAVED_MATCH_M = 20;
/** Khớp MAP_COMPARE_MAX ở backend. */
export const COMPARE_MAX = 6;

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

/** Tên hiển thị: tên gợi nhớ nếu có, không thì tên gốc. */
export function savedTitle(item: Pick<SavedPlace, "label" | "name">): string {
    return item.label?.trim() || item.name;
}

export type SavedState =
    | { status: "idle"; items: SavedPlace[] }
    | { status: "loading"; items: SavedPlace[] }
    | { status: "ready"; items: SavedPlace[] }
    | { status: "error"; items: SavedPlace[]; message: string };

/*
 * Store dùng chung trong tab (bản đồ, thanh bên có badge "So sánh", trang so sánh): tải một lần, cập nhật tại chỗ
 * sau mỗi thao tác. Xóa khi đăng xuất để người dùng sau trên cùng máy không thấy dữ liệu cũ.
 */
let state: SavedState = { status: "idle", items: [] };
let busyKey: string | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const IDLE: SavedState = { status: "idle", items: [] };

function emit(): void {
    for (const listener of listeners) listener();
}

function setState(next: SavedState | ((current: SavedState) => SavedState)): void {
    state = typeof next === "function" ? next(state) : next;
    emit();
}

function setBusy(key: string | null): void {
    busyKey = key;
    emit();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function replaceItem(saved: SavedPlace): void {
    setState((current) => ({ ...current, items: current.items.map((item) => (item.id === saved.id ? saved : item)) }));
}

export function reloadSavedPlaces(): Promise<void> {
    if (inflight) return inflight;
    if (state.status === "idle") setState({ status: "loading", items: [] });
    inflight = listSavedPlaces()
        .then((items) => setState({ status: "ready", items }))
        .catch((error: unknown) =>
            setState((current) => ({ status: "error", items: current.items, message: mapErrorMessage(error, "Không tải được địa điểm đã lưu.") })),
        )
        .finally(() => {
            inflight = null;
        });
    return inflight;
}

/** Gọi khi đăng xuất. */
export function resetSavedPlaces(): void {
    state = IDLE;
    busyKey = null;
    emit();
}

/** Lưu nếu chưa lưu, bỏ lưu nếu đã lưu. Trả về thông báo lỗi (nếu có). */
async function toggle(input: { point: MapPoint; name: string; address: string; kind?: MapPlaceKind }): Promise<string | null> {
    const existing = nearestSaved(state.items, input.point);
    setBusy(existing?.id ?? pendingKey(input.point));
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
        setBusy(null);
    }
}

async function remove(item: SavedPlace): Promise<string | null> {
    setBusy(item.id);
    try {
        await removeSavedPlace(item.id);
        setState((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }));
        return null;
    } catch (error) {
        return mapErrorMessage(error, "Không xóa được địa điểm đã lưu.");
    } finally {
        setBusy(null);
    }
}

/** Tên gợi nhớ / ghi chú / so sánh. Trả về thông báo lỗi (nếu có). */
async function update(item: SavedPlace, patch: { label?: string | null; note?: string; compared?: boolean }): Promise<string | null> {
    setBusy(item.id);
    try {
        replaceItem(await updateSavedPlace(item.id, patch));
        return null;
    } catch (error) {
        return mapErrorMessage(error, "Không cập nhật được địa điểm đã lưu.");
    } finally {
        setBusy(null);
    }
}

const getState = (): SavedState => state;
const getServerState = (): SavedState => IDLE;
const getBusy = (): string | null => busyKey;
const getServerBusy = (): null => null;

/** Danh sách địa điểm đã lưu của người dùng (dùng chung toàn tab, tải lần đầu khi cần). */
export function useSavedPlaces() {
    const current = useSyncExternalStore(subscribe, getState, getServerState);
    const busy = useSyncExternalStore(subscribe, getBusy, getServerBusy);

    useEffect(() => {
        if (state.status === "idle") void reloadSavedPlaces();
    }, []);

    const find = useCallback((point: MapPoint): SavedPlace | undefined => nearestSaved(current.items, point), [current.items]);
    const reload = useCallback((): void => void reloadSavedPlaces(), []);

    return { state: current, busyKey: busy, find, toggle, remove, update, reload };
}

/** Số địa điểm trong danh sách so sánh (badge ở thanh bên). `enabled=false` khi chưa đăng nhập. */
export function useCompareCount(enabled: boolean): number {
    const current = useSyncExternalStore(subscribe, getState, getServerState);
    useEffect(() => {
        if (enabled && state.status === "idle") void reloadSavedPlaces();
    }, [enabled]);
    return current.items.filter((item) => item.compared).length;
}
