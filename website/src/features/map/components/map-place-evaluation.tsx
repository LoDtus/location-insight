"use client";

import { Check, Eye, EyeOff, Loader2, MapPinned, Pencil, RotateCcw, Scale, Sparkles, TriangleAlert, X } from "lucide-react";
import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type JSX } from "react";

import WeightPicker, { weightLabel } from "@/features/map/components/weight-picker";
import { useCriterionWeights, useWeightsVersion } from "@/features/map/hooks/use-criterion-weights";
import { getMyEvaluation, isAbortError, mapErrorMessage, overrideCriterion, resetCriterion, runEvaluation } from "@/features/map/map.service";
import { showToast } from "@/shared/components/toast/toast-store";
import ScoreRing, { formatScore as score, scoreTone } from "@/features/map/components/score-ring";
import { CRITERION_ICON } from "@/features/map/criteria-icons";
import { hasEvidence } from "@/features/map/evidence-overlay";
import type { EvaluatedCriterion, MapPoint, PlaceEvaluation } from "@/features/map/map.types";

/** Dưới tỷ lệ này (theo trọng số) tiêu chí đo được thì điểm tổng chỉ để tham khảo (khớp COVERAGE_MIN của backend). */
const COVERAGE_MIN = 0.6;

type State =
    /** Đang đọc lượt đánh giá cũ của chính người dùng (không tính phí). */
    | { status: "checking" }
    | { status: "idle"; currentDatasetVersion: number | null }
    | { status: "loading" }
    | { status: "ready"; evaluation: PlaceEvaluation }
    /** Đánh giá lại: giữ nguyên kết quả cũ trên màn hình, chỉ khu vực đánh giá hiện đang tải. */
    | { status: "refreshing"; evaluation: PlaceEvaluation }
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

