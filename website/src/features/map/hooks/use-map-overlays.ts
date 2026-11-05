"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { POI_MIN_ZOOM, isPoiCategory, tilesFor, type OverlayId, type PoiCategory } from "@/features/map/map-overlays";
import { getLayerTile, isAbortError, type LayerTile } from "@/features/map/map.service";

export interface PoiPoint {
    category: PoiCategory;
    name: string;
    kind: string;
    lat: number;
    lng: number;
}

export interface PoiFeatureCollection {
    type: "FeatureCollection";
    features: Array<{
        type: "Feature";
        properties: { category: PoiCategory; name: string; kind: string };
        geometry: { type: "Point"; coordinates: [number, number] };
    }>;
}

const TILE_CACHE_MAX = 80;
const FETCH_DELAY_MS = 250;
/** Ô đã tải trong tab (dùng chung khi rời/vào lại bản đồ); bỏ ô cũ nhất khi đầy. */
const tileCache = new Map<string, PoiPoint[]>();

function remember(key: string, tile: LayerTile): void {
    const points = tile.points.flatMap((point): PoiPoint[] =>
        isPoiCategory(point.c) ? [{ category: point.c, name: point.n, kind: point.k, lat: point.lat, lng: point.lng }] : [],
    );
    tileCache.delete(key);
    tileCache.set(key, points);
    while (tileCache.size > TILE_CACHE_MAX) {
        const oldest = tileCache.keys().next().value;
        if (oldest === undefined) break;
        tileCache.delete(oldest);
    }
}

/**
 * Điểm tiện ích cho các lớp đang bật trong khung nhìn. Chỉ tải khi zoom ≥ 13 và có ít nhất một lớp tiện ích bật;
 * tải theo ô zoom 13 (cache trong tab + Redis ở backend), lọc theo nhóm tại client.
 */
export function useMapOverlays(input: {
    overlays: readonly OverlayId[];
    zoom: number;
    bounds: readonly [number, number, number, number] | null;
}) {
    const categories = useMemo(() => input.overlays.filter(isPoiCategory), [input.overlays]);
    const active = categories.length > 0 && input.zoom >= POI_MIN_ZOOM && input.bounds !== null;
    const [version, setVersion] = useState(0);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const controllerRef = useRef<AbortController | null>(null);
    const [west, south, east, north] = input.bounds ?? [0, 0, 0, 0];
    const tiles = useMemo(
        () => (active ? tilesFor([west, south, east, north]) : []),
        [active, west, south, east, north],
    );
    const tilesKey = tiles.map((tile) => `${tile.x}/${tile.y}`).join(",");

    useEffect(() => {
        if (tiles.length === 0) return;
        const missing = tiles.filter((tile) => !tileCache.has(`${tile.x}/${tile.y}`));
        if (missing.length === 0) return;
        const timer = setTimeout(() => {
            controllerRef.current?.abort();
            const controller = new AbortController();
            controllerRef.current = controller;
            setLoading(true);
            setFailed(false);
            Promise.allSettled(
                missing.map((tile) =>
                    getLayerTile(tile.x, tile.y, controller.signal).then((data) => remember(`${tile.x}/${tile.y}`, data)),
                ),
            ).then((results) => {
                if (controller.signal.aborted) return;
                setLoading(false);
                setFailed(results.some((result) => result.status === "rejected" && !isAbortError(result.reason)));
                setVersion((value) => value + 1);
            });
        }, FETCH_DELAY_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- tilesKey đại diện cho tiles
    }, [tilesKey]);

    useEffect(() => () => controllerRef.current?.abort(), []);

    const features = useMemo<PoiFeatureCollection>(() => {
        const wanted = new Set(categories);
        const list: PoiFeatureCollection["features"] = [];
        for (const tile of tiles) {
            for (const point of tileCache.get(`${tile.x}/${tile.y}`) ?? []) {
                if (!wanted.has(point.category)) continue;
                list.push({
                    type: "Feature",
                    properties: { category: point.category, name: point.name, kind: point.kind },
                    geometry: { type: "Point", coordinates: [point.lng, point.lat] },
                });
            }
        }
        return { type: "FeatureCollection", features: list };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- version báo ô mới đã vào cache
    }, [tilesKey, categories, version]);

    return {
        features,
        loading,
        failed,
        /** Có lớp tiện ích bật nhưng đang thu nhỏ quá mức hiển thị. */
        tooFar: categories.length > 0 && input.zoom < POI_MIN_ZOOM,
    };
}
