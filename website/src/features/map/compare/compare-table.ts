import { CRITERION_IDS, type CriterionId } from "@/features/map/criteria-icons";
import type { CompareItem, CriterionGroup, EvaluatedCriterion } from "@/features/map/map.types";

export interface CompareCriterionRow {
    id: CriterionId;
    label: string;
    group: CriterionGroup;
    groupLabel: string;
    /** Ô của từng cột (theo thứ tự `items`); null khi địa điểm chưa đánh giá. */
    cells: Array<EvaluatedCriterion | null>;
    /** Chỉ số các cột có điểm cao nhất của hàng (bỏ qua ô đã bỏ qua; cần ít nhất 2 cột có điểm). */
    best: number[];
}

export interface CompareTable {
    groups: Array<{ group: CriterionGroup; label: string; rows: CompareCriterionRow[] }>;
    /** Chỉ số các cột có điểm tổng cao nhất (cần ít nhất 2 cột có điểm). */
    bestOverall: number[];
}

const GROUP_ORDER: CriterionGroup[] = ["walk", "move", "health", "env"];

function criteriaOf(item: CompareItem): EvaluatedCriterion[] {
    const evaluation = item.evaluation;
    return evaluation ? [...evaluation.strengths.items, ...evaluation.weaknesses.items, ...evaluation.skipped] : [];
}

/** Chỉ số các giá trị lớn nhất; rỗng nếu chưa đủ 2 giá trị để so. */
export function bestIndexes(values: Array<number | null>): number[] {
    const present = values.filter((value): value is number => value !== null);
    if (present.length < 2) return [];
    const top = Math.max(...present);
    if (present.every((value) => value === top)) return [];
    return values.flatMap((value, index) => (value === top ? [index] : []));
}

/** Dựng bảng so sánh: hàng theo 19 tiêu chí cố định (thứ tự của CRITERION_IDS), cột theo địa điểm. */
export function buildCompareTable(items: readonly CompareItem[]): CompareTable {
    const byItem = items.map((item) => new Map(criteriaOf(item).map((criterion) => [criterion.id, criterion])));
    const rows: CompareCriterionRow[] = [];
    for (const id of CRITERION_IDS) {
        const cells = byItem.map((map) => map.get(id) ?? null);
        const sample = cells.find((cell): cell is EvaluatedCriterion => cell !== null);
        if (!sample) continue;
        rows.push({
            id,
            label: sample.label,
            group: sample.group,
            groupLabel: sample.groupLabel,
            cells,
            best: bestIndexes(cells.map((cell) => (cell && !cell.skipped ? cell.score : null))),
        });
    }
    const groups = GROUP_ORDER.flatMap((group) => {
        const groupRows = rows.filter((row) => row.group === group);
        return groupRows.length > 0 ? [{ group, label: groupRows[0].groupLabel, rows: groupRows }] : [];
    });
    return { groups, bestOverall: bestIndexes(items.map((item) => item.evaluation?.overall ?? null)) };
}
