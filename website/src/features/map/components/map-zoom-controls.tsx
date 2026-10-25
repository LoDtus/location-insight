import { LocateFixed, Minus, Plus } from "lucide-react";

interface MapZoomControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
}

export default function MapZoomControls({
    onZoomIn,
    onZoomOut,
}: MapZoomControlsProps) {
    return (
        <div className="pointer-events-auto absolute right-2 bottom-2 z-10 flex flex-row gap-1">
            <button
                type="button"
                aria-label="Phóng to"
                className="rounded-lg border bg-white p-2"
                onClick={onZoomIn}
            >
                <Plus size={18} />
            </button>
            <button
                type="button"
                aria-label="Thu nhỏ"
                className="rounded-lg border bg-white p-2"
                onClick={onZoomOut}
            >
                <Minus size={18} />
            </button>
            <button
                type="button"
                aria-label="Quay lại vị trí hiện tại"
                className="rounded-lg border bg-white p-2"
            >
                <LocateFixed size={18} />
            </button>
        </div>
    );
}
