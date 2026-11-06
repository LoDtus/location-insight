"use client";

import { useEffect, useSyncExternalStore } from "react";

import { getWeights, mapErrorMessage, resetWeights, setWeight } from "@/features/map/map.service";
import type { WeightsView } from "@/features/map/map.types";

export type WeightsState =
    | { status: "idle" | "loading"; view: WeightsView | null; version: number }
    | { status: "ready"; view: WeightsView; version: number }
    | { status: "error"; view: WeightsView | null; version: number; message: string };

/*
 * Trọng số tiêu chí dùng chung trong tab (nút quản lý trên bản đồ, nút trọng số trong thẻ Địa điểm). `version` tăng
 * mỗi lần đổi để phần đánh giá đọc lại điểm. Xóa khi đăng xuất.
 */
const IDLE: WeightsState = { status: "idle", view: null, version: 0 };
let state: WeightsState = IDLE;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function load(): Promise<void> {
    if (inflight) return inflight;
    state = { ...state, status: "loading" } as WeightsState;
    emit();
    inflight = getWeights()
        .then((view) => {
            state = { status: "ready", view, version: state.version };
        })
        .catch((error: unknown) => {
            state = { status: "error", view: state.view, version: state.version, message: mapErrorMessage(error, "Không tải được trọng số tiêu chí.") };
        })
        .finally(() => {
            inflight = null;
            emit();
        });
    return inflight;
}

/** Trọng số mới cho các tiêu chí (null = về mặc định) áp ngay lên view hiện có. */
function applyLocally(view: WeightsView, patch: Map<string, number | null>): WeightsView {
    const criteria = view.criteria.map((item) => {
        if (!patch.has(item.id)) return item;
        const weight = patch.get(item.id) ?? item.defaultWeight;
        return { ...item, weight, custom: weight !== item.defaultWeight };
    });
    return { ...view, criteria, changed: criteria.filter((item) => item.custom).length };
}

/**
 * Đổi lạc quan: cập nhật giao diện ngay (không chờ mạng, không khóa danh sách nên không nháy), rồi lấy kết quả
 * server làm chuẩn; lỗi thì trả về trạng thái trước đó. `version` tăng sau khi server lưu xong để phần đánh giá
 * đọc lại điểm.
 */
async function change(patch: Map<string, number | null>, action: () => Promise<WeightsView>, fallback: string): Promise<string | null> {
    const before = state;
    if (state.view) {
        state = { status: "ready", view: applyLocally(state.view, patch), version: state.version };
        emit();
    }
    try {
        const view = await action();
        state = { status: "ready", view, version: state.version + 1 };
        emit();
        return null;
    } catch (error) {
        state = before;
        emit();
        return mapErrorMessage(error, fallback);
    }
}

export function resetWeightsStore(): void {
    state = IDLE;
    emit();
}

const getState = (): WeightsState => state;
const getServerState = (): WeightsState => IDLE;

export function useCriterionWeights(enabled = true) {
    const current = useSyncExternalStore(subscribe, getState, getServerState);
    useEffect(() => {
        if (enabled && state.status === "idle") void load();
    }, [enabled]);
    return {
        state: current,
        changed: current.view?.changed ?? 0,
        reload: load,
        set: (criterionId: string, weight: number) =>
            change(new Map([[criterionId, weight]]), () => setWeight(criterionId, weight), "Không đổi được trọng số."),
        reset: (criterionId: string) => change(new Map([[criterionId, null]]), () => resetWeights(criterionId), "Không đặt lại được trọng số."),
        resetAll: () =>
            change(new Map((current.view?.criteria ?? []).map((item) => [item.id, null])), () => resetWeights(), "Không đặt lại được trọng số."),
    };
}

/** Chỉ đọc `version` để biết khi nào cần tính lại điểm. */
export function useWeightsVersion(): number {
    return useSyncExternalStore(subscribe, () => state.version, () => 0);
}
