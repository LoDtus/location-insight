import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { JSX } from "react";

import type { PublicArticle } from "@/features/articles/articles";
import ArticleAdminBar from "@/features/articles/components/article-admin-bar";
import ArticleComments from "@/features/articles/components/article-comments";
import ArticleEngagementProvider from "@/features/articles/components/article-engagement-provider";
import ArticleRelated from "@/features/articles/components/article-related";
import ArticleToc from "@/features/articles/components/article-toc";
import ArticleToolRail, { ArticleShareButtons } from "@/features/articles/components/article-tool-rail";
import ArticleVoteBar from "@/features/articles/components/article-vote-bar";
import RichTextMarkdownContent from "@/shared/components/editor/rich-text-markdown-content";
import { markdownToDoc, withHeadingIds } from "@/shared/components/editor/rich-text-markdown";

export type ArticleViewData = PublicArticle & {
    body: string;
    author: { name: string; username: string | null; avatarUrl: string | null };
    stats: { upvotes: number; downvotes: number; comments: number };
};

export type ArticleViewText = {
    back: string;
    /** Nút cuối bài: "Trở lại <chuyên mục>". */
    backTo: string;
    topic: string;
    toc: string;
    related: string;
    byline: string;
    published: string;
    preview: string;
};

function initials(name: string): string {
    return (name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("") || "?").toLocaleUpperCase("vi");
}

/**
 * Bố cục bài viết theo báo điện tử (tham khảo VnExpress, Thanh Niên):
 * - Cột nội dung rộng 680px: hàng chuyên mục + ngày giờ, tiêu đề serif 32px, sapo 18px, tác giả, ảnh bìa,
 *   thân bài chữ không chân 18px/1.6, chữ ký tác giả căn phải, khung tin liên quan, hàng "trở lại / chia sẻ", bình luận.
 * - Bên trái (≥ lg): thanh công cụ dọc dán (thích, bình luận, sao chép liên kết, chia sẻ, lên đầu trang).
 * - Cột phải 300px (≥ xl): danh sách "Bài viết liên quan" rồi mục lục dán khi cuộn. Màn hẹp hơn: mục lục gập
 *   dưới sapo, danh sách liên quan xuống cuối trang.
 * Dùng cho cả trang công khai và bản xem trước của admin với bài chưa đăng.
 */
