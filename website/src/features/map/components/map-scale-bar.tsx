import { niceScale } from "@/features/map/map.geo";

const DEFAULT_LATITUDE = 21.03;

interface MapScaleBarProps {
    zoom: number;
    /** Vĩ độ giữa màn hình; mặc định Hà Nội. */
    latitude?: number;
}

export default function MapScaleBar({ zoom, latitude = DEFAULT_LATITUDE }: MapScaleBarProps) {
    const scale = niceScale(zoom, latitude);

    return (
        <div
            className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5 rounded bg-white/70 px-1.5 py-0.5"
            aria-hidden
        >
            <span className="text-[10px] leading-none text-neutral-800">{scale.label}</span>
            <span className="block h-0.5 bg-neutral-800" style={{ width: scale.px }} />
        </div>
    );
}
