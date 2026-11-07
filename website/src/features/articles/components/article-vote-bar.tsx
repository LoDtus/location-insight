"use client";

import { MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { useArticleEngagement } from "@/features/articles/components/article-engagement-provider";
import { useLocale } from "@/shared/hooks/useLocale";

/** Hàng tương tác của bài: thích, không thích, số bình luận. Khách xem được số, đăng nhập mới bình chọn. */
export default function ArticleVoteBar({ compact = false }: { compact?: boolean }): JSX.Element {
    const { stats, myVote, signedIn, voting, voteError, vote } = useArticleEngagement();
    const { locale } = useLocale();
    const vi = locale === "vi";
    const base = `inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${compact ? "" : "px-4"}`;
    const tone = (active: boolean): string => (active ? "border-green bg-green/10 text-green" : "border-charcoal/25 bg-white text-charcoal");
    /** Đã bình chọn: icon đặc; thích nền đỏ, không thích nền xám đậm, chữ và icon trắng. */
    const voteTone = (kind: 1 | -1): string =>
        myVote !== kind
            ? "border-charcoal/25 bg-white text-charcoal hover:border-charcoal/45"
            : kind === 1
              ? "border-red-600 bg-red-600 text-white"
              : "border-charcoal bg-charcoal text-white";
    const loginHint = vi ? "Đăng nhập để bình chọn" : "Sign in to vote";
    return (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={vi ? "Tương tác với bài viết" : "Article reactions"}>
            <button
                type="button"
                aria-pressed={myVote === 1}
                disabled={voting || !signedIn}
                title={signedIn ? undefined : loginHint}
                onClick={() => vote(1)}
                className={`${base} ${voteTone(1)} disabled:cursor-default`}
            >
                <ThumbsUp size={16} aria-hidden fill={myVote === 1 ? "currentColor" : "none"} />
                <span className="sr-only">{vi ? "Thích" : "Upvote"}</span>
                {stats.upvotes}
            </button>
            <button
                type="button"
                aria-pressed={myVote === -1}
                disabled={voting || !signedIn}
                title={signedIn ? undefined : loginHint}
                onClick={() => vote(-1)}
                className={`${base} ${voteTone(-1)} disabled:cursor-default`}
            >
                <ThumbsDown size={16} aria-hidden fill={myVote === -1 ? "currentColor" : "none"} />
                <span className="sr-only">{vi ? "Không thích" : "Downvote"}</span>
                {stats.downvotes}
            </button>
            <a href="#binh-luan" className={`${base} ${tone(false)} no-underline`}>
                <MessageSquare size={16} aria-hidden />
                <span className="sr-only">{vi ? "Bình luận" : "Comments"}</span>
                {stats.comments}
            </a>
            {!signedIn ? (
                <Link href="/auth/login" className="text-sm text-charcoal/70 underline underline-offset-4">
                    {loginHint}
                </Link>
            ) : null}
            {voteError ? (
                <p role="alert" className="m-0 text-sm text-red-700">
                    {voteError}
                </p>
            ) : null}
        </div>
    );
}
