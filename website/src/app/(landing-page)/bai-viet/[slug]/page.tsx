import type { Metadata } from "next";

import { ARTICLE_TOPICS } from "@/features/articles/articles";
import ArticleView, { type ArticleViewText } from "@/features/articles/components/article-view";
import UnpublishedArticle from "@/features/articles/components/unpublished-article";
import { loadPublishedArticle, loadRelatedArticles } from "@/features/articles/server/load-articles";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import ENV from "@/shared/constants/env.constant";
import { getLocale } from "@/shared/services/locale.service";
import { getLocaleValue } from "@/shared/utils/locale.utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const article = await loadPublishedArticle(slug);
    // Bài chưa công khai không được lập chỉ mục.
    if (!article) return { title: "Bài viết", robots: { index: false, follow: false } };

    const title = article.seoTitle || article.title;
    const description = article.seoDescription || article.lede;
    return {
        title,
        description,
        alternates: { canonical: `${ENV.WEBSITE_URL}/bai-viet/${article.slug}` },
        openGraph: {
            type: "article",
            title,
            description,
            publishedTime: article.publishedAt ?? undefined,
            modifiedTime: article.updatedAt,
            authors: [article.author.name],
            images: article.coverImage?.startsWith("/") ? [`${ENV.WEBSITE_URL}${article.coverImage}`] : undefined,
        },
    };
}

/** Ngày đăng kiểu báo: "Thứ hai, 12/10/2026, 08:00 (GMT+7)" theo giờ Việt Nam. */
function formatPublished(iso: string, locale: string): string {
    const parts = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", {
        weekday: "long",
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: "Asia/Ho_Chi_Minh",
    }).formatToParts(new Date(iso));
    const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? "";
    const weekday = part("weekday");
    const day = `${weekday.charAt(0).toLocaleUpperCase(locale)}${weekday.slice(1).toLocaleLowerCase(locale)}`;
    return `${day}, ${part("day")}/${part("month")}/${part("year")}, ${part("hour")}:${part("minute")} (GMT+7)`;
}

/** JSON-LD an toàn khi nhúng vào thẻ script: `<` được thoát nên chuỗi không đóng được thẻ. */
function jsonLd(value: unknown): string {
    return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const [article, messages, locale] = await Promise.all([loadPublishedArticle(slug), getLandingMessages(), getLocale()]);
    const vi = locale !== "en";
    const t = (viText: string, enText: string): string => (vi ? viText : enText);
    const topics = Object.fromEntries(ARTICLE_TOPICS.map((topic) => [topic, getLocaleValue(messages, ["articles", "topics", topic])]));
    const baseText: ArticleViewText = {
        back: getLocaleValue(messages, ["articles", "title"]),
        backTo: t("Trở lại danh sách bài", "Back to articles"),
        topic: "",
        toc: t("Trong bài này", "On this page"),
        related: t("Bài viết liên quan", "Related articles"),
        byline: t("Tác giả", "Author"),
        published: "",
        preview: t("Bản xem trước, chưa công khai", "Preview, not public"),
    };

    if (!article) {
        return (
            <UnpublishedArticle
                slug={slug}
                topics={topics}
                locale={locale}
                text={baseText}
                missing={{
                    title: t("Không có bài này", "Article not found"),
                    body: t("Bài viết không tồn tại hoặc chưa được đăng.", "This article does not exist or is not published yet."),
                    back: t("Về danh sách bài viết", "Back to articles"),
                }}
            />
        );
    }

    const related = await loadRelatedArticles(slug);
    const published = article.publishedAt ? formatPublished(article.publishedAt, locale) : "";
    const topic = topics[article.topic] ?? article.topic;

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: jsonLd({
                        "@context": "https://schema.org",
                        "@type": "Article",
                        headline: article.title,
                        description: article.seoDescription || article.lede,
                        datePublished: article.publishedAt,
                        dateModified: article.updatedAt,
                        author: { "@type": "Organization", name: article.author.name },
                        mainEntityOfPage: `${ENV.WEBSITE_URL}/bai-viet/${article.slug}`,
                        image: article.coverImage?.startsWith("/") ? `${ENV.WEBSITE_URL}${article.coverImage}` : undefined,
                    }),
                }}
            />
            <ArticleView
                article={article}
                related={related}
                topics={topics}
                locale={locale}
                text={{ ...baseText, topic, backTo: t(`Trở lại ${topic}`, `Back to ${topic}`), published }}
            />
        </>
    );
}
