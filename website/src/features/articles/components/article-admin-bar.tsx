"use client";

import { Eye, EyeOff, Pencil, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type JSX } from "react";

import {
    deleteAdminArticle,
    getAdminArticleBySlug,
    hideAdminArticle,
    publishAdminArticle,
    type AdminArticle,
} from "@/features/articles/articles.api";
import { AuthApiError } from "@/features/auth/auth.api";
import { useAuth } from "@/features/auth/use-auth";

const BUTTON =
    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-60";

/**
 * Nút quản trị ở góc trên bên phải bài. Chỉ dựng cho tài khoản admin và chỉ khi backend
 * trả được bài qua cổng quản trị; người khác không nhận phần tử nào, và các API này vẫn tự chặn ở backend.
 */
export default function ArticleAdminBar({ slug, onChange }: { slug: string; onChange?: (article: AdminArticle) => void }): JSX.Element | null {
    const auth = useAuth();
    const router = useRouter();
    const isAdmin = auth.status === "authenticated" && auth.user?.role === "admin";
    const [article, setArticle] = useState<AdminArticle | null>(null);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!isAdmin) return;
        let active = true;
        void getAdminArticleBySlug(slug)
            .then((next) => {
                if (active) setArticle(next);
            })
            .catch(() => {
                if (active) setArticle(null);
            });
        return () => {
            active = false;
        };
    }, [isAdmin, slug]);

    if (!isAdmin || !article || article.deletedAt) return null;
    const published = article.status === "published";

    async function run(action: () => Promise<AdminArticle>): Promise<void> {
        setPending(true);
        setMessage("");
        try {
            const next = await action();
            setArticle(next);
            onChange?.(next);
            router.refresh();
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa thực hiện được.");
        } finally {
            setPending(false);
        }
    }

    async function remove(): Promise<void> {
        if (!article || !window.confirm(`Xóa bài "${article.title}"? Bài sẽ vào thùng và rời khỏi trang công khai.`)) return;
        setPending(true);
        try {
            await deleteAdminArticle(article.id);
            router.push("/admin/blogs?page=1&sort=updated_desc&status=deleted");
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa xóa được bài.");
            setPending(false);
        }
    }

    return (
        <div role="toolbar" aria-label="Quản trị bài viết" className="flex flex-wrap items-center justify-end gap-2">
            <span className="inline-flex min-h-10 items-center gap-1.5 text-sm text-charcoal/70">
                {published ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
                {published ? "Đang công khai" : "Chưa công khai"}
            </span>
            {published ? (
                <button type="button" disabled={pending} onClick={() => void run(() => hideAdminArticle(article.id))} className={`${BUTTON} border-charcoal/30 bg-white`}>
                    <EyeOff size={16} aria-hidden /> Ẩn
                </button>
            ) : (
                <button type="button" disabled={pending} onClick={() => void run(() => publishAdminArticle(article.id))} className={`${BUTTON} border-green bg-green text-cream`}>
                    <Send size={16} aria-hidden /> Đăng tải
                </button>
            )}
            <Link href={`/admin/blogs/${article.id}`} className={`${BUTTON} border-charcoal/30 bg-white text-charcoal no-underline`}>
                <Pencil size={16} aria-hidden /> Chỉnh sửa
            </Link>
            <button type="button" disabled={pending} onClick={() => void remove()} className={`${BUTTON} border-red-300 bg-white text-red-700`}>
                <Trash2 size={16} aria-hidden /> Xoá
            </button>
            {message ? (
                <p role="alert" className="m-0 basis-full text-right text-sm text-red-700">
                    {message}
                </p>
            ) : null}
        </div>
    );
}
