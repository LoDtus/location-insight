import { X } from "lucide-react";

import type { SearchFilters } from "@/features/map/map-url";

interface MapFilterChipsProps {
    filters: SearchFilters;
    onClear: () => void;
}

export function describeFilters(filters: SearchFilters): string[] {
    const chips: string[] = [];
    if (filters.cats) chips.push(`Nhóm POI: ${filters.cats}`);
    if (filters.scope) chips.push(`Loại: ${filters.scope.split(",").join(", ")}`);
    if (filters.cityId) chips.push(`Tỉnh/thành: ${filters.cityId}`);
    if (filters.distId) chips.push(`Quận/huyện: ${filters.distId}`);
    if (filters.wardId) chips.push(`Phường/xã: ${filters.wardId}`);
    if (filters.radius) chips.push(`Bán kính ${filters.radius} m quanh tâm bản đồ`);
    return chips;
}

export default function MapFilterChips({ filters, onClear }: MapFilterChipsProps) {
    const chips = describeFilters(filters);
    if (chips.length === 0) return null;

    return (
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5" aria-label="Bộ lọc tìm kiếm đang áp dụng">
            {chips.map((chip) => (
                <span key={chip} className="rounded-full bg-white px-3 py-1 text-xs shadow-sm ring-1 ring-charcoal/15">
                    {chip}
                </span>
            ))}
            <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-sm ring-1 ring-charcoal/15"
                onClick={onClear}
            >
                <X size={12} aria-hidden /> Xóa bộ lọc
            </button>
        </div>
    );
}
