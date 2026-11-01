"use client";

import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthApiError } from "@/features/auth/auth.api";
import ArticleEditor from "@/features/articles/components/article-editor";
import { getAdminArticle, type AdminArticle } from "@/features/articles/articles.api";

export default function Page() {
    const params = useParams<{ id: string }>();
    const [article, setArticle] = useState<AdminArticle | null>(null);
    const [message, setMessage] = useState("");
    const validId =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            params.id,
        );

    useEffect(() => {
        if (!validId) return;
        let active = true;
        void getAdminArticle(params.id)
            .then((next) => {
                if (active) setArticle(next);
            })
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Không có bài này.");
            });
        return () => {
            active = false;
        };
    }, [params.id, validId]);

    if (!validId) notFound();

    if (message) {
        return <p className="px-4 py-8 text-sm">{message}</p>;
    }
    if (!article) {
        return <p className="px-4 py-8 text-sm">Đang mở bài.</p>;
    }
    return <ArticleEditor article={article} />;
}
