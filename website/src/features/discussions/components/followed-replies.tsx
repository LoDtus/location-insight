import Link from "next/link";
import type { JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import { relativeTime, fullTime } from "@/features/discussions/components/post-card";
import type { DiscussionPost } from "@/features/discussions/discussions.api";
import { PostBody } from "@/features/discussions/post-markup";

/**
 * Bình luận của những người mình theo dõi, hiện ngay dưới bài ở feed để khỏi mở chi tiết (kiểu "bạn bè đã bình
 * luận"). Mỗi người xem thấy khác nhau vì danh sách do backend lọc theo quan hệ theo dõi. Tối đa vài bình luận mới
 * nhất; phần còn lại xem trong chi tiết bài.
 */
export function FollowedReplies({ post, root }: { post: DiscussionPost; root: ShellRoot }): JSX.Element | null {
    const replies = post.followedReplies ?? [];
    if (replies.length === 0) return null;
    const thread = `${root}/feed/${post.id}`;
    const hidden = Math.max((post.followedReplyTotal ?? replies.length) - replies.length, 0);
    const others = Math.max(post.replyCount - (post.followedReplyTotal ?? replies.length), 0);

    return (
        <section
            aria-label="Bình luận từ người bạn theo dõi"
            className="mx-4 mb-3 ml-[68px] rounded-xl bg-charcoal/[0.04] px-3 py-2"
        >
            <p className="m-0 mb-1 text-xs font-semibold text-charcoal/55">Bình luận từ người bạn theo dõi</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {replies.map((reply) => (
                    <li key={reply.id} className="flex gap-2">
                        <MiniAvatar name={reply.authorName} url={reply.authorAvatarUrl} />
                        <div className="min-w-0 flex-1">
                            <p className="m-0 flex min-w-0 items-baseline gap-1.5 text-sm leading-5">
                                <Link
                                    href={reply.authorUsername ? `${root}/profile/@${reply.authorUsername}` : thread}
                                    className="min-w-0 truncate font-semibold text-charcoal no-underline hover:underline"
                                >
                                    {reply.authorName}
                                </Link>
                                <time
                                    dateTime={reply.createdAt}
                                    title={fullTime(reply.createdAt)}
                                    className="shrink-0 text-xs text-charcoal/45"
                                >
                                    {relativeTime(reply.createdAt)}
                                </time>
                            </p>
                            {reply.parentAuthorName && reply.parentId !== post.id ? (
                                <p className="m-0 text-xs text-charcoal/50">Trả lời {reply.parentAuthorName}</p>
                            ) : null}
                            {/* Tối đa 4 dòng; nội dung đầy đủ ở chi tiết bài. */}
                            <PostBody
                                body={reply.body}
                                root={root}
                                className="line-clamp-4 !text-sm text-charcoal/90"
                            />
                        </div>
                    </li>
                ))}
            </ul>
            {hidden > 0 || others > 0 ? (
                <Link href={thread} className="mt-2 inline-block text-xs font-semibold text-green no-underline hover:underline">
                    {hidden > 0
                        ? `Xem thêm ${hidden} bình luận từ người bạn theo dõi`
                        : `Xem tất cả ${post.replyCount} bình luận`}
                </Link>
            ) : null}
        </section>
    );
}

function MiniAvatar({ name, url }: { name: string; url: string | null }): JSX.Element {
    const letter = (name.trim().split(/\s+/).filter(Boolean).at(-1) ?? "?").slice(0, 1).toUpperCase();
    return url ? (
        // Ảnh đại diện là URL ngoài, có thể có chữ ký.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mt-0.5 size-7 shrink-0 rounded-full object-cover" />
    ) : (
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-green text-xs font-semibold text-cream">
            {letter}
        </span>
    );
}
