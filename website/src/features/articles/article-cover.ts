import { ARTICLE_TOPICS, type ArticleTopic } from "@/features/articles/articles";

/**
 * Ảnh bìa dự phòng theo chủ đề (minh họa bản đồ, public/images/articles/cover-*.svg). Bài chưa có ảnh bìa vẫn có
 * thumbnail cùng ngôn ngữ hình ảnh với sản phẩm, không dùng khối màu thay ảnh.
 */
const FALLBACK_COVERS: Record<ArticleTopic, string> = {
    "cach-doc": "/images/articles/cover-cach-doc.svg",
    "khu-vuc": "/images/articles/cover-khu-vuc.svg",
    gia: "/images/articles/cover-gia.svg",
    "du-lieu": "/images/articles/cover-du-lieu.svg",
};

const DEFAULT_COVER = FALLBACK_COVERS["khu-vuc"];

/** Đường dẫn ảnh dùng làm thumbnail: ảnh bìa nội bộ nếu có, nếu không thì ảnh dự phòng của chủ đề. */
export function articleCoverSrc(article: { coverImage: string | null; topic: string }): string {
    if (article.coverImage?.startsWith("/")) return article.coverImage;
    const topic = (ARTICLE_TOPICS as readonly string[]).includes(article.topic) ? (article.topic as ArticleTopic) : null;
    return topic ? FALLBACK_COVERS[topic] : DEFAULT_COVER;
}

/** SVG không qua bộ tối ưu ảnh của Next (không bật dangerouslyAllowSVG). */
export function isVectorCover(src: string): boolean {
    return src.endsWith(".svg");
}
