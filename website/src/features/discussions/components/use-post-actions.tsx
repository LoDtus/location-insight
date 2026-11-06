"use client";

import { useEffect, useState, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import { bookmarkPost, reportPost, unbookmarkPost, type DiscussionPost } from "@/features/discussions/discussions.api";
import { clearLegacySavedPosts, readSavedPosts } from "@/features/discussions/components/post-card";
import { ReportPostDialog } from "@/features/discussions/components/report-post-dialog";
import { blockUser } from "@/features/messaging/messaging.api";
import { showToast } from "@/shared/components/toast/toast-store";
import { getConfirmModal } from "@/shared/utils/confirm.utils";

function errorText(error: unknown, fallback: string): string {
    return error instanceof AuthApiError && error.message ? error.message : fallback;
}

/**
 * Thao tác dùng chung của một bài (feed và trang chi tiết): lưu/bỏ lưu (server, có thông báo góc trên), sao chép
 * liên kết, báo cáo, chặn tác giả. Màn hình tự cập nhật danh sách qua `onSaved`/`onBlocked`.
 */
export function usePostActions({
    root,
    onSaved,
    onBlocked,
}: {
    root: ShellRoot;
    onSaved: (postId: string, saved: boolean) => void;
    onBlocked: (authorId: string) => void;
}): {
    toggleSave: (post: DiscussionPost) => void;
    copyLink: (post: DiscussionPost) => void;
    report: (post: DiscussionPost) => void;
    block: (post: DiscussionPost) => void;
    dialog: JSX.Element | null;
} {
    const [reporting, setReporting] = useState<DiscussionPost | null>(null);

    // Một lần: chuyển danh sách đã lưu cũ (chỉ ở trình duyệt) lên server rồi xóa.
    useEffect(() => {
        const legacy = readSavedPosts();
        if (legacy.length === 0) return;
        void Promise.allSettled(legacy.slice(0, 200).map((id) => bookmarkPost(id))).then((results) => {
            clearLegacySavedPosts();
            results.forEach((result, index) => {
                if (result.status === "fulfilled") onSaved(legacy[index], true);
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy một lần khi vào trang
    }, []);

    function toggleSave(post: DiscussionPost): void {
        const next = !post.savedByMe;
        onSaved(post.id, next);
        void (next ? bookmarkPost(post.id) : unbookmarkPost(post.id))
            .then(() =>
                showToast(
                    next
                        ? { title: "Đã lưu bài viết", description: "Xem lại ở mục “Đã lưu” trên diễn đàn, trên mọi thiết bị." }
                        : { title: "Đã bỏ lưu bài viết", tone: "info" },
                ),
            )
            .catch((error: unknown) => {
                onSaved(post.id, !next);
                showToast({ title: next ? "Chưa lưu được bài" : "Chưa bỏ lưu được", description: errorText(error, "Vui lòng thử lại."), tone: "error" });
            });
    }

    function copyLink(post: DiscussionPost): void {
        const link = `${window.location.origin}${root}/feed/${post.id}`;
        void navigator.clipboard
            .writeText(link)
            .then(() => showToast({ title: "Đã sao chép liên kết", description: link }))
            .catch(() => showToast({ title: "Không sao chép được", description: "Hãy cấp quyền clipboard cho trang này.", tone: "error" }));
    }

    function block(post: DiscussionPost): void {
        const who = post.authorUsername ? `@${post.authorUsername}` : post.authorName;
        void getConfirmModal({
            title: `Chặn ${who}?`,
            content: `Bạn sẽ không thấy bài và trả lời của ${who} trên diễn đàn, họ cũng không thấy bài của bạn và không nhắn tin được cho bạn. Bỏ chặn trong Tin nhắn › Cài đặt.`,
            okText: "Chặn",
            cancelText: "Hủy",
        }).then((accepted) => {
            if (!accepted) return;
            void blockUser(post.authorId)
                .then(() => {
                    onBlocked(post.authorId);
                    showToast({ title: `Đã chặn ${who}`, description: "Bài của họ không còn hiện với bạn." });
                })
                .catch((error: unknown) => showToast({ title: "Chưa chặn được", description: errorText(error, "Vui lòng thử lại."), tone: "error" }));
        });
    }

    const dialog = reporting ? (
        <ReportPostDialog
            authorName={reporting.authorName}
            onClose={() => setReporting(null)}
            onSubmit={async (input) => {
                try {
                    await reportPost(reporting.id, { reason: input.reason, note: input.note || undefined });
                    setReporting(null);
                    showToast({ title: "Đã gửi báo cáo", description: "Cảm ơn bạn. Đội kiểm duyệt sẽ xem xét bài này." });
                    return null;
                } catch (error) {
                    return errorText(error, "Chưa gửi được báo cáo, vui lòng thử lại.");
                }
            }}
        />
    ) : null;

    return { toggleSave, copyLink, report: setReporting, block, dialog };
}
