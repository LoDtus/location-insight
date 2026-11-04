"use client";

import Link from "next/link";
import { useEffect, useState, type JSX } from "react";

import ArticleView, { type ArticleViewText } from "@/features/articles/components/article-view";
import { getAdminArticleBySlug, type AdminArticle } from "@/features/articles/articles.api";
import { useAuth } from "@/features/auth/use-auth";

/**
 * Bài chưa công khai (nháp, hẹn giờ, ẩn): chỉ admin xem được. Khách và người dùng thường chỉ thấy thông báo
 * không có bài; dữ liệu bài không bao giờ rời backend nếu không qua cổng quản trị.
 */
export default function UnpublishedArticle({
    slug,
    topics,
    locale,
    text,
    missing,
}: {
    slug: string;
    topics: Record<string, string>;
    locale: string;
    text: ArticleViewText;
    missing: { title: string; body: string; back: string };
}): JSX.Element {
    const auth = useAuth();
    const isAdmin = auth.status === "authenticated" && auth.user?.role === "admin";
    const [article, setArticle] = useState<AdminArticle | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!isAdmin) return;
        let active = true;
        void getAdminArticleBySlug(slug)
            .then((next) => {
                if (active) setArticle(next);
            })
            .catch(() => {
                if (active) setFailed(true);
            });
        return () => {
            active = false;
        };
    }, [isAdmin, slug]);

    if (isAdmin && article && !article.deletedAt) {
        return (
            <ArticleView
                preview
                locale={locale}
                topics={topics}
                text={{ ...text, topic: topics[article.topic] ?? article.topic }}
                related={[]}
                article={{
                    slug: article.slug,
                    title: article.title,
                    lede: article.lede,
                    topic: article.topic,
                    publishedAt: article.publishedAt,
                    coverImage: article.coverImage,
                    seoTitle: article.seoTitle,
                    seoDescription: article.seoDescription,
                    body: article.body,
                    author: { name: "Địa Thế", username: null, avatarUrl: null },
                    stats: { upvotes: 0, downvotes: 0, comments: 0 },
                }}
            />
        );
    }

    const waiting = auth.status === "unknown" || (isAdmin && !article && !failed);
    return (
        <div className="mx-auto box-border w-full max-w-3xl px-4 py-16 sm:px-8">
            {waiting ? (
                <p role="status" className="m-0 text-base">
                    …
                </p>
            ) : (
                <>
                    <h1 className="m-0 text-3xl font-semibold">{missing.title}</h1>
                    <p className="mt-3 mb-0 text-base text-charcoal/80">{missing.body}</p>
                    <p className="mt-6 mb-0">
                        <Link href="/bai-viet" className="underline underline-offset-4">
                            {missing.back}
                        </Link>
                    </p>
                </>
            )}
        </div>
    );
}
