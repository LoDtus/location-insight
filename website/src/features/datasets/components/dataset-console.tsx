"use client";

import { Database, History, Upload } from "lucide-react";
import { useEffect, useId, useState, type JSX, type KeyboardEvent } from "react";

import ImportsPanel from "@/features/datasets/components/imports-panel";
import LayersPanel from "@/features/datasets/components/layers-panel";
import ReleasePanel from "@/features/datasets/components/release-panel";
import { listLayers, listReleases, type DatasetLayer, type DatasetRelease } from "@/features/datasets/datasets.api";
import { datasetErrorMessage } from "@/features/datasets/datasets.utils";

type Tab = "releases" | "layers" | "imports";

const TABS: { id: Tab; label: string; icon: typeof Database }[] = [
    { id: "releases", label: "Bản phát hành", icon: History },
    { id: "layers", label: "Lớp dữ liệu", icon: Database },
    { id: "imports", label: "Nhập gói", icon: Upload },
];

/**
 * Admin › Dữ liệu đánh giá (018-location-data). Một đường ghi duy nhất: gói chuẩn tải lên → kiểm tra → Lưu thành
 * phiên bản lớp → chọn vào bản nháp → phát hành. Thu hồi luôn tạo bản mới.
 */
export default function DatasetConsole(): JSX.Element {
    const [tab, setTab] = useState<Tab>("releases");
    const [releases, setReleases] = useState<DatasetRelease[] | null>(null);
    const [layers, setLayers] = useState<DatasetLayer[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const baseId = useId();

    const [refreshKey, setRefreshKey] = useState(0);
    const reload = (): void => setRefreshKey((key) => key + 1);

    useEffect(() => {
        const controller = new AbortController();
        Promise.all([listReleases(controller.signal), listLayers(controller.signal)])
            .then(([nextReleases, nextLayers]) => {
                setReleases(nextReleases);
                setLayers(nextLayers);
                setError(null);
            })
            .catch((failure: unknown) => {
                if (failure instanceof DOMException && failure.name === "AbortError") return;
                setError(datasetErrorMessage(failure, "Không tải được dữ liệu nền."));
                setReleases((list) => list ?? []);
                setLayers((list) => list ?? []);
            });
        return () => controller.abort();
    }, [refreshKey]);

    const current = releases?.find((item) => item.current) ?? null;
    const draft = releases?.find((item) => item.status === "draft") ?? null;

    function onTabKey(event: KeyboardEvent<HTMLDivElement>): void {
        const index = TABS.findIndex((item) => item.id === tab);
        const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : null;
        if (next === null) return;
        event.preventDefault();
        const target = TABS[(next + TABS.length) % TABS.length];
        setTab(target.id);
        document.getElementById(`${baseId}-tab-${target.id}`)?.focus();
    }

    return (
        <div className="box-border w-full px-4 py-5 sm:px-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="m-0 text-2xl font-semibold">Dữ liệu đánh giá</h1>
                    <p className="m-0 mt-1 max-w-2xl text-sm text-charcoal/70">
                        Dữ liệu nền chỉ vào hệ thống qua gói chuẩn: tải lên, kiểm tra, Lưu, rồi phát hành. Phát hành không tự đánh giá lại; người dùng thấy “có
                        dữ liệu mới” và tự bấm “Đánh giá lại”.
                    </p>
                </div>
                <dl className="m-0 flex gap-6 text-sm">
                    <div>
                        <dt className="text-charcoal/60">Hiện hành</dt>
                        <dd className="m-0 text-lg font-semibold tabular-nums">{current ? `v${current.version}` : "–"}</dd>
                    </div>
                    <div>
                        <dt className="text-charcoal/60">Bản nháp</dt>
                        <dd className="m-0 text-lg font-semibold tabular-nums">{draft ? `v${draft.version}` : "–"}</dd>
                    </div>
                    <div>
                        <dt className="text-charcoal/60">Lớp</dt>
                        <dd className="m-0 text-lg font-semibold tabular-nums">{layers ? layers.length : "–"}</dd>
                    </div>
                </dl>
            </header>

            {error ? (
                <p role="alert" className="m-0 mt-3 text-sm text-red-700">
                    {error}
                </p>
            ) : null}

            <div role="tablist" aria-label="Quản lý dữ liệu" onKeyDown={onTabKey} className="mt-5 flex gap-1 border-b border-charcoal/10">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        id={`${baseId}-tab-${item.id}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        aria-controls={`${baseId}-panel-${item.id}`}
                        tabIndex={tab === item.id ? 0 : -1}
                        onClick={() => setTab(item.id)}
                        className={`-mb-px inline-flex min-h-10 items-center gap-2 border-b-2 bg-transparent px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green ${tab === item.id ? "border-green text-charcoal" : "border-transparent text-charcoal/60 hover:text-charcoal"}`}
                    >
                        <item.icon size={16} aria-hidden /> {item.label}
                    </button>
                ))}
            </div>

            <div role="tabpanel" id={`${baseId}-panel-${tab}`} aria-labelledby={`${baseId}-tab-${tab}`} className="pt-4">
                {tab === "releases" ? <ReleasePanel releases={releases} layers={layers} onChanged={reload} /> : null}
                {tab === "layers" ? <LayersPanel layers={layers} onChanged={reload} /> : null}
                {tab === "imports" ? <ImportsPanel onSaved={reload} /> : null}
            </div>
        </div>
    );
}
