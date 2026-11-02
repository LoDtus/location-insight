"use client";

import { useEffect, useState } from "react";

import MapPanel from "@/features/map/components/map-panel";
import { getMapUsage, isAbortError, mapErrorMessage } from "@/features/map/map.service";
import type { MapUsage } from "@/features/map/map.types";

const LABELS: Record<string, string> = {
    autocomplete: "Gợi ý (Autocomplete)",
    place: "Lấy tọa độ (Place)",
    reverse: "Địa chỉ từ tọa độ (Reverse)",
    route: "Tìm đường (Route)",
};

export default function MapUsageCard({ onClose }: { onClose: () => void }) {
    const [usage, setUsage] = useState<MapUsage | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        getMapUsage(controller.signal)
            .then(setUsage)
            .catch((failure: unknown) => {
                if (!isAbortError(failure)) setError(mapErrorMessage(failure, "Không tải được mức dùng."));
            });
        return () => controller.abort();
    }, []);

    const used = usage ? Object.values(usage.upstream).reduce((sum, value) => sum + value, 0) : 0;

    return (
        <MapPanel title="Mức dùng hôm nay" titleId="tieu-de-muc-dung" onClose={onClose}>
            {error ? <p className="m-0 text-sm text-red-700" role="alert">{error}</p> : null}
            {!usage && !error ? <p className="m-0 text-sm text-charcoal/70" role="status">Đang tải…</p> : null}
            {usage ? (
                <>
                    <p className="m-0 text-sm text-charcoal/70">
                        Ngày {usage.date}. Đã gọi Vietmap {used}
                        {usage.budget > 0 ? ` / ${usage.budget}` : ""} lần (không tính cache).
                    </p>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-charcoal/60">
                                <th className="py-1 font-medium">API</th>
                                <th className="py-1 text-right font-medium">Gọi upstream</th>
                                <th className="py-1 text-right font-medium">Cache hit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(LABELS).map((key) => (
                                <tr key={key} className="border-t border-charcoal/10">
                                    <td className="py-1.5">{LABELS[key]}</td>
                                    <td className="py-1.5 text-right tabular-nums">{usage.upstream[key] ?? 0}</td>
                                    <td className="py-1.5 text-right tabular-nums">{usage.cacheHits[key] ?? 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="m-0 text-xs text-charcoal/55">
                        Đối chiếu với Daily Report trong Vietmap Console. Tile bản đồ tính riêng (25 tile = 1 transaction).
                    </p>
                </>
            ) : null}
        </MapPanel>
    );
}
