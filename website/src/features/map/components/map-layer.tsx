interface MapLayerProps {
    onSelect: () => void;
}

export default function MapLayer({ onSelect }: MapLayerProps) {
    return (
        <button
            type="button"
            aria-label="Chọn một điểm trên bản đồ"
            className="absolute inset-0 block h-full w-full cursor-crosshair border-0 bg-transparent p-0"
            onClick={onSelect}
        >
            <img
                src="/images/temp-001.png"
                alt="Bản đồ"
                className="pointer-events-none h-full w-full object-cover"
            />
        </button>
    );
}
