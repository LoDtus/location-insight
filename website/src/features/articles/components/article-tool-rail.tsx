"use client";

import { ArrowUp, Link2, MessageSquare, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import type { JSX, ReactNode } from "react";

import { useArticleEngagement } from "@/features/articles/components/article-engagement-provider";
import { showToast } from "@/shared/components/toast/toast-store";
import { useLocale } from "@/shared/hooks/useLocale";

const ICON_BUTTON =
    "inline-flex size-10 items-center justify-center rounded-full text-charcoal/70 hover:bg-charcoal/[0.06] hover:text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:cursor-default disabled:hover:bg-transparent";

function pageUrl(): string {
    // Bỏ phần #… để liên kết luôn mở đầu bài.
    return window.location.href.split("#")[0] ?? window.location.href;
}

async function copyLink(vi: boolean): Promise<void> {
    try {
        await navigator.clipboard.writeText(pageUrl());
        showToast({ title: vi ? "Đã sao chép liên kết" : "Link copied", tone: "success" });
    } catch {
        showToast({ title: vi ? "Không sao chép được liên kết" : "Could not copy the link", tone: "error" });
    }
}

async function share(title: string, vi: boolean): Promise<void> {
    if (typeof navigator.share !== "function") {
        await copyLink(vi);
        return;
    }
    try {
        await navigator.share({ title, url: pageUrl() });
    } catch {
        // Người dùng đóng hộp chia sẻ: không cần báo.
    }
}

function RailItem({ label, children, count }: { label: string; children: ReactNode; count?: number }): JSX.Element {
    return (
        <li className="flex flex-col items-center">
            {children}
            {count === undefined ? null : (
                <span aria-hidden className="-mt-0.5 font-sans text-xs text-charcoal/60 tabular-nums">
                    {count}
                </span>
            )}
            <span className="sr-only">{label}</span>
        </li>
    );
}

/**
 * Thanh công cụ dọc dán bên trái bài (kiểu Thanh Niên): thích/không thích, tới bình luận, sao chép liên kết, chia sẻ, lên đầu trang.
 * `preview` (bản nháp của admin) chỉ giữ sao chép liên kết và lên đầu trang.
 */
export default function ArticleToolRail({ title, preview = false }: { title: string; preview?: boolean }): JSX.Element {
    const { locale } = useLocale();
    const vi = locale === "vi";
    return (
        <ul
            aria-label={vi ? "Công cụ bài viết" : "Article tools"}
            className="m-0 flex list-none flex-col items-center gap-1 rounded-full border border-charcoal/15 bg-white px-1 py-2"
        >
            {preview ? null : <RailVotes vi={vi} />}
            <RailItem label={vi ? "Sao chép liên kết" : "Copy link"}>
                <button type="button" title={vi ? "Sao chép liên kết" : "Copy link"} onClick={() => void copyLink(vi)} className={ICON_BUTTON}>
                    <Link2 size={18} aria-hidden />
                </button>
            </RailItem>
            {preview ? null : (
                <RailItem label={vi ? "Chia sẻ" : "Share"}>
                    <button type="button" title={vi ? "Chia sẻ" : "Share"} onClick={() => void share(title, vi)} className={ICON_BUTTON}>
                        <Share2 size={18} aria-hidden />
                    </button>
                </RailItem>
            )}
            <RailItem label={vi ? "Lên đầu trang" : "Back to top"}>
                <button
                    type="button"
                    title={vi ? "Lên đầu trang" : "Back to top"}
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className={ICON_BUTTON}
                >
                    <ArrowUp size={18} aria-hidden />
                </button>
            </RailItem>
        </ul>
    );
}

function RailVotes({ vi }: { vi: boolean }): JSX.Element {
    const { stats, myVote, signedIn, voting, vote } = useArticleEngagement();
    const hint = vi ? "Đăng nhập để bình chọn" : "Sign in to vote";
    const tone = (active: boolean): string => (active ? "bg-green/10 text-green" : "");
    return (
        <>
            <RailItem label={`${vi ? "Thích" : "Upvote"}: ${stats.upvotes}`} count={stats.upvotes}>
                <button
                    type="button"
                    aria-pressed={myVote === 1}
                    disabled={voting || !signedIn}
                    title={signedIn ? (vi ? "Thích" : "Upvote") : hint}
                    onClick={() => vote(1)}
                    className={`${ICON_BUTTON} ${tone(myVote === 1)}`}
                >
                    <ThumbsUp size={18} aria-hidden />
                </button>
            </RailItem>
            <RailItem label={`${vi ? "Không thích" : "Downvote"}: ${stats.downvotes}`} count={stats.downvotes}>
                <button
                    type="button"
                    aria-pressed={myVote === -1}
                    disabled={voting || !signedIn}
                    title={signedIn ? (vi ? "Không thích" : "Downvote") : hint}
                    onClick={() => vote(-1)}
                    className={`${ICON_BUTTON} ${tone(myVote === -1)}`}
                >
                    <ThumbsDown size={18} aria-hidden />
                </button>
            </RailItem>
            <RailItem label={`${vi ? "Bình luận" : "Comments"}: ${stats.comments}`} count={stats.comments}>
                <a href="#binh-luan" title={vi ? "Bình luận" : "Comments"} className={`${ICON_BUTTON} no-underline`}>
                    <MessageSquare size={18} aria-hidden />
                </a>
            </RailItem>
            <li aria-hidden className="my-1 h-px w-6 bg-charcoal/15" />
        </>
    );
}

/** Nút sao chép liên kết + chia sẻ nằm ngang, dùng ở hàng cuối bài (kiểu VnExpress). */
export function ArticleShareButtons({ title }: { title: string }): JSX.Element {
    const { locale } = useLocale();
    const vi = locale === "vi";
    const ring = `${ICON_BUTTON} border border-charcoal/20`;
    return (
        <div className="flex items-center gap-2">
            <button type="button" title={vi ? "Chia sẻ" : "Share"} aria-label={vi ? "Chia sẻ" : "Share"} onClick={() => void share(title, vi)} className={ring}>
                <Share2 size={17} aria-hidden />
            </button>
            <button
                type="button"
                title={vi ? "Sao chép liên kết" : "Copy link"}
                aria-label={vi ? "Sao chép liên kết" : "Copy link"}
                onClick={() => void copyLink(vi)}
                className={ring}
            >
                <Link2 size={17} aria-hidden />
            </button>
        </div>
    );
}
