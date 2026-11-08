"use client";

import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type Announcements,
    type CollisionDetection,
    type DragEndEvent,
    type DragStartEvent,
    type Modifier,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    ArrowDownWideNarrow,
    ArrowUpNarrowWide,
    GitCompareArrows,
    GripVertical,
    Loader2,
    Map as MapIcon,
    MapPin,
    NotebookPen,
    RotateCcw,
    Sparkles,
    WandSparkles,
    X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore, type CSSProperties, type JSX, type ReactNode } from "react";

import ScoreRing, { formatScore } from "@/features/map/components/score-ring";
import { CRITERION_ICON } from "@/features/map/criteria-icons";
import {
    applyOrder,
    moveItem,
    readRowOrder,
    serverRowOrder,
    sortByOverall,
    subscribeRowOrder,
    writeRowOrder,
    type OverallSort,
} from "@/features/map/compare/compare-order";
import CompareCharts from "@/features/map/compare/compare-charts";
import { buildCompareTable } from "@/features/map/compare/compare-table";
import { COMPARE_MAX, reloadSavedPlaces, savedTitle } from "@/features/map/hooks/use-saved-places";
import { PLACE_KIND_LABEL } from "@/features/map/map-place-match";
import { PIN_ZOOM } from "@/features/map/map.geo";
import { getCompare, isAbortError, mapErrorMessage, reorderCompare, runEvaluation, updateSavedPlace } from "@/features/map/map.service";
import type { CompareItem, MapPoint } from "@/features/map/map.types";
import { showToast } from "@/shared/components/toast/toast-store";
import { getConfirmModal } from "@/shared/utils/confirm.utils";

const NO_ITEMS: CompareItem[] = [];

type LoadState = { status: "loading" } | { status: "ready"; items: CompareItem[] } | { status: "error"; message: string };

function mapHref(root: string, point: MapPoint): string {
    const at = `${Number(point.lat.toFixed(6))},${Number(point.lng.toFixed(6))}`;
    return `${root}/map?c=${at}&z=${PIN_ZOOM}&pin=${at}&ve=so-sanh`;
}

const LABEL_CELL = "sticky left-0 z-10 w-36 min-w-36 bg-white px-3 py-3 text-left align-top text-sm font-normal text-charcoal/65 sm:w-48 sm:min-w-48";
const CELL = "min-w-56 px-3 py-3 align-top text-sm";

const COL = "col:";
/** id kéo thả của dòng tiêu chí: "row|nhóm|tiêu chí" (chỉ đổi chỗ trong cùng nhóm). */
const rowDragId = (group: string, criterion: string): string => `row|${group}|${criterion}`;
/** Phạm vi thả: cột với cột, dòng với dòng cùng nhóm. */
const scopeOf = (id: string): string => (id.startsWith(COL) ? COL : id.split("|").slice(0, 2).join("|"));

const collision: CollisionDetection = (args) =>
    closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) => scopeOf(String(container.id)) === scopeOf(String(args.active.id))),
    });

/** Cột chỉ trượt ngang, dòng chỉ trượt dọc. */
const lockAxis: Modifier = ({ active, transform }) => (active && String(active.id).startsWith(COL) ? { ...transform, y: 0 } : { ...transform, x: 0 });

const HANDLE =
    "inline-flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-charcoal/40 hover:bg-charcoal/5 hover:text-charcoal active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green";

function Row({ label, children, className = "" }: { label: ReactNode; children: ReactNode; className?: string }): JSX.Element {
    return (
        <tr className={`border-t border-charcoal/10 ${className}`}>
            <th scope="row" className={LABEL_CELL}>
                {label}
            </th>
            {children}
        </tr>
    );
}

/**
 * Bảng so sánh địa điểm đã lưu: mỗi cột một địa điểm, hàng là điểm tổng và 19 tiêu chí. Điểm lấy từ lượt đánh giá
 * gần nhất của chính người dùng; địa điểm chưa đánh giá thì mời mở bản đồ để đánh giá.
 */
