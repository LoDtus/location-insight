import type { MapConfig, MapStyleId } from "@/features/map/map.types";

export type VietmapModule = typeof import("@vietmap/vietmap-gl-js/dist/vietmap-gl.js");

let vietmapPromise: Promise<VietmapModule> | null = null;

/** Nạp VietMap GL JS một lần, chỉ trên client. Bản UMD không có `main` nên import theo đường dẫn dist. */
export function loadVietmap(): Promise<VietmapModule> {
    vietmapPromise ??= import("@vietmap/vietmap-gl-js/dist/vietmap-gl.js").then(
        (mod) => ((mod as { default?: VietmapModule }).default ?? mod) as VietmapModule,
    );
    return vietmapPromise;
}

export function styleUrl(config: MapConfig, id: MapStyleId): string | null {
    return (config.styles.find((style) => style.id === id) ?? config.styles[0])?.url ?? null;
}
