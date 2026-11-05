import { Compass, LocateFixed, Loader2, Minus, Plus } from "lucide-react";

interface MapZoomControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onLocate?: () => void;
    locating?: boolean;
    bearing?: number;
    onResetNorth?: () => void;
}

const BUTTON = "rounded-lg border border-charcoal/15 bg-white p-2 shadow-sm hover:bg-charcoal/5";

export default function MapZoomControls({
    onZoomIn,
    onZoomOut,
    onLocate,
    locating = false,
    bearing = 0,
    onResetNorth,
}: MapZoomControlsProps) {
    return (
        <div className="pointer-events-auto absolute right-2 bottom-2 z-10 flex flex-row gap-1">
            {onResetNorth && Math.abs(bearing) > 1 ? (
                <button type="button" aria-label="Quay về hướng bắc" className={BUTTON} onClick={onResetNorth}>
                    <Compass size={18} style={{ transform: `rotate(${-bearing}deg)` }} />
                </button>
            ) : null}
            <button type="button" aria-label="Phóng to" className={BUTTON} onClick={onZoomIn}>
                <Plus size={18} />
            </button>
            <button type="button" aria-label="Thu nhỏ" className={BUTTON} onClick={onZoomOut}>
                <Minus size={18} />
            </button>
            <button
                type="button"
                aria-label="Vị trí của tôi"
                disabled={locating}
                className={BUTTON}
                onClick={onLocate}
            >
                {locating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
            </button>
        </div>
    );
}
