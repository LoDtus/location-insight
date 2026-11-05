"use client";

import { useEffect, useState } from "react";

import { getMapConfig, getPublicMapConfig, isAbortError, mapErrorMessage } from "@/features/map/map.service";
import type { MapConfig } from "@/features/map/map.types";

export type MapConfigState =
    | { status: "loading" }
    | { status: "ready"; config: MapConfig }
    | { status: "error"; message: string };

/** `publicOnly`: chỉ cần nền bản đồ (trang công khai), không gọi cấu hình cần đăng nhập. */
export function useMapConfig(publicOnly = false): MapConfigState {
    const [state, setState] = useState<MapConfigState>({ status: "loading" });

    useEffect(() => {
        const controller = new AbortController();
        (publicOnly ? getPublicMapConfig : getMapConfig)(controller.signal)
            .then((config) => setState({ status: "ready", config }))
            .catch((error: unknown) => {
                if (isAbortError(error)) return;
                setState({
                    status: "error",
                    message: mapErrorMessage(error, "Không tải được cấu hình bản đồ."),
                });
            });
        return () => controller.abort();
    }, [publicOnly]);

    return state;
}
