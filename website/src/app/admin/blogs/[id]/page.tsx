"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthApiError } from "@/features/auth/auth.api";
import ArticleEditor from "@/features/articles/components/article-editor";
import { getAdminArticle, type AdminArticle } from "@/features/articles/articles.api";

export default function Page() {
    const params = useParams<{ id: string }>();
    const [article, setArticle] = useState<AdminArticle | null>(null);
    const [message, setMessage] = useState("");

    useEffect(() => {
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
    }, [params.id]);

    if (message) {
        return <p className="px-4 py-8 text-sm">{message}</p>;
    }
    if (!article) {
        return <p className="px-4 py-8 text-sm">Đang mở bài.</p>;
    }
    return <ArticleEditor article={article} />;
}
