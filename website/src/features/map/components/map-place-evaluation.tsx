"use client";

import { Check, Eye, EyeOff, Loader2, MapPinned, Pencil, RotateCcw, Sparkles, X } from "lucide-react";
import { useId, useState, type FormEvent, type JSX } from "react";

import { evaluatePlace, isAbortError, mapErrorMessage, overrideCriterion, resetCriterion } from "@/features/map/map.service";
import ScoreRing, { formatScore as score, scoreTone } from "@/features/map/components/score-ring";
import type { EvaluatedCriterion, MapPoint, PlaceEvaluation } from "@/features/map/map.types";

type State =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; evaluation: PlaceEvaluation }
    | { status: "error"; message: string };

const TONE_TEXT: Record<ReturnType<typeof scoreTone>, string> = {
    good: "text-green",
    fair: "text-[#9a7400]",
    poor: "text-red-700",
    none: "text-charcoal/50",
};

const TONE_BADGE: Record<ReturnType<typeof scoreTone>, string> = {
    good: "bg-green/10 text-green",
    fair: "bg-gold/20 text-charcoal",
    poor: "bg-red-50 text-red-700",
    none: "bg-charcoal/5 text-charcoal/70",
};

const ICON_BUTTON =
    "inline-flex size-8 items-center justify-center rounded-md bg-transparent text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green disabled:opacity-40";

/**
 * Đánh giá địa điểm theo bộ tiêu chí (tieu-chi.md). Hiện backend trả số liệu minh họa; sau này AI thay phần đo,
 * giao diện giữ nguyên. Thứ tự: điểm tổng → tóm tắt → điểm mạnh → điểm yếu → tiêu chí đã bỏ qua.
 */