export default function ArticleView({
    article,
    related,
    topics,
    locale,
    text,
    preview = false,
}: {
    article: ArticleViewData;
    related: PublicArticle[];
    topics: Record<string, string>;
    locale: string;
    text: ArticleViewText;
    /** Bản xem trước của bài chưa công khai: không có tương tác, chỉ có nút quản trị. */
    preview?: boolean;
}): JSX.Element {
    const { headings } = withHeadingIds(markdownToDoc(article.body));
    // Hai bài đầu vào khung ngay sau thân bài (như VnExpress), phần còn lại ở cột phải / cuối trang.
    const inline = related.slice(0, 2);
    const rest = related.slice(2);
    const railRelated = rest.length > 0 ? rest : related;
    const topicHref = `/bai-viet?chu-de=${encodeURIComponent(article.topic)}`;
    return (
        <ArticleEngagementProvider slug={article.slug} initialStats={article.stats}>
            <div className="mx-auto box-border w-full max-w-[1180px] px-4 pt-5 pb-12 sm:px-6">
                <div className="grid items-start lg:grid-cols-[3rem_minmax(0,680px)] lg:justify-center lg:gap-x-10 xl:grid-cols-[3rem_680px_300px] xl:gap-x-[55px]">
                    <div className="sticky top-24 hidden self-start lg:block">
                        <ArticleToolRail title={article.title} preview={preview} />
                    </div>
                    <article className="min-w-0">
                        <header>
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-sans text-sm leading-4">
                                <nav aria-label="Breadcrumb">
                                    <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
                                        <li>
                                            <Link href="/bai-viet" className="text-green no-underline hover:underline">
                                                {text.back}
                                            </Link>
                                        </li>
                                        <li aria-hidden className="text-charcoal/40">
                                            ›
                                        </li>
                                        <li>
                                            <Link href={topicHref} className="text-green no-underline hover:underline">
                                                {text.topic}
                                            </Link>
                                        </li>
                                    </ol>
                                </nav>
                                {text.published ? (
                                    <time dateTime={article.publishedAt ?? undefined} className="text-charcoal/60">
                                        {text.published}
                                    </time>
                                ) : null}
                            </div>
                            {preview ? <p className="mt-3 mb-0 font-sans text-sm font-semibold text-red-700">{text.preview}</p> : null}
                            <div className="mt-3 empty:hidden">
                                <ArticleAdminBar slug={article.slug} />
                            </div>
                            <h1 className="mt-5 mb-0 font-serif text-[1.625rem] leading-[1.45] font-bold text-charcoal md:text-[2rem] md:leading-[1.5]">
                                {article.title}
                            </h1>
                            <p className="mt-4 mb-0 font-sans text-lg leading-[1.6] font-semibold text-charcoal/90">{article.lede}</p>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-charcoal/15 pb-4">
                                <p className="m-0 flex items-center gap-2.5 font-sans text-sm">
                                    <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-green/15 text-xs font-semibold text-green">
                                        {initials(article.author.name)}
                                    </span>
                                    <span>
                                        <span className="block text-xs text-charcoal/60">{text.byline}</span>
                                        <b>{article.author.name}</b>
                                    </span>
                                </p>
                                {preview ? null : (
                                    <div className="lg:hidden">
                                        <ArticleVoteBar compact />
                                    </div>
                                )}
                            </div>
                        </header>
                        <div className="mt-4 xl:hidden">
                            <ArticleToc headings={headings} title={text.toc} collapsible />
                        </div>
                        {article.coverImage?.startsWith("/") ? (
                            <figure className="m-0 mt-5">
                                <Image src={article.coverImage} alt="" width={1360} height={765} priority sizes="(min-width: 768px) 680px, 100vw" className="aspect-video w-full object-cover" />
                            </figure>
                        ) : null}
                        <div className="mt-5">
                            <RichTextMarkdownContent source={article.body} variant="article" />
                        </div>
                        <p className="mt-4 mb-0 text-right font-sans text-lg font-bold">{article.author.name}</p>
                        {inline.length > 0 ? (
                            <div className="mt-5">
                                <ArticleRelated items={inline} title={text.related} topics={topics} locale={locale} variant="box" />
                            </div>
                        ) : null}
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 font-sans">
                            <Link
                                href={topicHref}
                                className="inline-flex min-h-10 items-center gap-2 border border-charcoal/20 px-4 text-[15px] text-charcoal no-underline hover:border-charcoal/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                            >
                                <ArrowLeft size={17} aria-hidden />
                                {text.backTo}
                            </Link>
                            {preview ? null : (
                                <div className="flex flex-wrap items-center gap-2">
                                    <ArticleVoteBar compact />
                                    <ArticleShareButtons title={article.title} />
                                </div>
                            )}
                        </div>
                        {preview ? null : (
                            <div className="mt-8">
                                <ArticleComments />
                            </div>
                        )}
                    </article>
                    <div className="hidden self-stretch xl:block">
                        <ArticleRelated items={railRelated} title={text.related} topics={topics} locale={locale} />
                        <div className="sticky top-24 mt-8 max-h-[calc(100vh-7rem)] overflow-y-auto">
                            <ArticleToc headings={headings} title={text.toc} />
                        </div>
                    </div>
                </div>
                {rest.length > 0 ? (
                    <div className="mx-auto mt-12 max-w-[680px] xl:hidden">
                        <ArticleRelated items={rest} title={text.related} topics={topics} locale={locale} />
                    </div>
                ) : null}
            </div>
        </ArticleEngagementProvider>
    );
}