function formatEvaluatedAt(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

const ICON_BUTTON =
    "inline-flex size-8 items-center justify-center rounded-md bg-transparent text-charcoal/60 hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green disabled:opacity-40";

/**
 * Đánh giá địa điểm theo bộ tiêu chí (tieu-chi.md, backend criteria.ts). Backend đo thật trên dữ liệu nền (PostGIS),
 * thời gian đi (Vietmap) và không khí (OpenAQ); tiêu chí cần AI chưa làm thì có số minh họa, gắn "Chưa thực hiện" và
 * không tính điểm. Thứ tự: điều kiện chặn → điểm tổng → tóm tắt → điểm mạnh → điểm yếu → chưa tính vào điểm.
 */
export default function MapPlaceEvaluation({
    point,
    placeName,
    onCriterionSelect,
    activeCriterionId,
    onEvaluated,
}: {
    point: MapPoint;
    /** Tên địa điểm dùng trong thông báo. */
    placeName: string;
    /**
     * Chọn một tiêu chí (bấm vào dòng): màn bản đồ vẽ dẫn chứng của tiêu chí (evidence-overlay.ts), vd. đường đi
     * tới trường gần nhất cho tiêu chí "Trường học". null = bỏ chọn.
     */
    onCriterionSelect?: (criterion: EvaluatedCriterion | null) => void;
    /** Tiêu chí đang hiện dẫn chứng (do màn bản đồ giữ); có thì dòng được chọn đi theo giá trị này. */
    activeCriterionId?: string | null;
    /** Gọi sau mỗi lượt đánh giá mới (vd. để danh sách "Đã lưu" cập nhật điểm). */
    onEvaluated?: () => void;
}): JSX.Element {
    const [state, setState] = useState<State>({ status: "checking" });

    // Mở địa điểm: tự hiện lượt đánh giá gần nhất của CHÍNH người dùng (nếu có). Không tự đánh giá lại.
    useEffect(() => {
        const controller = new AbortController();
        getMyEvaluation(point, controller.signal)
            .then((result) =>
                setState(
                    result.evaluation
                        ? { status: "ready", evaluation: result.evaluation }
                        : { status: "idle", currentDatasetVersion: result.currentDatasetVersion },
                ),
            )
            .catch((reason: unknown) => {
                if (!isAbortError(reason)) setState({ status: "idle", currentDatasetVersion: null });
            });
        return () => controller.abort();
    }, [point]);
    // Đổi trọng số (ở đây hoặc trong modal quản lý): đọc lại lượt của mình để điểm tính theo trọng số mới. Không đo lại.
    const weightsVersion = useWeightsVersion();
    const seenVersion = useRef(weightsVersion);
    const hasEvaluation = state.status === "ready";
    useEffect(() => {
        if (seenVersion.current === weightsVersion) return;
        seenVersion.current = weightsVersion;
        if (!hasEvaluation) return;
        const controller = new AbortController();
        getMyEvaluation(point, controller.signal)
            .then((result) => {
                if (result.evaluation) setState({ status: "ready", evaluation: result.evaluation });
            })
            .catch(() => undefined);
        return () => controller.abort();
    }, [weightsVersion, hasEvaluation, point]);
    const weights = useCriterionWeights(false);
    const [weighting, setWeighting] = useState<string | null>(null);

    async function changeWeight(item: EvaluatedCriterion, weight: number | null): Promise<void> {
        setBusy(item.id);
        setError(null);
        const message = weight === null ? await weights.reset(item.id) : await weights.set(item.id, weight);
        setBusy(null);
        if (message) {
            setError(message);
            return;
        }
        const next = weight ?? item.defaultWeight;
        showToast({
            title: `Trọng số “${item.label}”: ${next}`,
            description: `${weightLabel(next)}. Áp dụng cho mọi địa điểm của bạn.`,
            tone: "info",
            duration: 3000,
        });
    }
    const [ownSelected, setSelected] = useState<string | null>(null);
    const selected = activeCriterionId === undefined ? ownSelected : activeCriterionId;

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
        const previous = state.status === "ready" || state.status === "refreshing" ? state.evaluation : null;
        setState(previous ? { status: "refreshing", evaluation: previous } : { status: "loading" });
        setError(null);
        // Có kết quả rồi thì nút là "Đánh giá lại": luôn đo lại.
        runEvaluation(point, previous !== null)
            .then(({ evaluation, source }) => {
                setState({ status: "ready", evaluation });
                onEvaluated?.();
                if (source === "shared") {
                    showToast({
                        title: "Đã có kết quả đánh giá địa điểm",
                        description: `${placeName}: kết quả gần nhất lúc ${formatEvaluatedAt(evaluation.analyzedAt)}. Bấm “Đánh giá lại” nếu muốn đo lại.`,
                    });
                    return;
                }
                showToast({
                    title: previous ? "Đã đánh giá lại địa điểm" : "Đã đánh giá xong địa điểm",
                    description:
                        evaluation.overall === null
                            ? `${placeName} · dữ liệu v${evaluation.datasetVersion}`
                            : `${placeName}: ${score(evaluation.overall)}/10, mức ${evaluation.rating.toLowerCase()} · dữ liệu v${evaluation.datasetVersion}.`,
                });
            })
            .catch((reason: unknown) => {
                if (isAbortError(reason)) return;
                const message = mapErrorMessage(reason, "Không đánh giá được địa điểm này.");
                if (previous) {
                    // Đánh giá lại lỗi: giữ kết quả cũ, chỉ báo lỗi.
                    setState({ status: "ready", evaluation: previous });
                    setError(message);
                } else {
                    setState({ status: "error", message });
                }
                showToast({ title: "Chưa đánh giá được địa điểm", description: message, tone: "error" });
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

    if (state.status === "checking") {
        return (
            <section aria-label="Đánh giá địa điểm" aria-busy="true" className="border-t border-charcoal/10 pt-3">
                <div className="h-11 animate-pulse rounded-lg bg-charcoal/5 motion-reduce:animate-none" />
            </section>
        );
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
                <p className="m-0 mt-1.5 text-xs text-charcoal/60">
                    Chấm theo tiện ích đi bộ, đi lại, y tế, dân cư và môi trường
                    {state.status === "idle" && state.currentDatasetVersion ? ` · dữ liệu v${state.currentDatasetVersion}` : ""}. Kết quả được lưu
                    riêng cho bạn.
                </p>
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
    const refreshing = state.status === "refreshing";
    const used = [...evaluation.strengths.items, ...evaluation.weaknesses.items].filter((item) => item.counted ?? !item.skipped).length;
    const pending = evaluation.pending ?? [];
    const thin = typeof evaluation.coverage === "number" && evaluation.coverage < COVERAGE_MIN;
    const overallTone = scoreTone(evaluation.overall);

    return (
        <section aria-labelledby={headingId} aria-busy={refreshing} className="border-t border-charcoal/10 pt-3">
            <div className="flex items-center justify-between gap-2">
                <h3 id={headingId} className="m-0 text-base font-semibold">
                    Đánh giá địa điểm
                </h3>
                <button
                    type="button"
                    onClick={run}
                    disabled={refreshing}
                    title="Đo lại địa điểm này (tính một lượt)"
                    className={`${ICON_BUTTON} w-auto gap-1 px-2 text-xs font-semibold`}
                    aria-label="Đánh giá lại"
                >
                    {refreshing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RotateCcw size={14} aria-hidden />}
                    {refreshing ? "Đang đánh giá…" : "Đánh giá lại"}
                </button>
            </div>
            <div className={`transition-opacity duration-200 motion-reduce:transition-none ${refreshing ? "pointer-events-none opacity-50" : ""}`}>
                <p className="m-0 mt-1 text-xs text-charcoal/60">
                    Đo lúc {formatEvaluatedAt(evaluation.analyzedAt)} · dữ liệu v{evaluation.datasetVersion}
                    {evaluation.outdated ? "" : " (mới nhất)"}
                </p>
                {evaluation.outdated ? (
                    <p className="m-0 mt-2 rounded-md bg-gold/15 px-2.5 py-1.5 text-xs text-charcoal/85">
                        Đã có dữ liệu v{evaluation.currentDatasetVersion}. Kết quả bên dưới vẫn theo v{evaluation.datasetVersion}; bấm “Đánh giá lại” để
                        đo với dữ liệu mới.
                    </p>
                ) : null}
                {evaluation.sample ? (
                    <p className="m-0 mt-1 text-xs text-charcoal/60">Bản phân tích cũ dùng số liệu minh họa. Bấm “Đánh giá lại” để đo thật.</p>
                ) : null}
                {(evaluation.blocking ?? []).map((item) => (
                    <p key={item.criterionId} role="alert" className="m-0 mt-2 flex gap-2 rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-800">
                        <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden />
                        <span>
                            <span className="font-semibold">{item.label}:</span> {item.message} Điểm tổng tối đa {score(item.cap)}.
                        </span>
                    </p>
                ))}

                <div className="mt-3 flex items-center gap-4 rounded-lg bg-charcoal/[0.03] px-3 py-3">
                    <ScoreRing
                        value={evaluation.overall}
                        muted={thin}
                        size={84}
                        label={evaluation.overall === null ? "Chưa có điểm tổng" : `Điểm tổng ${score(evaluation.overall)} trên 10`}
                    />
                    <div className="min-w-0">
                        <p className={`m-0 inline-flex rounded-md px-2 py-0.5 text-sm font-semibold ${TONE_BADGE[thin ? "none" : overallTone]}`}>{evaluation.rating}</p>
                        <p className="m-0 mt-1 text-xs text-charcoal/60">
                            Điểm tổng trên thang 10, trung bình có trọng số {used}/{evaluation.criteriaCount} tiêu chí
                            {thin ? " · dữ liệu còn mỏng, chỉ để tham khảo" : ""}
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
                    onEdit={(id) => {
                        setWeighting(null);
                        setEditing(id);
                    }}
                    weighting={weighting}
                    onWeighting={(id) => {
                        setEditing(null);
                        setWeighting(id);
                    }}
                    onWeight={(item, weight) => void changeWeight(item, weight)}
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
                    onEdit={(id) => {
                        setWeighting(null);
                        setEditing(id);
                    }}
                    weighting={weighting}
                    onWeighting={(id) => {
                        setEditing(null);
                        setWeighting(id);
                    }}
                    onWeight={(item, weight) => void changeWeight(item, weight)}
                    onSkip={(item) => void apply(item.id, () => overrideCriterion(point, item.id, { skipped: !item.skipped }))}
                    onScore={(item, value) => void apply(item.id, () => overrideCriterion(point, item.id, { score: value }))}
                    onReset={(item) => void apply(item.id, () => resetCriterion(point, item.id))}
                />
                {pending.length > 0 ? (
                    <CriterionGroup
                        title="Chưa tính vào điểm"
                        hint="Chưa có dữ liệu, nguồn chưa đo được, dữ liệu mỏng, hoặc tính năng chưa thực hiện. Bạn có thể tự chấm để đưa vào điểm tổng."
                        empty=""
                        items={pending}
                        busy={busy}
                        editing={editing}
                        selected={selected}
                        onSelect={select}
                        onEdit={(id) => {
                            setWeighting(null);
                            setEditing(id);
                        }}
                        weighting={weighting}
                        onWeighting={(id) => {
                            setEditing(null);
                            setWeighting(id);
                        }}
                        onWeight={(item, weight) => void changeWeight(item, weight)}
                        onSkip={(item) => void apply(item.id, () => overrideCriterion(point, item.id, { skipped: !item.skipped }))}
                        onScore={(item, value) => void apply(item.id, () => overrideCriterion(point, item.id, { score: value }))}
                        onReset={(item) => void apply(item.id, () => resetCriterion(point, item.id))}
                    />
                ) : null}
            </div>
        </section>
    );
}

interface GroupProps {
    title: string;
    /** Tổng điểm của nhóm; nhóm "chưa tính" không có. */
    points?: string;
    pointsClass?: string;
    hint?: string;
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
    weighting: string | null;
    onWeighting: (id: string | null) => void;
    /** null = về trọng số mặc định. */
    onWeight: (item: EvaluatedCriterion, weight: number | null) => void;
}

function CriterionGroup({ title, points, pointsClass, hint, empty, items, ...rest }: GroupProps): JSX.Element {
    const id = useId();
    return (
        <section aria-labelledby={id} className="mt-4">
            <h4 id={id} className="m-0 flex items-baseline justify-between gap-2 border-b border-charcoal/10 pb-1.5 text-sm font-semibold">
                <span>
                    {title} <span className="font-normal text-charcoal/55">({items.filter((item) => !item.skipped).length})</span>
                </span>
                {points ? <span className={`tabular-nums ${pointsClass ?? ""}`}>{points} điểm</span> : null}
            </h4>
            {hint ? <p className="m-0 mt-1.5 text-xs text-charcoal/55">{hint}</p> : null}
            {items.length === 0 ? (
                <p className="m-0 py-2 text-sm text-charcoal/60">{empty}</p>
            ) : (
                <ul className="m-0 list-none p-0">
                    {items.map((item, index) => (
                        <Fragment key={item.id}>
                            {/* Đường ngăn riêng: item bo góc nên không dùng border-b (bị méo ở góc). */}
                            {index > 0 ? (
                                <li role="presentation" aria-hidden="true" className="px-1 py-1">
                                    <div className="h-px bg-charcoal/10" />
                                </li>
                            ) : null}
                            <CriterionRow item={item} {...rest} />
                        </Fragment>
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
    weighting,
    onWeighting,
    onWeight,
}: { item: EvaluatedCriterion } & Omit<GroupProps, "title" | "points" | "pointsClass" | "hint" | "empty" | "items">): JSX.Element {
    const [draft, setDraft] = useState(String(item.score));
    const inputId = useId();
    const isEditing = editing === item.id;
    const isWeighting = weighting === item.id;
    const customWeight = item.weight !== item.defaultWeight;
    const isBusy = busy === item.id;
    const isSelected = selected === item.id;
    const skipped = item.skipped;
    // Không đo được (chưa có dữ liệu, nguồn lỗi): không hiện số; số minh họa và dữ liệu mỏng: hiện nhưng nhạt.
    const unmeasured = !item.manual && (item.status === "no_data" || item.status === "unavailable");
    const muted = skipped || item.counted === false;
    const withEvidence = hasEvidence(item);
    const Icon = CRITERION_ICON[item.id];

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
            className={`group/row -mx-2 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-charcoal/[0.04] focus-within:bg-charcoal/[0.04] motion-reduce:transition-none ${isSelected ? "bg-green/[0.06] ring-1 ring-green/30 hover:bg-green/[0.08]" : ""}`}
        >
            <div className="flex items-center gap-3">
                {/* Vùng nội dung bấm được: chọn tiêu chí (sau này hiện dẫn chứng trên bản đồ). */}
                <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(item)}
                    title={withEvidence ? "Xem dẫn chứng trên bản đồ" : "Chưa có dẫn chứng trên bản đồ"}
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-sm bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                >
                    <span
                        aria-hidden="true"
                        className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md ${skipped ? "bg-charcoal/5 text-charcoal/35" : "bg-green/10 text-green"}`}
                    >
                        <Icon size={18} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                            <span className={skipped ? "text-charcoal/45 line-through decoration-charcoal/45" : "text-charcoal"}>{item.label}</span>
                            {item.manual && !skipped ? <span className="rounded bg-charcoal/5 px-1.5 py-px text-[11px] font-semibold text-charcoal/70">Chỉnh tay</span> : null}
                            {skipped ? <span className="rounded bg-charcoal/5 px-1.5 py-px text-[11px] font-semibold text-charcoal/55">Đã bỏ qua</span> : null}
                            {!skipped && item.weight === 0 ? (
                                <span className="rounded bg-charcoal/5 px-1.5 py-px text-[11px] font-semibold text-charcoal/55">Không tính</span>
                            ) : null}
                            {skipped ? null : <StatusBadge item={item} />}
                            {withEvidence ? (
                                <MapPinned
                                    size={13}
                                    aria-hidden
                                    className={`text-green transition-opacity duration-150 motion-reduce:transition-none ${isSelected ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100"}`}
                                />
                            ) : null}
                        </span>
                        <span className={`mt-0.5 block text-sm ${skipped ? "text-charcoal/40 line-through decoration-charcoal/30" : "text-charcoal/80"}`}>
                            <span className={`font-semibold ${muted ? "text-charcoal/60" : TONE_TEXT[scoreTone(item.score)]}`}>{item.verdict}</span>
                            <span className="text-charcoal/40"> · </span>
                            {item.detail}
                        </span>
                        <span className="mt-0.5 block text-xs text-charcoal/50">
                            {item.groupLabel} · Trọng số {item.weight}
                            {customWeight ? ` (mặc định ${item.defaultWeight})` : ""} · Nguồn: {item.source}
                            {item.manual ? ` · Tự động: ${score(item.autoScore)}` : ""}
                        </span>
                        {item.note && !skipped && item.note !== item.detail ? <span className="mt-0.5 block text-xs text-charcoal/55 italic">{item.note}</span> : null}
                    </span>
                </button>
                <ScoreRing
                    value={unmeasured ? null : item.score}
                    size={42}
                    muted={muted}
                    label={
                        unmeasured
                            ? `${item.label}: chưa có điểm`
                            : `${item.label}: ${score(item.score)} trên 10${skipped ? ", đã bỏ qua" : item.status === "not_implemented" && !item.manual ? ", số minh họa" : ""}`
                    }
                />
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
                        aria-label={`Trọng số ${item.weight}${customWeight ? " (đã đổi)" : ""}: ${item.label}`}
                        title={customWeight ? `Trọng số ${item.weight} (mặc định ${item.defaultWeight})` : `Trọng số ${item.weight}`}
                        aria-expanded={isWeighting}
                        disabled={isBusy}
                        onClick={() => onWeighting(isWeighting ? null : item.id)}
                        className={`${ICON_BUTTON} w-auto gap-0.5 px-1.5 text-xs font-semibold tabular-nums ${customWeight ? "bg-gold/20 text-charcoal hover:bg-gold/30" : ""}`}
                    >
                        <Scale size={14} aria-hidden />
                        {item.weight}
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
            {isWeighting ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-white p-2 ring-1 ring-charcoal/10">
                    <span className="text-xs font-semibold text-charcoal/70">Trọng số (0–5)</span>
                    <WeightPicker
                        value={item.weight}
                        defaultValue={item.defaultWeight}
                        label={item.label}
                        disabled={isBusy}
                        onChange={(weight) => {
                            if (weight !== item.weight) onWeight(item, weight);
                        }}
                    />
                    {isBusy ? <Loader2 size={14} className="animate-spin text-charcoal/50" aria-hidden /> : null}
                    <span className="text-xs text-charcoal/55">Mặc định {item.defaultWeight}</span>
                    {customWeight ? (
                        <button type="button" disabled={isBusy} onClick={() => onWeight(item, null)} className={`${ICON_BUTTON} h-8 w-auto gap-1 px-2 text-xs font-semibold`}>
                            <RotateCcw size={13} aria-hidden /> Về mặc định
                        </button>
                    ) : null}
                    <button type="button" onClick={() => onWeighting(null)} className={`${ICON_BUTTON} ml-auto h-8 w-auto gap-1 px-2 text-xs font-semibold`}>
                        <X size={13} aria-hidden /> Đóng
                    </button>
                    <p className="m-0 w-full text-[11px] text-charcoal/50">Áp dụng cho mọi địa điểm của bạn. Quản lý tất cả ở nút cân cạnh ô tìm kiếm.</p>
                </div>
            ) : null}
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

const BADGE = "rounded px-1.5 py-px text-[11px] font-semibold";

/** Trạng thái đo của tiêu chí: chữ đi kèm màu, không phân biệt chỉ bằng màu. */
function StatusBadge({ item }: { item: EvaluatedCriterion }): JSX.Element | null {
    if (item.status === "not_implemented") return <span className={`${BADGE} bg-gold/25 text-charcoal`}>Chưa thực hiện · số minh họa</span>;
    if (item.status === "no_data") return <span className={`${BADGE} bg-charcoal/5 text-charcoal/65`}>Chưa có dữ liệu</span>;
    if (item.status === "unavailable") return <span className={`${BADGE} bg-charcoal/5 text-charcoal/65`}>Chưa đo được</span>;
    if (item.status === "fallback") return <span className={`${BADGE} bg-charcoal/5 text-charcoal/65`}>Ước tính</span>;
    if (item.confidence === "low" && !item.manual) return <span className={`${BADGE} bg-charcoal/5 text-charcoal/65`}>Dữ liệu mỏng</span>;
    return null;
}
