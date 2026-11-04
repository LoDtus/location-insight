"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type JSX, type ReactNode } from "react";

import { getArticleMe, voteArticle, type ArticleStats, type ArticleVote } from "@/features/articles/articles.api";
import { useAuth } from "@/features/auth/use-auth";

type EngagementValue = {
    slug: string;
    stats: ArticleStats;
    myVote: ArticleVote;
    likedIds: Set<string>;
    signedIn: boolean;
    isAdmin: boolean;
    userId: string | null;
    voting: boolean;
    voteError: string;
    vote: (value: 1 | -1) => void;
    setLiked: (id: string, liked: boolean) => void;
    setCommentCount: (count: number) => void;
};

const EngagementContext = createContext<EngagementValue | null>(null);

export function useArticleEngagement(): EngagementValue {
    const value = useContext(EngagementContext);
    if (!value) throw new Error("useArticleEngagement cần ArticleEngagementProvider");
    return value;
}

/** Giữ số phiếu, phiếu của tôi và bình luận đã thích để thanh meta và khu bình luận dùng chung. */
export default function ArticleEngagementProvider({
    slug,
    initialStats,
    children,
}: {
    slug: string;
    initialStats: ArticleStats;
    children: ReactNode;
}): JSX.Element {
    const auth = useAuth();
    const signedIn = auth.status === "authenticated";
    const [stats, setStats] = useState<ArticleStats>(initialStats);
    const [myVote, setMyVote] = useState<ArticleVote>(0);
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const [voting, setVoting] = useState(false);
    const [voteError, setVoteError] = useState("");

    useEffect(() => {
        if (!signedIn) return;
        let active = true;
        void getArticleMe(slug)
            .then((me) => {
                if (!active) return;
                setMyVote(me.myVote);
                setLikedIds(new Set(me.likedCommentIds));
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [signedIn, slug]);

    const vote = useCallback(
        (value: 1 | -1): void => {
            if (!signedIn || voting) return;
            const next: ArticleVote = myVote === value ? 0 : value;
            setVoting(true);
            setVoteError("");
            voteArticle(slug, next)
                .then((result) => {
                    setMyVote(result.myVote);
                    setStats((current) => ({ ...current, upvotes: result.upvotes, downvotes: result.downvotes }));
                })
                .catch(() => setVoteError("Chưa ghi nhận được lượt bình chọn."))
                .finally(() => setVoting(false));
        },
        [signedIn, voting, myVote, slug],
    );

    const setLiked = useCallback((id: string, liked: boolean): void => {
        setLikedIds((current) => {
            const next = new Set(current);
            if (liked) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const setCommentCount = useCallback((comments: number): void => setStats((current) => ({ ...current, comments })), []);

    const value = useMemo<EngagementValue>(
        () => ({
            slug,
            stats,
            myVote,
            likedIds,
            signedIn,
            isAdmin: auth.user?.role === "admin",
            userId: auth.user?.userId ?? null,
            voting,
            voteError,
            vote,
            setLiked,
            setCommentCount,
        }),
        [slug, stats, myVote, likedIds, signedIn, auth.user, voting, voteError, vote, setLiked, setCommentCount],
    );

    return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}
