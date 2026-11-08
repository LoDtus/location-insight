"use client";

import { Loader2, Plus, ShieldAlert } from "lucide-react";
import { useId, useState, type FormEvent, type JSX } from "react";

import { BUTTON_GHOST, BUTTON_PRIMARY, Badge, EmptyNote, INPUT, Mono, Skeleton, type Tone } from "@/features/datasets/components/dataset-ui";
import { createLayer, updateLayerUsage, type ContractId, type DatasetLayer, type LayerUsage } from "@/features/datasets/datasets.api";
import { USAGE_LABEL, datasetErrorMessage, formatDateTime, readyVersions, shortId } from "@/features/datasets/datasets.utils";
import { showToast } from "@/shared/components/toast/toast-store";

const USAGE_TONE: Record<LayerUsage, Tone> = { public: "green", internal: "gold", blocked: "red" };
const CONTRACTS: Array<{ id: ContractId; label: string }> = [
    { id: "point@1", label: "point@1 — điểm (CSV)" },
    { id: "line@1", label: "line@1 — đường (GeoJSONSeq)" },
    { id: "area@1", label: "area@1 — vùng (GeoJSONSeq)" },
    { id: "grid@1", label: "grid@1 — lưới 100 m (CSV)" },
];
const LAYER_CODE = /^[a-z0-9-]{2,40}\.[a-z0-9_]{2,19}$/;

