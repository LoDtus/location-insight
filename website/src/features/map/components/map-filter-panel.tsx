"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";

import type { SearchFilters } from "@/features/map/map-url";

/** Loại kết quả của Vietmap (tham số `layers`), khớp SEARCH_SCOPES ở backend. */
export const SCOPE_OPTIONS = [
    { id: "POI", label: "Địa điểm (cửa hàng, cơ quan…)" },
    { id: "ADDRESS", label: "Địa chỉ nhà" },
    { id: "STREET", label: "Đường phố" },
    { id: "VILLAGE", label: "Thôn, xóm, khu dân cư" },
    { id: "WARD", label: "Phường, xã" },
    { id: "DIST", label: "Quận, huyện" },
    { id: "CITY", label: "Tỉnh, thành phố" },
] as const;

const CATS_PATTERN = /^\d{1,6}(-\d{1,3})?(,\d{1,6}(-\d{1,3})?){0,9}$/;

function splitList(value: string | undefined): string[] {
    return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

/** Số bộ lọc đang áp dụng (không tính bán kính: bán kính chỉnh ở ô tìm kiếm). */
export function countFilters(filters: SearchFilters): number {
    return (
        splitList(filters.scope).length +
        splitList(filters.cats).length +
        (filters.cityId ? 1 : 0) +
        (filters.distId ? 1 : 0) +
        (filters.wardId ? 1 : 0)
    );
}

interface MapFilterPanelProps {
    filters: SearchFilters;
    onApply: (filters: SearchFilters) => void;
    onClose: () => void;
}

/** Bộ lọc tìm kiếm, mở ở bên trái bản đồ. Chọn rồi bấm "Áp dụng". */
export default function MapFilterPanel({ filters, onApply, onClose }: MapFilterPanelProps): JSX.Element {
    const [scopes, setScopes] = useState<string[]>(splitList(filters.scope));
    const [cats, setCats] = useState(filters.cats ?? "");
    const ref = useRef<HTMLElement>(null);
    const catsClean = cats.replace(/\s+/g, "");
    const catsError = catsClean !== "" && !CATS_PATTERN.test(catsClean);
    const pending = scopes.length + splitList(catsClean).length;

    useEffect(() => {
        ref.current?.querySelector<HTMLInputElement>("input")?.focus();
    }, []);

    function apply(): void {
        if (catsError) return;
        onApply({
            ...filters,
            scope: scopes.length > 0 ? SCOPE_OPTIONS.map((option) => option.id).filter((id) => scopes.includes(id)).join(",") : undefined,
            cats: catsClean || undefined,
        });
    }

    return (
        <section
            ref={ref}
            aria-labelledby="tieu-de-bo-loc"
            onKeyDown={(event) => {
                if (event.key === "Escape") onClose();
            }}
            className="pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-lg bg-white shadow-[0_8px_28px_rgba(16,17,17,0.14)] ring-1 ring-charcoal/10 sm:w-80"
        >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-charcoal/10 py-1.5 pr-1.5 pl-4">
                <h2 id="tieu-de-bo-loc" className="m-0 text-base font-semibold">
                    Bộ lọc tìm kiếm
                </h2>
                <button
                    type="button"
                    aria-label="Đóng bộ lọc"
                    onClick={onClose}
                    className="inline-flex size-10 items-center justify-center rounded-md bg-transparent text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-green"
                >
                    <X size={18} aria-hidden />
                </button>
            </div>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 [scrollbar-width:thin]">
                <fieldset className="m-0 grid gap-1 border-0 p-0">
                    <legend className="mb-1.5 p-0 text-sm font-semibold">Loại kết quả</legend>
                    <p className="m-0 mb-1 text-xs text-charcoal/55">Không chọn gì nghĩa là tìm mọi loại.</p>
                    {SCOPE_OPTIONS.map((option) => {
                        const checked = scopes.includes(option.id);
                        return (
                            <label
                                key={option.id}
                                className={`flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm hover:bg-charcoal/5 ${checked ? "font-semibold text-charcoal" : "text-charcoal/80"}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                        setScopes((current) => (checked ? current.filter((id) => id !== option.id) : [...current, option.id]))
                                    }
                                    className="size-4 accent-green"
                                />
                                {option.label}
                            </label>
                        );
                    })}
                </fieldset>
                <div className="grid gap-1.5">
                    <label htmlFor="bo-loc-nhom" className="text-sm font-semibold">
                        Mã nhóm địa điểm (Vietmap)
                    </label>
                    <input
                        id="bo-loc-nhom"
                        type="text"
                        inputMode="numeric"
                        value={cats}
                        placeholder="Ví dụ: 1002-1,3001"
                        aria-invalid={catsError}
                        aria-describedby="bo-loc-nhom-goi-y"
                        onChange={(event) => setCats(event.target.value)}
                        className="w-full rounded-lg border border-charcoal/15 px-3 py-2 text-sm outline-none placeholder:text-charcoal/40 focus:border-green focus:ring-2 focus:ring-green/20 aria-[invalid=true]:border-red-500"
                    />
                    <p id="bo-loc-nhom-goi-y" className={`m-0 text-xs ${catsError ? "text-red-700" : "text-charcoal/55"}`}>
                        {catsError ? "Mã chưa đúng: tối đa 10 mã số, ngăn bởi dấu phẩy." : "Tối đa 10 mã, ngăn bởi dấu phẩy. Để trống nếu không cần."}
                    </p>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t border-charcoal/10 p-3">
                <button
                    type="button"
                    disabled={pending === 0}
                    onClick={() => {
                        setScopes([]);
                        setCats("");
                    }}
                    className="rounded-lg bg-transparent px-3 py-2 text-sm font-semibold text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal disabled:opacity-40"
                >
                    Bỏ chọn tất cả
                </button>
                <button
                    type="button"
                    disabled={catsError}
                    onClick={apply}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-green px-4 py-2 text-sm font-semibold text-cream hover:bg-green/90 disabled:opacity-50"
                >
                    <Check size={15} aria-hidden /> Áp dụng{pending > 0 ? ` (${pending})` : ""}
                </button>
            </div>
        </section>
    );
}
