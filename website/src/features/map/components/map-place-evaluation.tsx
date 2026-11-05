"use client";

import { Check, EyeOff, Loader2, Pencil, RotateCcw, Sparkles, Undo2, X } from "lucide-react";
import { useId, useState, type FormEvent, type JSX } from "react";

import { evaluatePlace, isAbortError, mapErrorMessage, overrideCriterion, resetCriterion } from "@/features/map/map.service";
import type { EvaluatedCriterion, MapPoint, PlaceEvaluation } from "@/features/map/map.types";

type State =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; evaluation: PlaceEvaluation }
    | { status: "error"; message: string };

/** 7,5 thay vì 7.5. */
function score(value: number): string {
    return value.toFixed(1).replace(".", ",");
}

function tone(value: number): { badge: string; text: string } {
    if (value >= 7) return { badge: "bg-green/10 text-green", text: "text-green" };
    if (value > 5) return { badge: "bg-gold/20 text-charcoal", text: "text-charcoal" };
    return { badge: "bg-red-50 text-red-700", text: "text-red-700" };
}

const ICON_BUTTON =
    "inline-flex size-8 items-center justify-center rounded-md bg-transparent text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green disabled:opacity-40";

/**
 * Đánh giá địa điểm theo bộ tiêu chí (tieu-chi.md). Hiện backend trả số liệu minh họa; sau này AI thay phần đo,
 * giao diện giữ nguyên. Thứ tự: điểm tổng → tóm tắt → điểm mạnh → điểm yếu → tiêu chí đã bỏ qua.
 */
