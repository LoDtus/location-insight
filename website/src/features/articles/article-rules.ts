import type { ArticleStatus, ArticleWrite } from "@/features/articles/articles.api";

/** Phản chiếu quy tắc của backend (`article-rules.ts`) để báo lỗi ngay khi soạn. Backend vẫn là nơi quyết định. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const TITLE_RANGE = { min: 8, max: 140 } as const;
export const LEDE_RANGE = { min: 20, max: 300 } as const;
export const BODY_MIN = 180;
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 160;
export const BODY_MAX = 20000;

export function slugifyTitle(title: string): string {
    return title
        .replace(/đ/gi, "d")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
        .replace(/-+$/g, "");
}

export function hasInternalLink(body: string): boolean {
    return /\]\((\/nha-dat|\/phap-ly|\/bai-viet\/)/.test(body);
}

export type ChecklistItem = { key: string; label: string; done: boolean; required: boolean };

/** Các điều kiện trước khi đăng, theo thứ tự trên trang. `required` là điều kiện backend chặn. */
export function articleChecklist(form: ArticleWrite): ChecklistItem[] {
    const title = form.title.trim().length;
    const lede = form.lede.trim().length;
    return [
        { key: "title", label: `Tiêu đề ${TITLE_RANGE.min}–${TITLE_RANGE.max} ký tự`, done: title >= TITLE_RANGE.min && title <= TITLE_RANGE.max, required: true },
        { key: "slug", label: "Đường dẫn (slug) hợp lệ", done: SLUG_PATTERN.test(form.slug) && form.slug.length <= 80, required: true },
        { key: "lede", label: `Đoạn dẫn ${LEDE_RANGE.min}–${LEDE_RANGE.max} ký tự`, done: lede >= LEDE_RANGE.min && lede <= LEDE_RANGE.max, required: true },
        { key: "body", label: `Nội dung từ ${BODY_MIN} ký tự`, done: form.body.trim().length >= BODY_MIN, required: true },
        { key: "link", label: "Có liên kết nội bộ (/nha-dat, /phap-ly, /bai-viet/)", done: hasInternalLink(form.body), required: true },
        { key: "cover", label: "Có ảnh bìa", done: Boolean(form.coverImage?.trim()), required: false },
        { key: "seoTitle", label: "Có tiêu đề tìm kiếm riêng", done: Boolean(form.seoTitle?.trim()), required: false },
        { key: "seoDescription", label: "Có mô tả tìm kiếm riêng", done: Boolean(form.seoDescription?.trim()), required: false },
    ];
}

/** Lỗi chặn đăng (bài nháp được lưu dù thiếu). */
export function blockingIssues(form: ArticleWrite, status: ArticleStatus = form.status): string[] {
    if (status === "draft") {
        const items = articleChecklist(form).filter((item) => ["title", "slug"].includes(item.key) && !item.done);
        return items.map((item) => item.label);
    }
    return articleChecklist(form)
        .filter((item) => item.required && !item.done)
        .map((item) => item.label);
}
