const SCALE_BAR_PX = 56;

function niceMeters(value: number): number {
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let closest = steps[0];

    for (const step of steps) {
        if (Math.abs(step - value) < Math.abs(closest - value)) {
            closest = step;
        }
    }

    return closest;
}

function formatScaleLabel(meters: number): string {
    if (meters >= 1000) {
        return `${meters / 1000} km`;
    }

    return `${meters} m`;
}

function scaleBarForZoom(zoom: number): { label: string; barPx: number } {
    const rawMeters = 3200 / Math.pow(2, zoom - 11);
    const meters = niceMeters(rawMeters);

    return {
        label: formatScaleLabel(meters),
        barPx: SCALE_BAR_PX,
    };
}

export default function MapScaleBar({ zoom }: { zoom: number }) {
    const scale = scaleBarForZoom(zoom);

    return (
        <div
            className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5"
            aria-hidden
        >
            <span className="text-[10px] leading-none text-neutral-800">
                {scale.label}
            </span>
            <span
                className="block h-0.5 bg-neutral-800"
                style={{ width: scale.barPx }}
            />
        </div>
    );
}
