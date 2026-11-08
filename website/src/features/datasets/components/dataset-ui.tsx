import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import type { JSX, ReactNode } from "react";

import type { QualityCheck } from "@/features/datasets/datasets.api";
import { summarizeChecks } from "@/features/datasets/datasets.utils";

export const BUTTON_PRIMARY =
    "inline-flex min-h-9 items-center gap-1.5 rounded-md bg-charcoal px-3 text-sm font-semibold text-white hover:bg-charcoal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-50";
export const BUTTON_GHOST =
    "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 text-sm font-semibold text-charcoal hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-50";
export const BUTTON_DANGER =
    "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-red-700/30 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50";
export const INPUT =
    "w-full rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green";

export type Tone = "green" | "gold" | "red" | "muted";

const TONE_CLASS: Record<Tone, string> = {
    green: "bg-green/10 text-green",
    gold: "bg-gold/20 text-charcoal",
    red: "bg-red-50 text-red-700",
    muted: "bg-charcoal/5 text-charcoal/70",
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }): JSX.Element {
    return <span className={`inline-flex rounded px-1.5 py-px text-xs font-semibold whitespace-nowrap ${TONE_CLASS[tone]}`}>{children}</span>;
}

/** Mã băm, ID, mã lớp: chữ đơn cách, giữ nguyên giá trị đầy đủ trong title. */
export function Mono({ value, display }: { value: string; display?: string }): JSX.Element {
    return (
        <code title={value} className="rounded bg-charcoal/[0.04] px-1 py-px font-mono text-xs text-charcoal/80">
            {display ?? value}
        </code>
    );
}

export function Skeleton(): JSX.Element {
    return <div className="h-40 animate-pulse rounded-lg bg-charcoal/5 motion-reduce:animate-none" />;
}

export function EmptyNote({ children }: { children: ReactNode }): JSX.Element {
    return <p className="m-0 rounded-lg border border-dashed border-charcoal/15 px-4 py-6 text-center text-sm text-charcoal/65">{children}</p>;
}

/** Danh sách kiểm tra: lỗi chặn trước, rồi cảnh báo, số kiểm tra đạt gộp một dòng. */
export function CheckList({ checks }: { checks: readonly QualityCheck[] }): JSX.Element {
    const summary = summarizeChecks(checks);
    if (checks.length === 0) return <p className="m-0 text-sm text-charcoal/60">Chưa có kết quả kiểm tra.</p>;
    return (
        <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
            {summary.blocking.map((check) => (
                <li key={check.code} className="flex gap-2 rounded-md bg-red-50 px-2.5 py-1.5 text-red-800">
                    <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                        <span className="sr-only">Lỗi chặn: </span>
                        <code className="font-mono text-xs">{check.code}</code> — cần {check.expected}; thực tế {check.observed}
                    </span>
                </li>
            ))}
            {summary.warnings.map((check) => (
                <li key={check.code} className="flex gap-2 rounded-md bg-gold/15 px-2.5 py-1.5 text-charcoal">
                    <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                        <span className="sr-only">Cảnh báo: </span>
                        <code className="font-mono text-xs">{check.code}</code> — cần {check.expected}; thực tế {check.observed}
                    </span>
                </li>
            ))}
            {summary.passed > 0 ? (
                <li className="flex items-center gap-2 px-2.5 py-1 text-charcoal/70">
                    <CheckCircle2 size={16} className="text-green" aria-hidden /> {summary.passed} kiểm tra đạt
                </li>
            ) : null}
        </ul>
    );
}