export default function CompareScreen({ root = "/app" }: { root?: "/app" | "/admin" }): JSX.Element {
    const [state, setState] = useState<LoadState>({ status: "loading" });
    const [removing, setRemoving] = useState<string | null>(null);
    const [evaluating, setEvaluating] = useState<Set<string>>(new Set());
    const [draggingCol, setDraggingCol] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const rowOrder = useSyncExternalStore(subscribeRowOrder, readRowOrder, serverRowOrder);
    const dndId = useId();
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    /**
     * Đánh giá ngay tại bảng (chỉ khi người dùng bấm): nhận bản phân tích mới nhất của địa điểm, chưa có thì AI chạy;
     * mỗi lần bấm là một lượt của người dùng. Xong thì cột hiện điểm theo trọng số của chính họ.
     */
    async function evaluate(item: CompareItem): Promise<void> {
        setEvaluating((current) => new Set(current).add(item.id));
        try {
            const { source } = await runEvaluation({ lat: item.lat, lng: item.lng }, false);
            const fresh = await getCompare();
            setState({ status: "ready", items: fresh });
            void reloadSavedPlaces();
            const updated = fresh.find((entry) => entry.id === item.id)?.evaluation;
            showToast({
                title: source === "fresh" ? "AI đã đánh giá xong địa điểm" : "Đã có kết quả đánh giá địa điểm",
                description:
                    updated?.overall != null
                        ? `${savedTitle(item)}: ${formatScore(updated.overall)}/10, mức ${updated.rating.toLowerCase()}.`
                        : savedTitle(item),
            });
        } catch (error) {
            showToast({
                title: "Chưa đánh giá được",
                description: mapErrorMessage(error, "Vui lòng thử lại."),
                tone: "error",
            });
        } finally {
            setEvaluating((current) => {
                const next = new Set(current);
                next.delete(item.id);
                return next;
            });
        }
    }

    const load = useCallback((signal?: AbortSignal): void => {
        getCompare(signal)
            .then((items) => setState({ status: "ready", items }))
            .catch((error: unknown) => {
                if (isAbortError(error)) return;
                setState({
                    status: "error",
                    message: mapErrorMessage(error, "Không tải được danh sách so sánh."),
                });
            });
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const items = state.status === "ready" ? state.items : NO_ITEMS;
    const table = useMemo(() => buildCompareTable(items), [items]);
    const groups = useMemo(
        () =>
            table.groups.map((group) => ({
                ...group,
                rows: applyOrder(group.rows, (row) => row.id, rowOrder[group.group]),
            })),
        [table, rowOrder],
    );
    const rowsCustomized = Object.keys(rowOrder).length > 0;
    const scored = items.filter((item) => item.evaluation?.overall != null).length;

    /** Đổi thứ tự cột: cập nhật ngay, lưu lên máy chủ; lệch danh sách thì tải lại, lỗi khác thì trả về thứ tự cũ. */
    async function saveColumns(next: CompareItem[], done?: string): Promise<void> {
        const previous = items;
        if (next.every((item, index) => item.id === previous[index]?.id)) {
            if (done) showToast({ title: "Thứ tự cột đã đúng như vậy", tone: "info" });
            return;
        }
        setState({ status: "ready", items: next });
        setSaving(true);
        try {
            await reorderCompare(next.map((item) => item.id));
            if (done) showToast({ title: done, tone: "success" });
        } catch (error) {
            setState({ status: "ready", items: previous });
            showToast({
                title: "Chưa lưu được thứ tự cột",
                description: mapErrorMessage(error, "Vui lòng thử lại."),
                tone: "error",
            });
            load();
        } finally {
            setSaving(false);
        }
    }

    function sortColumns(direction: OverallSort): void {
        void saveColumns(
            sortByOverall(items, direction),
            direction === "desc" ? "Đã xếp cột theo điểm tổng cao → thấp" : "Đã xếp cột theo điểm tổng thấp → cao",
        );
    }

    function onDragStart(event: DragStartEvent): void {
        const id = String(event.active.id);
        setDraggingCol(id.startsWith(COL) ? id.slice(COL.length) : null);
    }

    function onDragEnd(event: DragEndEvent): void {
        setDraggingCol(null);
        const activeId = String(event.active.id);
        const overId = event.over ? String(event.over.id) : null;
        if (!overId || overId === activeId || scopeOf(overId) !== scopeOf(activeId)) return;
        if (activeId.startsWith(COL)) {
            const from = items.findIndex((item) => `${COL}${item.id}` === activeId);
            const to = items.findIndex((item) => `${COL}${item.id}` === overId);
            if (from >= 0 && to >= 0) void saveColumns(moveItem(items, from, to));
            return;
        }
        const [, groupId] = activeId.split("|");
        const group = groups.find((entry) => entry.group === groupId);
        if (!group) return;
        const ids = group.rows.map((row) => rowDragId(group.group, row.id));
        const from = ids.indexOf(activeId);
        const to = ids.indexOf(overId);
        if (from < 0 || to < 0) return;
        writeRowOrder({
            ...readRowOrder(),
            [group.group]: moveItem(group.rows, from, to).map((row) => row.id),
        });
    }

    const titleOf = (id: string): string => {
        if (id.startsWith(COL)) {
            const item = items.find((entry) => `${COL}${entry.id}` === id);
            return item ? `cột ${savedTitle(item)}` : "cột";
        }
        const [, groupId, criterion] = id.split("|");
        const row = groups.find((entry) => entry.group === groupId)?.rows.find((entry) => entry.id === criterion);
        return row ? `dòng ${row.label}` : "dòng";
    };
    const announcements: Announcements = {
        onDragStart: ({ active }) => `Đã nhấc ${titleOf(String(active.id))}. Dùng phím mũi tên để di chuyển, Space để thả, Esc để hủy.`,
        onDragOver: ({ active, over }) => (over ? `${titleOf(String(active.id))} đang ở vị trí của ${titleOf(String(over.id))}.` : undefined),
        onDragEnd: ({ active, over }) => (over ? `Đã thả ${titleOf(String(active.id))}.` : `Đã thả ${titleOf(String(active.id))} về chỗ cũ.`),
        onDragCancel: ({ active }) => `Đã hủy kéo ${titleOf(String(active.id))}.`,
    };

    async function removeItem(item: CompareItem): Promise<void> {
        const ok = await getConfirmModal({
            title: "Bỏ khỏi so sánh?",
            content: `“${savedTitle(item)}” sẽ không còn trong bảng so sánh. Địa điểm vẫn nằm trong danh sách đã lưu, bạn có thể thêm lại bất cứ lúc nào.`,
            okText: "Bỏ khỏi so sánh",
            cancelText: "Hủy",
        });
        if (!ok) return;
        setRemoving(item.id);
        try {
            await updateSavedPlace(item.id, { compared: false });
            setState((current) =>
                current.status === "ready"
                    ? {
                          status: "ready",
                          items: current.items.filter((entry) => entry.id !== item.id),
                      }
                    : current,
            );
            void reloadSavedPlaces();
            showToast({
                title: "Đã bỏ khỏi so sánh",
                description: savedTitle(item),
                tone: "info",
            });
        } catch (error) {
            showToast({
                title: "Chưa bỏ được khỏi so sánh",
                description: mapErrorMessage(error, "Vui lòng thử lại."),
                tone: "error",
            });
        } finally {
            setRemoving(null);
        }
    }

    return (
        <div className="h-full w-full overflow-y-auto bg-white">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
                <header className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="m-0 text-2xl font-semibold text-balance">So sánh địa điểm</h1>
                        <p className="m-0 mt-1 text-sm text-charcoal/65">
                            {state.status === "ready" && items.length > 0
                                ? `${items.length}/${COMPARE_MAX} địa điểm. Điểm lấy từ lượt đánh giá gần nhất của chính bạn.`
                                : `So sánh tối đa ${COMPARE_MAX} địa điểm đã lưu theo 19 tiêu chí đánh giá.`}
                        </p>
                    </div>
                    <Link
                        href={`${root}/map`}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-charcoal/15 bg-white px-3 text-sm font-semibold text-charcoal no-underline hover:bg-charcoal/5"
                    >
                        <MapIcon size={16} aria-hidden /> Mở bản đồ
                    </Link>
                </header>

                {state.status === "loading" ? (
                    <p role="status" className="m-0 mt-8 flex items-center gap-2 text-sm text-charcoal/70">
                        <Loader2 size={16} className="animate-spin" aria-hidden /> Đang tải…
                    </p>
                ) : null}
                {state.status === "error" ? (
                    <div role="alert" className="mt-8 grid justify-items-start gap-2 text-sm">
                        <p className="m-0 text-red-700">{state.message}</p>
                        <button type="button" onClick={() => load()} className="rounded-lg bg-charcoal/5 px-3 py-1.5 font-semibold hover:bg-charcoal/10">
                            Thử lại
                        </button>
                    </div>
                ) : null}
                {state.status === "ready" && items.length === 0 ? (
                    <div className="mt-10 grid max-w-md justify-items-start gap-2">
                        <GitCompareArrows size={28} className="text-charcoal/35" aria-hidden />
                        <p className="m-0 text-base font-semibold">Chưa có địa điểm nào để so sánh</p>
                        <p className="m-0 text-sm text-charcoal/65">
                            Trên bản đồ, mở một địa điểm, bấm “Lưu địa điểm” rồi “So sánh”. Hoặc mở mục “Đã lưu” cạnh ô tìm kiếm và bấm biểu tượng so sánh.
                        </p>
                        <Link
                            href={`${root}/map`}
                            className="mt-1 inline-flex items-center gap-2 rounded-lg bg-green px-4 py-2 text-sm font-semibold text-cream no-underline hover:bg-green/90"
                        >
                            <MapIcon size={16} aria-hidden /> Tới bản đồ
                        </Link>
                    </div>
                ) : null}

                {items.length > 0 ? (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                        <div role="group" aria-label="Xếp cột theo điểm tổng" className="flex flex-wrap items-center gap-1.5 text-sm">
                            <span className="mr-1 text-charcoal/60">Xếp cột theo điểm tổng:</span>
                            <button
                                type="button"
                                disabled={saving || items.length < 2 || scored === 0}
                                title={scored === 0 ? "Chưa có địa điểm nào được đánh giá" : undefined}
                                onClick={() => sortColumns("desc")}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-charcoal/15 bg-white px-3 font-semibold hover:bg-charcoal/5 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                <ArrowDownWideNarrow size={15} aria-hidden /> Cao → thấp
                            </button>
                            <button
                                type="button"
                                disabled={saving || items.length < 2 || scored === 0}
                                title={scored === 0 ? "Chưa có địa điểm nào được đánh giá" : undefined}
                                onClick={() => sortColumns("asc")}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-charcoal/15 bg-white px-3 font-semibold hover:bg-charcoal/5 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                <ArrowUpNarrowWide size={15} aria-hidden /> Thấp → cao
                            </button>
                            {saving ? <Loader2 size={15} className="animate-spin text-charcoal/50" aria-label="Đang lưu thứ tự" /> : null}
                        </div>
                        {rowsCustomized ? (
                            <button
                                type="button"
                                onClick={() => writeRowOrder({})}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal"
                            >
                                <RotateCcw size={14} aria-hidden /> Thứ tự tiêu chí mặc định
                            </button>
                        ) : null}
                    </div>
                ) : null}
                {items.length > 0 ? (
                    <DndContext
                        id={dndId}
                        sensors={sensors}
                        collisionDetection={collision}
                        modifiers={[lockAxis]}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDragCancel={() => setDraggingCol(null)}
                        accessibility={{
                            announcements,
                            screenReaderInstructions: {
                                draggable: "Nhấn Space hoặc Enter để nhấc, dùng phím mũi tên để di chuyển, Space để thả, Esc để hủy.",
                            },
                        }}
                    >
                        <div className="mt-3 overflow-x-auto rounded-lg border border-charcoal/10 [scrollbar-width:thin]">
                            <table className="w-full border-collapse">
                                <caption className="sr-only">Bảng so sánh {items.length} địa điểm theo điểm tổng và 19 tiêu chí</caption>
                                <thead>
                                    <tr>
                                        <th scope="col" className={`${LABEL_CELL} align-bottom text-xs`}>
                                            Địa điểm
                                        </th>
                                        <SortableContext items={items.map((item) => `${COL}${item.id}`)} strategy={horizontalListSortingStrategy}>
                                            {items.map((item) => (
                                                <SortableHeader key={item.id} id={`${COL}${item.id}`} title={savedTitle(item)}>
                                                    <MapPin size={16} className="mt-0.5 shrink-0 text-green" aria-hidden />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="m-0 text-base leading-snug font-semibold text-charcoal">{savedTitle(item)}</p>
                                                        <p className="m-0 mt-0.5 line-clamp-2 text-xs text-charcoal/60">
                                                            {item.label ? `${item.name} · ` : item.kind ? `${PLACE_KIND_LABEL[item.kind]} · ` : ""}
                                                            {item.address || `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`}
                                                        </p>
                                                        <Link
                                                            href={mapHref(root, item)}
                                                            className="mt-1.5 inline-block text-xs font-semibold text-green underline-offset-2 hover:underline"
                                                        >
                                                            Xem trên bản đồ
                                                        </Link>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        aria-label={`Bỏ ${savedTitle(item)} khỏi so sánh`}
                                                        title="Bỏ khỏi so sánh"
                                                        disabled={removing === item.id}
                                                        onClick={() => void removeItem(item)}
                                                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-transparent text-charcoal/55 hover:bg-charcoal/5 hover:text-charcoal disabled:opacity-40"
                                                    >
                                                        {removing === item.id ? (
                                                            <Loader2 size={15} className="animate-spin" aria-hidden />
                                                        ) : (
                                                            <X size={15} aria-hidden />
                                                        )}
                                                    </button>
                                                </SortableHeader>
                                            ))}
                                        </SortableContext>
                                    </tr>
                                </thead>
                                <tbody>
                                    <Row label="Điểm tổng">
                                        {items.map((item, index) => {
                                            const evaluation = item.evaluation;
                                            const best = table.bestOverall.includes(index);
                                            return (
                                                <td
                                                    key={item.id}
                                                    className={`${CELL} ${best ? "bg-green/5" : ""} ${draggingCol === item.id ? "opacity-40" : ""}`}
                                                >
                                                    {evaluation ? (
                                                        <div className="flex items-center gap-3">
                                                            <ScoreRing
                                                                value={evaluation.overall}
                                                                size={56}
                                                                label={
                                                                    evaluation.overall === null
                                                                        ? "Chưa có điểm"
                                                                        : `Điểm tổng ${formatScore(evaluation.overall)} trên 10`
                                                                }
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="m-0 font-semibold">{evaluation.rating}</p>
                                                                {best ? (
                                                                    <p className="m-0 mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-green">
                                                                        <Sparkles size={12} aria-hidden /> Cao nhất
                                                                    </p>
                                                                ) : null}
                                                                <p className="m-0 mt-0.5 text-xs text-charcoal/55">
                                                                    Dữ liệu v{evaluation.datasetVersion}
                                                                    {evaluation.outdated ? " · có dữ liệu mới" : ""}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="grid justify-items-start gap-1.5">
                                                            <p className="m-0 text-charcoal/60">Bạn chưa đánh giá địa điểm này</p>
                                                            <button
                                                                type="button"
                                                                disabled={evaluating.has(item.id)}
                                                                onClick={() => void evaluate(item)}
                                                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-charcoal px-3 text-xs font-semibold text-white hover:bg-charcoal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-60"
                                                            >
                                                                {evaluating.has(item.id) ? (
                                                                    <Loader2 size={14} className="animate-spin" aria-hidden />
                                                                ) : (
                                                                    <WandSparkles size={14} aria-hidden />
                                                                )}
                                                                {evaluating.has(item.id) ? "Đang đánh giá…" : "Đánh giá ngay"}
                                                            </button>
                                                            <span className="text-[11px] text-charcoal/50">Tính một lượt đánh giá của bạn.</span>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </Row>
                                    <Row label="Tóm tắt">
                                        {items.map((item) => (
                                            <td key={item.id} className={`${CELL} text-charcoal/80 ${draggingCol === item.id ? "opacity-40" : ""}`}>
                                                {item.evaluation ? (
                                                    <p className="m-0 line-clamp-5">{item.evaluation.summary}</p>
                                                ) : (
                                                    <span className="text-charcoal/35">—</span>
                                                )}
                                            </td>
                                        ))}
                                    </Row>
                                    <Row label="Điểm mạnh / yếu">
                                        {items.map((item) => (
                                            <td key={item.id} className={`${CELL} ${draggingCol === item.id ? "opacity-40" : ""}`}>
                                                {item.evaluation ? (
                                                    <span className="tabular-nums">
                                                        <span className="font-semibold text-green">+{formatScore(item.evaluation.strengths.points)}</span>
                                                        <span className="text-charcoal/40"> / </span>
                                                        <span className="font-semibold text-red-700">{formatScore(item.evaluation.weaknesses.points)}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-charcoal/35">—</span>
                                                )}
                                            </td>
                                        ))}
                                    </Row>
                                    <Row
                                        label={
                                            <span className="inline-flex items-center gap-1.5">
                                                <NotebookPen size={14} aria-hidden /> Ghi chú
                                            </span>
                                        }
                                    >
                                        {items.map((item) => (
                                            <td key={item.id} className={`${CELL} ${draggingCol === item.id ? "opacity-40" : ""}`}>
                                                {item.note ? (
                                                    <p className="m-0 line-clamp-3 whitespace-pre-line text-charcoal/80">{item.note}</p>
                                                ) : (
                                                    <span className="text-charcoal/35">—</span>
                                                )}
                                            </td>
                                        ))}
                                    </Row>

                                    {groups.map((group) => (
                                        <GroupRows key={group.group} label={group.label} columns={items.length}>
                                            <SortableContext
                                                items={group.rows.map((row) => rowDragId(group.group, row.id))}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {group.rows.map((row) => {
                                                    const Icon = CRITERION_ICON[row.id];
                                                    return (
                                                        <SortableRow
                                                            key={row.id}
                                                            id={rowDragId(group.group, row.id)}
                                                            title={row.label}
                                                            label={
                                                                <span className="inline-flex items-start gap-2 text-charcoal/80">
                                                                    <Icon size={15} className="mt-0.5 shrink-0 text-charcoal/50" aria-hidden />
                                                                    {row.label}
                                                                </span>
                                                            }
                                                        >
                                                            {row.cells.map((cell, index) => {
                                                                const best = row.best.includes(index);
                                                                return (
                                                                    <td
                                                                        key={items[index].id}
                                                                        className={`${CELL} ${best ? "bg-green/5" : ""} ${draggingCol === items[index].id ? "opacity-40" : ""}`}
                                                                    >
                                                                        {cell ? (
                                                                            <div className="flex items-start gap-2.5">
                                                                                <ScoreRing
                                                                                    value={cell.score}
                                                                                    size={36}
                                                                                    muted={cell.skipped}
                                                                                    label={
                                                                                        cell.skipped
                                                                                            ? `${row.label}: đã bỏ qua`
                                                                                            : `${row.label}: ${formatScore(cell.score)} trên 10`
                                                                                    }
                                                                                />
                                                                                <div className="min-w-0">
                                                                                    <p
                                                                                        className={`m-0 font-semibold ${cell.skipped ? "text-charcoal/40 line-through" : ""}`}
                                                                                    >
                                                                                        {cell.verdict}
                                                                                        {cell.manual && !cell.skipped ? (
                                                                                            <span className="ml-1 text-xs font-normal text-charcoal/50">
                                                                                                (điểm tự đặt)
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </p>
                                                                                    <p
                                                                                        className={`m-0 text-xs ${cell.skipped ? "text-charcoal/35" : "text-charcoal/60"}`}
                                                                                    >
                                                                                        {cell.skipped ? "Đã bỏ qua" : cell.detail}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-charcoal/35">—</span>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </SortableRow>
                                                    );
                                                })}
                                            </SortableContext>
                                        </GroupRows>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </DndContext>
                ) : null}
                {items.length > 0 ? (
                    <p className="m-0 mt-3 text-xs text-charcoal/55">
                        Ô nền xanh là điểm cao nhất của hàng. Tiêu chí đã bỏ qua không tính vào điểm tổng. Kéo biểu tượng ⋮⋮ để đổi chỗ cột địa điểm hoặc dòng
                        tiêu chí (trong cùng nhóm).
                    </p>
                ) : null}
                {items.length > 0 ? <CompareCharts items={items} table={table} titleOf={savedTitle} /> : null}
            </div>
        </div>
    );
}

function GroupRows({ label, columns, children }: { label: string; columns: number; children: ReactNode }): JSX.Element {
    return (
        <>
            <tr className="border-t border-charcoal/10 bg-charcoal/[0.03]">
                <th scope="colgroup" colSpan={columns + 1} className="sticky left-0 px-3 py-2 text-left text-xs font-semibold text-charcoal/70">
                    {label}
                </th>
            </tr>
            {children}
        </>
    );
}

/** Ô tiêu đề cột kéo thả được (bằng tay nắm, chuột/chạm/bàn phím). */
function SortableHeader({ id, title, children }: { id: string; title: string; children: ReactNode }): JSX.Element {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
    };
    return (
        <th
            ref={setNodeRef}
            scope="col"
            style={style}
            className={`${CELL} relative text-left font-normal ${isDragging ? "z-20 bg-white shadow-[0_8px_24px_rgba(16,17,17,0.18)]" : ""}`}
        >
            <div className="flex items-start gap-1.5">
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    {...attributes}
                    {...listeners}
                    aria-label={`Kéo để đổi chỗ cột ${title}`}
                    title="Kéo để đổi chỗ"
                    className={`${HANDLE} -ml-1.5`}
                >
                    <GripVertical size={15} aria-hidden />
                </button>
                {children}
            </div>
        </th>
    );
}

/** Dòng tiêu chí kéo thả được trong nhóm của nó. */
function SortableRow({ id, title, label, children }: { id: string; title: string; label: ReactNode; children: ReactNode }): JSX.Element {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
    };
    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`border-t border-charcoal/10 ${isDragging ? "relative z-20 bg-white shadow-[0_8px_24px_rgba(16,17,17,0.18)]" : ""}`}
        >
            <th scope="row" className={LABEL_CELL}>
                <span className="flex items-start gap-1">
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        {...attributes}
                        {...listeners}
                        aria-label={`Kéo để đổi chỗ dòng ${title}`}
                        title="Kéo để đổi chỗ"
                        className={`${HANDLE} -mt-0.5 -ml-1.5`}
                    >
                        <GripVertical size={14} aria-hidden />
                    </button>
                    {label}
                </span>
            </th>
            {children}
        </tr>
    );
}