export default function MapPlaceEvaluation({
    point,
    onCriterionSelect,
}: {
    point: MapPoint;
    /**
     * Chọn một tiêu chí (bấm vào dòng). Chỗ nối để sau này vẽ dẫn chứng trên bản đồ, vd. đường đi tới các
     * trường gần nhất cho tiêu chí "Trường học". null = bỏ chọn.
     */
    onCriterionSelect?: (criterion: EvaluatedCriterion | null) => void;
}): JSX.Element {
    const [state, setState] = useState<State>({ status: "idle" });
    const [selected, setSelected] = useState<string | null>(null);

    function select(item: EvaluatedCriterion): void {
        const next = selected === item.id ? null : item.id;
        setSelected(next);
        onCriterionSelect?.(next ? item : null);
    }
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
    const overallTone = scoreTone(evaluation.overall);

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

            <div className="mt-3 flex items-center gap-4 rounded-lg bg-charcoal/[0.03] px-3 py-3">
                <ScoreRing
                    value={evaluation.overall}
                    size={84}
                    label={evaluation.overall === null ? "Chưa có điểm tổng" : `Điểm tổng ${score(evaluation.overall)} trên 10`}
                />
                <div className="min-w-0">
                    <p className={`m-0 inline-flex rounded-md px-2 py-0.5 text-sm font-semibold ${TONE_BADGE[overallTone]}`}>{evaluation.rating}</p>
                    <p className="m-0 mt-1 text-xs text-charcoal/60">
                        Điểm tổng trên thang 10, trung bình {used}/{evaluation.criteriaCount} tiêu chí
                    </p>
                    <p className="m-0 mt-0.5 flex gap-3 text-xs font-semibold tabular-nums">
                        <span className="text-green">+{score(evaluation.strengths.points)} mạnh</span>
                        <span className="text-red-700">−{score(evaluation.weaknesses.points)} yếu</span>
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
                selected={selected}
                onSelect={select}
                onEdit={setEditing}
                onSkip={(item) => void apply(item.id, () => overrideCriterion(point, item.id, { skipped: !item.skipped }))}
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
                selected={selected}
                onSelect={select}
                onEdit={setEditing}
                onSkip={(item) => void apply(item.id, () => overrideCriterion(point, item.id, { skipped: !item.skipped }))}
                onScore={(item, value) => void apply(item.id, () => overrideCriterion(point, item.id, { score: value }))}
                onReset={(item) => void apply(item.id, () => resetCriterion(point, item.id))}
            />

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
    selected: string | null;
    onSelect: (item: EvaluatedCriterion) => void;
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
                    {title} <span className="font-normal text-charcoal/55">({items.filter((item) => !item.skipped).length})</span>
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
    selected,
    onSelect,
    onEdit,
    onSkip,
    onScore,
    onReset,
}: { item: EvaluatedCriterion } & Omit<GroupProps, "title" | "points" | "pointsClass" | "empty" | "items">): JSX.Element {
    const [draft, setDraft] = useState(String(item.score));
    const inputId = useId();
    const isEditing = editing === item.id;
    const isBusy = busy === item.id;
    const isSelected = selected === item.id;
    const skipped = item.skipped;

    function submit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        const value = Number(draft.replace(",", "."));
        if (!Number.isFinite(value) || value < 0 || value > 10) return;
        onScore(item, value);
    }

    const parsed = Number(draft.replace(",", "."));
    const invalid = !Number.isFinite(parsed) || parsed < 0 || parsed > 10;

    return (
        <li
            data-criterion={item.id}
            className={`group/row -mx-2 rounded-md border-b border-charcoal/10 px-2 py-2.5 transition-colors duration-150 last:border-b-0 hover:bg-charcoal/[0.04] focus-within:bg-charcoal/[0.04] motion-reduce:transition-none ${isSelected ? "bg-green/[0.06] ring-1 ring-green/30 hover:bg-green/[0.08]" : ""}`}
        >
            <div className="flex items-center gap-3">
                {/* Vùng nội dung bấm được: chọn tiêu chí (sau này hiện dẫn chứng trên bản đồ). */}
                <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(item)}
                    title="Xem dẫn chứng trên bản đồ (sắp có)"
                    className="min-w-0 flex-1 cursor-pointer rounded-sm bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                >
                    <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                        <span className={skipped ? "text-charcoal/45 line-through decoration-charcoal/45" : "text-charcoal"}>{item.label}</span>
                        {item.manual && !skipped ? <span className="rounded bg-charcoal/5 px-1.5 py-px text-[11px] font-semibold text-charcoal/70">Chỉnh tay</span> : null}
                        {skipped ? <span className="rounded bg-charcoal/5 px-1.5 py-px text-[11px] font-semibold text-charcoal/55">Đã bỏ qua</span> : null}
                        <MapPinned
                            size={13}
                            aria-hidden
                            className={`text-green transition-opacity duration-150 motion-reduce:transition-none ${isSelected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100"}`}
                        />
                    </span>
                    <span className={`mt-0.5 block text-sm ${skipped ? "text-charcoal/40 line-through decoration-charcoal/30" : "text-charcoal/80"}`}>
                        <span className={`font-semibold ${skipped ? "" : TONE_TEXT[scoreTone(item.score)]}`}>{item.verdict}</span>
                        <span className="text-charcoal/40"> · </span>
                        {item.detail}
                    </span>
                    <span className="mt-0.5 block text-xs text-charcoal/50">
                        {item.groupLabel} · Nguồn: {item.source}
                        {item.manual ? ` · Tự động: ${score(item.autoScore)}` : ""}
                    </span>
                </button>
                <ScoreRing value={item.score} size={42} muted={skipped} label={`${item.label}: ${score(item.score)} trên 10${skipped ? ", đã bỏ qua" : ""}`} />
                <div className="flex shrink-0 items-center">
                    <button
                        type="button"
                        aria-label={`Thay đổi điểm: ${item.label}`}
                        title="Thay đổi điểm"
                        aria-expanded={isEditing}
                        disabled={isBusy || skipped}
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
                        aria-label={skipped ? `Tính lại tiêu chí: ${item.label}` : `Bỏ qua tiêu chí: ${item.label}`}
                        title={skipped ? "Tính lại tiêu chí" : "Bỏ qua tiêu chí"}
                        aria-pressed={skipped}
                        disabled={isBusy}
                        onClick={() => onSkip(item)}
                        className={`${ICON_BUTTON} ${skipped ? "text-charcoal" : ""}`}
                    >
                        {isBusy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : skipped ? <Eye size={15} aria-hidden /> : <EyeOff size={15} aria-hidden />}
                    </button>
                </div>
            </div>
            {isEditing && !skipped ? (
                <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-charcoal/10">
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
