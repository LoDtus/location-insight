"use client";

import Link from "next/link";
import { useState, type JSX } from "react";

type Phase = "idle" | "running" | "done" | "error";

interface ResetStep {
    name: string;
    ms: number;
}

interface ResetOutcome {
    database: string;
    durationMs: number;
    steps: ResetStep[];
}

interface RunResponse {
    ok: boolean;
    message?: string;
    data?: ResetOutcome;
}

interface Props {
    nonce: string;
    database: string;
    databaseHost: string;
}

export default function ResetPanel({ nonce, database, databaseHost }: Props): JSX.Element {
    const [phase, setPhase] = useState<Phase>("idle");
    const [outcome, setOutcome] = useState<ResetOutcome | null>(null);
    const [message, setMessage] = useState<string>("");

    async function run(): Promise<void> {
        setPhase("running");
        setMessage("");
        try {
            const response = await fetch("/reset/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nonce }),
                cache: "no-store",
            });
            const body = (await response.json()) as RunResponse;
            if (!response.ok || !body.ok || !body.data) {
                setMessage(body.message ?? `Không thành công (${response.status}).`);
                setPhase("error");
                return;
            }
            setOutcome(body.data);
            setPhase("done");
        } catch {
            setMessage("Không kết nối được tới máy chủ. Kiểm tra backend rồi thử lại.");
            setPhase("error");
        }
    }

    return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 bg-white px-4 py-10 text-charcoal">
            <header className="space-y-2">
                <p className="inline-block rounded bg-amber-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                    Chỉ môi trường dev
                </p>
                <h1 className="text-2xl font-bold">Reset dữ liệu dev</h1>
                <p className="text-sm text-charcoal/80">
                    Xóa <strong>toàn bộ</strong> bảng và dữ liệu của database <code>{database}</code> trên{" "}
                    <code>{databaseHost}</code>, dựng lại cấu trúc theo entity hiện tại, xóa bộ nhớ đệm Redis rồi
                    seed lại dữ liệu mẫu. Mọi người dùng sẽ bị đăng xuất.
                </p>
            </header>

            {phase !== "done" && (
                <button
                    type="button"
                    onClick={run}
                    disabled={phase === "running"}
                    className="rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60"
                >
                    {phase === "running" ? "Đang reset…" : "Xóa và dựng lại database"}
                </button>
            )}

            <div aria-live="polite" className="space-y-3 text-sm">
                {phase === "running" && <p>Đang xóa, dựng lại và seed. Có thể mất vài chục giây, đừng đóng trang.</p>}
                {phase === "error" && <p className="rounded bg-red-50 p-3 text-red-900">{message}</p>}
                {phase === "done" && outcome && (
                    <div className="space-y-3 rounded bg-green-50 p-3 text-green-950">
                        <p className="font-semibold">Hoàn tất sau {(outcome.durationMs / 1000).toFixed(1)} giây.</p>
                        <ul className="space-y-1">
                            {outcome.steps.map((step) => (
                                <li key={step.name} className="flex justify-between gap-4">
                                    <span>{step.name}</span>
                                    <span className="tabular-nums">{step.ms} ms</span>
                                </li>
                            ))}
                        </ul>
                        <Link href="/auth/login" className="inline-block font-semibold underline">
                            Đăng nhập lại
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
