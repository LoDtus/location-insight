"use client";

import { useEffect, useState } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS, AUTH_TITLE_CLASS } from "@/app/auth/form-class";
import { AuthApiError } from "@/features/auth/auth.api";
import {
    hidePost,
    listReports,
    setTopicStatus,
    type DiscussionReport,
} from "@/features/discussions/discussions.api";

export function ModerationScreen() {
    const [reports, setReports] = useState<DiscussionReport[]>([]);
    const [reason, setReason] = useState("");
    const [message, setMessage] = useState("");

    async function load(): Promise<void> {
        setReports(await listReports());
    }

    useEffect(() => {
        let active = true;
        void listReports()
            .then((rows) => {
                if (active) setReports(rows);
            })
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được báo cáo.");
            });
        return () => {
            active = false;
        };
    }, []);

    async function run(action: () => Promise<unknown>): Promise<void> {
        if (reason.trim().length < 5) {
            setMessage("Lý do cần ít nhất 5 ký tự.");
            return;
        }
        setMessage("");
        try {
            await action();
            await load();
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Thao tác chưa xong.");
        }
    }

    return (
        <main className="box-border flex flex-col gap-6 px-4 py-8 sm:px-8">
            <h1 className={AUTH_TITLE_CLASS}>Báo cáo đang mở</h1>
            <p className="m-0 text-sm">Ẩn bài thì người dùng không còn thấy chữ và ảnh.</p>
            <label className="flex max-w-md flex-col gap-1 text-sm">
                Lý do ghi nhật ký
                <input className={AUTH_FIELD_CLASS} value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            {message ? (
                <p role="status" className="m-0 text-sm">
                    {message}
                </p>
            ) : null}
            {reports.length === 0 ? <p className="m-0 text-sm">Không có báo cáo đang mở.</p> : null}
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
                {reports.map((report) => (
                    <li key={report.id} className="border border-current p-4 text-sm">
                        <p className="m-0">
                            {report.reporterName} · {report.topicName} ·{" "}
                            {new Date(report.createdAt).toLocaleDateString("vi-VN")}
                        </p>
                        <p className="mt-2 mb-0">{report.body}</p>
                        <p className="mt-2 mb-0">Lý do: {report.reason}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                className={AUTH_BUTTON_CLASS}
                                type="button"
                                onClick={() => void run(() => hidePost(report.postId, true, reason))}
                            >
                                Ẩn bài này
                            </button>
                            {report.topicId ? (
                                <button
                                    className="min-h-11 border border-current px-3 font-semibold"
                                    type="button"
                                    onClick={() =>
                                        void run(() => setTopicStatus(report.topicId as string, "locked", reason))
                                    }
                                >
                                    Khóa chủ đề
                                </button>
                            ) : null}
                        </div>
                    </li>
                ))}
            </ul>
        </main>
    );
}
