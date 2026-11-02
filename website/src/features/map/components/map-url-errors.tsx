import { X } from "lucide-react";

import type { MapUrlError } from "@/features/map/map-url";

interface MapUrlErrorsProps {
    errors: MapUrlError[];
    onDismiss: () => void;
}

/** Báo các tham số URL không hợp lệ (đã bị bỏ qua). */
export default function MapUrlErrors({ errors, onDismiss }: MapUrlErrorsProps) {
    if (errors.length === 0) return null;

    return (
        <div
            role="alert"
            className="pointer-events-auto rounded-lg border border-red-200 bg-white p-3 text-sm shadow-sm"
        >
            <div className="flex items-start justify-between gap-2">
                <p className="m-0 font-semibold text-red-700">
                    {errors.length === 1 ? "Có 1 tham số trên URL không hợp lệ" : `Có ${errors.length} tham số trên URL không hợp lệ`}
                </p>
                <button
                    type="button"
                    aria-label="Đóng thông báo lỗi tham số"
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-charcoal/10"
                    onClick={onDismiss}
                >
                    <X size={14} />
                </button>
            </div>
            <ul className="m-0 mt-1 list-disc pl-5 text-charcoal/80">
                {errors.map((error, index) => (
                    <li key={`${error.param}-${index}`}>
                        <code className="font-mono text-xs">{error.param}</code>: {error.message}
                    </li>
                ))}
            </ul>
            <p className="m-0 mt-1 text-xs text-charcoal/55">Các giá trị này đã được bỏ qua; phần còn lại vẫn được áp dụng.</p>
        </div>
    );
}
