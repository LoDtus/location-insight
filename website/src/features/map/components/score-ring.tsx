import type { JSX } from "react";

/** Ngưỡng màu dùng chung cho thang 10: ≥ 7 xanh, > 5 vàng, còn lại đỏ. */
export function scoreTone(value: number | null): "good" | "fair" | "poor" | "none" {
    if (value === null) return "none";
    if (value >= 7) return "good";
    if (value > 5) return "fair";
    return "poor";
}

const STROKE: Record<ReturnType<typeof scoreTone>, string> = {
    good: "#0c8a4b",
    fair: "#f2c94c",
    poor: "#e5383b",
    none: "#c9c9c9",
};

/** 7,5 thay vì 7.5. */
export function formatScore(value: number): string {
    return value.toFixed(1).replace(".", ",");
}

/**
 * Vòng điểm: nền xám, cung màu dài theo tỷ lệ điểm/thang, số ở giữa (kiểu ScoreCircle).
 * `muted` cho tiêu chí đã bỏ qua: cung xám, số nhạt.
 */
export default function ScoreRing({
    value,
    max = 10,
    size = 40,
    thickness,
    muted = false,
    label,
}: {
    value: number | null;
    max?: number;
    size?: number;
    thickness?: number;
    muted?: boolean;
    /** Nhãn đọc màn hình, vd. "Điểm tổng 7,9 trên 10". */
    label: string;
}): JSX.Element {
    const stroke = thickness ?? Math.max(3, Math.round(size / 11));
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const ratio = value === null ? 0 : Math.min(1, Math.max(0, value / max));
    const color = muted ? STROKE.none : STROKE[scoreTone(value)];
    const text = value === null ? "–" : formatScore(value);

    return (
        <span role="img" aria-label={label} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#efefef" strokeWidth={stroke} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - ratio)}
                    className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
                />
            </svg>
            <span
                aria-hidden="true"
                className={`absolute inset-0 flex items-center justify-center font-semibold tabular-nums ${muted ? "text-charcoal/40" : "text-charcoal"}`}
                style={{ fontSize: Math.round(size * (text.length > 3 ? 0.27 : 0.3)) }}
            >
                {text}
            </span>
        </span>
    );
}