export default function MapPlaceEvaluation({ point }: { point: MapPoint }): JSX.Element {
    const [state, setState] = useState<State>({ status: "idle" });
    const [busy, setBusy] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const headingId = useId();

    function run(): void {
        setState({ status: "loading" });
        setError(null);
        evaluatePlace(point)
            .then((evaluation) => setState({ status: "ready", evaluation }))
            .catch((reason: unknown) => {
                if (!isAbortError(reason)) setState({ status: "error", message: mapErrorMessage(reason, "Không đánh giá được địa điểm này.") });
            });
    }

    async function apply(id: string, action: () => Promise<PlaceEvaluation>): Promise<void> {
        setBusy(id);
        setError(null);
        try {
            const evaluation = await action();
            setState({ status: "ready", evaluation });
            setEditing(null);
        } catch (reason) {
            setError(mapErrorMessage(reason, "Không cập nhật được tiêu chí."));
        } finally {
            setBusy(null);
        }
    }

    if (state.status === "idle" || state.status === "error") {
        return (
            <section aria-label="Đánh giá địa điểm" className="border-t border-charcoal/10 pt-3">
                <button
                    type="button"
                    onClick={run}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-charcoal px-4 text-sm font-semibold text-white hover:bg-charcoal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                >
                    <Sparkles size={16} aria-hidden /> Đánh giá địa điểm
                </button>
                <p className="m-0 mt-1.5 text-xs text-charcoal/60">Chấm theo 19 tiêu chí: tiện ích đi bộ, đi lại, y tế, dân cư và môi trường.</p>
                {state.status === "error" ? (
                    <p role="alert" className="m-0 mt-2 text-sm text-red-700">
                        {state.message}
                    </p>
                ) : null}
            </section>
        );
    }

    if (state.status === "loading") {
        return (
            <section aria-label="Đánh giá địa điểm" aria-busy="true" className="grid gap-2 border-t border-charcoal/10 pt-3">
                <p role="status" className="m-0 flex items-center gap-2 text-sm text-charcoal/70">
                    <Loader2 size={16} className="animate-spin" aria-hidden /> Đang đánh giá địa điểm…
                </p>
                <div className="h-14 animate-pulse rounded-lg bg-charcoal/5 motion-reduce:animate-none" />
                <div className="h-10 animate-pulse rounded-lg bg-charcoal/5 motion-reduce:animate-none" />
                <div className="h-24 animate-pulse rounded-lg bg-charcoal/5 motion-reduce:animate-none" />
            </section>
        );
    }

    const { evaluation } = state;
    const used = evaluation.criteriaCount - evaluation.skipped.length;
    const overallTone = evaluation.overall === null ? null : tone(evaluation.overall);

    return (
        <section aria-labelledby={headingId} className="border-t border-charcoal/10 pt-3">
            <div className="flex items-center justify-between gap-2">
                <h3 id={headingId} className="m-0 text-base font-semibold">
                    Đánh giá địa điểm
                </h3>
                <button type="button" onClick={run} className={`${ICON_BUTTON} w-auto gap-1 px-2 text-xs font-semibold`} aria-label="Đánh giá lại">
                    <RotateCcw size={14} aria-hidden /> Đánh giá lại
                </button>
            </div>
            {evaluation.sample ? (
                <p className="m-0 mt-1 text-xs text-charcoal/60">Số liệu minh họa, chưa phải kết quả đo thật. Riêng khoảng cách tới Hồ Gươm là số thật.</p>
            ) : null}

            <div className="mt-3 flex items-center gap-3 rounded-lg bg-charcoal/[0.03] px-3 py-2.5">
                <p className="m-0 flex items-baseline gap-1 tabular-nums">
                    <span className={`text-3xl leading-none font-semibold ${overallTone?.text ?? "text-charcoal/50"}`}>
                        {evaluation.overall === null ? "–" : score(evaluation.overall)}
                    </span>
                    <span className="text-sm text-charcoal/60">/10</span>
                </p>
                <div className="min-w-0">
                    <p className={`m-0 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${overallTone?.badge ?? "bg-charcoal/5 text-charcoal/70"}`}>
                        {evaluation.rating}
                    </p>
                    <p className="m-0 mt-0.5 text-xs text-charcoal/60">
                        Trung bình {used}/{evaluation.criteriaCount} tiêu chí
                    </p>
                </div>
            </div>

            <p className="m-0 mt-3 text-sm leading-relaxed text-charcoal/85">{evaluation.summary}</p>

            {error ? (
                <p role="alert" className="m-0 mt-2 text-sm text-red-700">
                    {error}
                </p>
            ) : null}

            <CriterionGroup
                title="Điểm mạnh"
                points={`+${score(evaluation.strengths.points)}`}
                pointsClass="text-green"
                empty="Chưa có tiêu chí nào trên 5 điểm."
                items={evaluation.strengths.items}
                busy={busy}
                editing={editing}
                onEdit={setEditing}
                onSkip={(item) => void apply(item.id, () => overrideCriterion(point, item.id, { skipped: true }))}
                onScore={(item, value) => void apply(item.id, () => overrideCriterion(point, item.id, { score: value }))}
                onReset={(item) => void apply(item.id, () => resetCriterion(point, item.id))}
            />
            <CriterionGroup
                title="Điểm yếu"
                points={`−${score(evaluation.weaknesses.points)}`}
                pointsClass="text-red-700"
                empty="Không có tiêu chí nào từ 5 điểm trở xuống."
                items={evaluation.weaknesses.items}
                busy={busy}
                editing={editing}
                onEdit={setEditing}
                onSkip={(item) => void apply(item.id, () => overrideCriterion(point, item.id, { skipped: true }))}
                onScore={(item, value) => void apply(item.id, () => overrideCriterion(point, item.id, { score: value }))}
                onReset={(item) => void apply(item.id, () => resetCriterion(point, item.id))}
            />

            {evaluation.skipped.length > 0 ? (
                <details className="group mt-3 rounded-lg bg-charcoal/[0.03] px-3 py-2">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-charcoal/80 marker:hidden [&::-webkit-details-marker]:hidden">
                        Đã bỏ qua ({evaluation.skipped.length}) <span className="font-normal text-charcoal/55">· không tính vào điểm tổng</span>
                    </summary>
                    <ul className="m-0 mt-1 list-none p-0">
                        {evaluation.skipped.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-2 border-t border-charcoal/10 py-1.5 first:border-t-0">
                                <span className="min-w-0 text-sm text-charcoal/70">
                                    {item.label} <span className="text-charcoal/50">· {item.verdict}</span>
                                </span>
                                <button
                                    type="button"
                                    disabled={busy === item.id}
                                    onClick={() => void apply(item.id, () => overrideCriterion(point, item.id, { skipped: false }))}
                                    className={`${ICON_BUTTON} w-auto gap-1 px-2 text-xs font-semibold`}
                                >
                                    <Undo2 size={14} aria-hidden /> Khôi phục
                                </button>
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}
        </section>
    );
}

interface GroupProps {
    title: string;
    points: string;
    pointsClass: string;
    empty: string;
    items: EvaluatedCriterion[];
    busy: string | null;
    editing: string | null;
    onEdit: (id: string | null) => void;
    onSkip: (item: EvaluatedCriterion) => void;
    onScore: (item: EvaluatedCriterion, value: number) => void;
    onReset: (item: EvaluatedCriterion) => void;
}

function CriterionGroup({ title, points, pointsClass, empty, items, ...rest }: GroupProps): JSX.Element {
    const id = useId();
    return (
        <section aria-labelledby={id} className="mt-4">
            <h4 id={id} className="m-0 flex items-baseline justify-between gap-2 border-b border-charcoal/10 pb-1.5 text-sm font-semibold">
                <span>
                    {title} <span className="font-normal text-charcoal/55">({items.length})</span>
                </span>
                <span className={`tabular-nums ${pointsClass}`}>{points} điểm</span>
            </h4>
            {items.length === 0 ? (
                <p className="m-0 py-2 text-sm text-charcoal/60">{empty}</p>
            ) : (
                <ul className="m-0 list-none p-0">
                    {items.map((item) => (
                        <CriterionRow key={item.id} item={item} {...rest} />
                    ))}
                </ul>
            )}
        </section>
    );
}

function CriterionRow({
    item,
    busy,
    editing,
    onEdit,
    onSkip,
    onScore,
    onReset,
}: { item: EvaluatedCriterion } & Omit<GroupProps, "title" | "points" | "pointsClass" | "empty" | "items">): JSX.Element {
    const [draft, setDraft] = useState(String(item.score));
    const inputId = useId();
    const isEditing = editing === item.id;
    const isBusy = busy === item.id;
    const colors = tone(item.score);

    function submit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        const value = Number(draft.replace(",", "."));
        if (!Number.isFinite(value) || value < 0 || value > 10) return;
        onScore(item, value);
    }

    const parsed = Number(draft.replace(",", "."));
    const invalid = !Number.isFinite(parsed) || parsed < 0 || parsed > 10;

    return (
        <li className="border-b border-charcoal/10 py-2.5 last:border-b-0">
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <p className="m-0 flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                        {item.label}
                        {item.manual ? <span className="rounded bg-charcoal/5 px-1.5 py-px text-[11px] font-semibold text-charcoal/70">Chỉnh tay</span> : null}
                    </p>
                    <p className="m-0 mt-0.5 text-sm text-charcoal/80">
                        <span className={`font-semibold ${colors.text}`}>{item.verdict}</span>
                        <span className="text-charcoal/40"> · </span>
                        {item.detail}
                    </p>
                    <p className="m-0 mt-0.5 text-xs text-charcoal/50">
                        {item.groupLabel} · Nguồn: {item.source}
                        {item.manual ? ` · Tự động: ${score(item.autoScore)}` : ""}
                    </p>
                </div>
                <span className={`mt-0.5 inline-flex min-w-12 shrink-0 items-baseline justify-center rounded-md px-1.5 py-1 text-sm font-semibold tabular-nums ${colors.badge}`}>
                    {score(item.score)}
                    <span className="text-[11px] font-normal opacity-70">/10</span>
                </span>
                <div className="flex shrink-0 items-center">
                    <button
                        type="button"
                        aria-label={`Thay đổi điểm: ${item.label}`}
                        title="Thay đổi điểm"
                        aria-expanded={isEditing}
                        disabled={isBusy}
                        onClick={() => {
                            setDraft(String(item.score));
                            onEdit(isEditing ? null : item.id);
                        }}
                        className={ICON_BUTTON}
                    >
                        <Pencil size={15} aria-hidden />
                    </button>
                    <button
                        type="button"
                        aria-label={`Bỏ qua tiêu chí: ${item.label}`}
                        title="Bỏ qua tiêu chí"
                        disabled={isBusy}
                        onClick={() => onSkip(item)}
                        className={ICON_BUTTON}
                    >
                        {isBusy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <EyeOff size={15} aria-hidden />}
                    </button>
                </div>
            </div>
            {isEditing ? (
                <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-charcoal/[0.03] p-2">
                    <label htmlFor={inputId} className="text-xs font-semibold text-charcoal/70">
                        Điểm (0–10)
                    </label>
                    <input
                        id={inputId}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={10}
                        step={0.5}
                        value={draft}
                        aria-invalid={invalid}
                        onChange={(event) => setDraft(event.target.value)}
                        className="h-9 w-20 rounded-md border border-charcoal/15 bg-white px-2 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green aria-[invalid=true]:border-red-400"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={invalid || isBusy}
                        className="inline-flex h-9 items-center gap-1 rounded-md bg-green px-3 text-xs font-semibold text-cream hover:bg-green/90 disabled:opacity-50"
                    >
                        <Check size={14} aria-hidden /> Lưu
                    </button>
                    <button type="button" onClick={() => onEdit(null)} className={`${ICON_BUTTON} h-9 w-auto gap-1 px-2 text-xs font-semibold`}>
                        <X size={14} aria-hidden /> Hủy
                    </button>
                    {item.manual ? (
                        <button type="button" disabled={isBusy} onClick={() => onReset(item)} className={`${ICON_BUTTON} h-9 w-auto gap-1 px-2 text-xs font-semibold`}>
                            <RotateCcw size={14} aria-hidden /> Về điểm tự động
                        </button>
                    ) : null}
                </form>
            ) : null}
        </li>
    );
}