/** Lớp = (nguồn, chủ đề, dạng hình học). Thêm lớp cùng dạng hình học không cần sửa code. */
export default function LayersPanel({ layers, onChanged }: { layers: DatasetLayer[] | null; onChanged: () => void }): JSX.Element {
    const [isCreating, setIsCreating] = useState(false);
    if (!layers) return <Skeleton />;
    return (
        <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 max-w-2xl text-sm text-charcoal/70">
                    Mỗi gói là một phiên bản của một lớp. Loại tiện ích là cột <Mono value="category" /> trong lớp, không tạo lớp riêng. Hai nguồn cùng loại
                    là hai lớp (giấy phép khác nhau).
                </p>
                {!isCreating ? (
                    <button type="button" className={BUTTON_PRIMARY} onClick={() => setIsCreating(true)}>
                        <Plus size={15} aria-hidden /> Tạo lớp
                    </button>
                ) : null}
            </div>
            {isCreating ? (
                <CreateLayerForm
                    onDone={(created) => {
                        setIsCreating(false);
                        if (created) onChanged();
                    }}
                />
            ) : null}
            {layers.length === 0 ? (
                <EmptyNote>Chưa có lớp nào. Tạo lớp (ví dụ osm.places, khuôn point@1) rồi tải gói ở tab Nhập gói.</EmptyNote>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-charcoal/10">
                    <table className="w-full min-w-[52rem] border-collapse text-sm">
                        <thead className="bg-charcoal/[0.03] text-left text-xs text-charcoal/60">
                            <tr>
                                <th className="px-3 py-2 font-semibold">Lớp</th>
                                <th className="px-3 py-2 font-semibold">Khuôn</th>
                                <th className="px-3 py-2 font-semibold">Cách dùng</th>
                                <th className="px-3 py-2 font-semibold">Phiên bản mới nhất</th>
                                <th className="px-3 py-2 font-semibold">Trong bản phát hành</th>
                                <th className="px-3 py-2 text-right font-semibold">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {layers.map((layer) => (
                                <LayerRow key={layer.code} layer={layer} onChanged={onChanged} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function LayerRow({ layer, onChanged }: { layer: DatasetLayer; onChanged: () => void }): JSX.Element {
    const [isEditing, setIsEditing] = useState(false);
    const latest = layer.versions[0] ?? null;
    const ready = readyVersions(layer).length;
    return (
        <>
            <tr className="border-t border-charcoal/10 align-top">
                <td className="px-3 py-2.5">
                    <Mono value={layer.code} />
                    <span className="mt-0.5 block text-xs text-charcoal/55">{layer.attribution || "—"}</span>
                </td>
                <td className="px-3 py-2.5">
                    <Mono value={layer.contract} />
                </td>
                <td className="px-3 py-2.5">
                    <Badge tone={USAGE_TONE[layer.usage]}>{USAGE_LABEL[layer.usage]}</Badge>
                    {layer.usageReason ? <span className="mt-0.5 block max-w-48 text-xs text-charcoal/55">{layer.usageReason}</span> : null}
                </td>
                <td className="px-3 py-2.5 tabular-nums">
                    {latest ? (
                        <>
                            <span className="font-semibold">{latest.label}</span> · {latest.status}
                            <span className="block text-xs text-charcoal/55">
                                {latest.rowCount?.toLocaleString("vi-VN") ?? "—"} dòng · {formatDateTime(latest.readyAt ?? latest.createdAt)}
                            </span>
                            <span className="block text-xs text-charcoal/55">
                                {ready} bản ready · gói <Mono value={latest.packageSha256} display={shortId(latest.packageSha256)} />
                            </span>
                            {latest.integrityOk === false ? (
                                <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                                    <ShieldAlert size={13} aria-hidden /> Dữ liệu bị đổi ngoài đường nhập
                                </span>
                            ) : null}
                        </>
                    ) : (
                        <span className="text-charcoal/50">Chưa có phiên bản</span>
                    )}
                </td>
                <td className="px-3 py-2.5 tabular-nums">{latest && latest.inReleases.length ? latest.inReleases.map((v) => `v${v}`).join(", ") : "—"}</td>
                <td className="px-3 py-2.5 text-right">
                    <button type="button" className={BUTTON_GHOST} onClick={() => setIsEditing((value) => !value)} aria-expanded={isEditing}>
                        Đổi cách dùng
                    </button>
                </td>
            </tr>
            {isEditing ? (
                <tr className="border-t border-charcoal/10 bg-charcoal/[0.02]">
                    <td colSpan={6} className="px-3 py-3">
                        <UsageForm
                            layer={layer}
                            onDone={(changed) => {
                                setIsEditing(false);
                                if (changed) onChanged();
                            }}
                        />
                    </td>
                </tr>
            ) : null}
        </>
    );
}

function UsageForm({ layer, onDone }: { layer: DatasetLayer; onDone: (changed: boolean) => void }): JSX.Element {
    const [usage, setUsage] = useState<LayerUsage>(layer.usage);
    const [reason, setReason] = useState("");
    const [pending, setPending] = useState(false);
    const id = useId();
    const isValid = usage !== layer.usage && reason.trim().length >= 3;

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!isValid) return;
        setPending(true);
        try {
            await updateLayerUsage(layer.code, usage, reason.trim());
            showToast({ title: `Đã đổi ${layer.code} sang ${USAGE_LABEL[usage]}` });
            onDone(true);
        } catch (failure) {
            showToast({ title: "Chưa đổi được", description: datasetErrorMessage(failure, "Thử lại."), tone: "error" });
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={(event) => void submit(event)} className="grid max-w-2xl gap-3 sm:grid-cols-[12rem_1fr]">
            <label htmlFor={`${id}-usage`} className="text-sm font-semibold sm:pt-2">
                Cách dùng mới
            </label>
            <select id={`${id}-usage`} value={usage} onChange={(event) => setUsage(event.target.value as LayerUsage)} className={INPUT}>
                <option value="public">Công khai: tính điểm và hiện trên bản đồ</option>
                <option value="internal">Nội bộ: chỉ tính điểm, không trả đối tượng ra API</option>
                <option value="blocked">Chặn: gỡ khỏi mọi bản phát hành (giấy phép)</option>
            </select>
            <label htmlFor={`${id}-reason`} className="text-sm font-semibold sm:pt-2">
                Lý do (ghi nhật ký)
            </label>
            <input id={`${id}-reason`} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} className={INPUT} />
            {usage === "blocked" ? (
                <p className="m-0 text-sm text-red-700 sm:col-span-2">
                    Chặn lớp làm mọi bản nháp có lớp này không phát hành được. Bản hiện hành vẫn chạy cho tới khi bạn phát hành bản sửa gấp bỏ lớp.
                </p>
            ) : null}
            <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className={BUTTON_PRIMARY} disabled={!isValid || pending}>
                    {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null} Lưu thay đổi
                </button>
                <button type="button" className={BUTTON_GHOST} onClick={() => onDone(false)}>
                    Hủy
                </button>
            </div>
        </form>
    );
}

function CreateLayerForm({ onDone }: { onDone: (created: boolean) => void }): JSX.Element {
    const [code, setCode] = useState("");
    const [contract, setContract] = useState<ContractId>("point@1");
    const [usage, setUsage] = useState<"public" | "internal">("public");
    const [attribution, setAttribution] = useState("");
    const [description, setDescription] = useState("");
    const [pending, setPending] = useState(false);
    const id = useId();
    const sourceCode = code.split(".")[0] ?? "";
    const isCodeValid = LAYER_CODE.test(code);

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!isCodeValid) return;
        setPending(true);
        try {
            await createLayer({ code, contract, sourceCode, usage, attribution: attribution.trim(), description: description.trim() || undefined });
            showToast({ title: `Đã tạo lớp ${code}`, description: "Tải gói cho lớp này ở tab Nhập gói." });
            onDone(true);
        } catch (failure) {
            showToast({ title: "Chưa tạo được lớp", description: datasetErrorMessage(failure, "Thử lại."), tone: "error" });
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={(event) => void submit(event)} className="grid max-w-3xl gap-3 rounded-lg border border-charcoal/10 p-4 sm:grid-cols-[12rem_1fr]">
            <label htmlFor={`${id}-code`} className="text-sm font-semibold sm:pt-2">
                Mã lớp
            </label>
            <div>
                <input
                    id={`${id}-code`}
                    value={code}
                    placeholder="osm.places"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => setCode(event.target.value.trim().toLowerCase())}
                    aria-invalid={code !== "" && !isCodeValid}
                    aria-describedby={`${id}-code-help`}
                    className={`${INPUT} font-mono`}
                />
                <p id={`${id}-code-help`} className="m-0 mt-1 text-xs text-charcoal/60">
                    nguồn.chủ_đề — phần trước dấu chấm là mã nguồn (khớp data/raw/…/nguồn). Không đổi được sau khi tạo.
                </p>
            </div>
            <label htmlFor={`${id}-contract`} className="text-sm font-semibold sm:pt-2">
                Khuôn
            </label>
            <select id={`${id}-contract`} value={contract} onChange={(event) => setContract(event.target.value as ContractId)} className={INPUT}>
                {CONTRACTS.map((item) => (
                    <option key={item.id} value={item.id}>
                        {item.label}
                    </option>
                ))}
            </select>
            <label htmlFor={`${id}-usage`} className="text-sm font-semibold sm:pt-2">
                Cách dùng
            </label>
            <select id={`${id}-usage`} value={usage} onChange={(event) => setUsage(event.target.value as "public" | "internal")} className={INPUT}>
                <option value="public">Công khai</option>
                <option value="internal">Nội bộ (nguồn chưa rõ quyền)</option>
            </select>
            <label htmlFor={`${id}-attribution`} className="text-sm font-semibold sm:pt-2">
                Câu ghi nguồn
            </label>
            <input id={`${id}-attribution`} value={attribution} maxLength={300} placeholder="© OpenStreetMap contributors" onChange={(event) => setAttribution(event.target.value)} className={INPUT} />
            <label htmlFor={`${id}-description`} className="text-sm font-semibold sm:pt-2">
                Mô tả
            </label>
            <input id={`${id}-description`} value={description} maxLength={300} onChange={(event) => setDescription(event.target.value)} className={INPUT} />
            <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className={BUTTON_PRIMARY} disabled={!isCodeValid || pending}>
                    {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Plus size={15} aria-hidden />} Tạo lớp {isCodeValid ? code : ""}
                </button>
                <button type="button" className={BUTTON_GHOST} onClick={() => onDone(false)}>
                    Hủy
                </button>
            </div>
        </form>
    );
}
