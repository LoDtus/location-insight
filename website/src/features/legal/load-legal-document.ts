import "server-only";

import LOCALE from "@/shared/constants/locale.constant";
import type { Locale } from "@/shared/types/locale.types";

import { isLegalSlug, type LegalSlug } from "@/features/legal/legal-documents";

type MarkdownModule = { default: string };
type MarkdownLoader = () => Promise<MarkdownModule>;

const DOCUMENT_LOADERS: Record<Locale, Record<LegalSlug, MarkdownLoader>> = {
    vi: {
        "dieu-khoan": () => import("@/features/legal/docs/vi/dieu-khoan.md"),
        "chinh-sach-bao-mat": () =>
            import("@/features/legal/docs/vi/chinh-sach-bao-mat.md"),
        "chinh-sach-cookie": () =>
            import("@/features/legal/docs/vi/chinh-sach-cookie.md"),
        "chinh-sach-dang-tin": () =>
            import("@/features/legal/docs/vi/chinh-sach-dang-tin.md"),
        "chinh-sach-thanh-toan": () =>
            import("@/features/legal/docs/vi/chinh-sach-thanh-toan.md"),
        "tuyen-bo-du-lieu": () =>
            import("@/features/legal/docs/vi/tuyen-bo-du-lieu.md"),
        "ban-quyen": () => import("@/features/legal/docs/vi/ban-quyen.md"),
        "thuong-mai-dien-tu": () =>
            import("@/features/legal/docs/vi/thuong-mai-dien-tu.md"),
        thue: () => import("@/features/legal/docs/vi/thue.md"),
        "ho-so-du-lieu": () => import("@/features/legal/docs/vi/ho-so-du-lieu.md"),
        "quy-trinh-van-hanh": () =>
            import("@/features/legal/docs/vi/quy-trinh-van-hanh.md"),
        "nguon-du-lieu": () => import("@/features/legal/docs/vi/nguon-du-lieu.md"),
        "thoa-thuan-api": () => import("@/features/legal/docs/vi/thoa-thuan-api.md"),
    },
    en: {
        "dieu-khoan": () => import("@/features/legal/docs/en/dieu-khoan.md"),
        "chinh-sach-bao-mat": () =>
            import("@/features/legal/docs/en/chinh-sach-bao-mat.md"),
        "chinh-sach-cookie": () =>
            import("@/features/legal/docs/en/chinh-sach-cookie.md"),
        "chinh-sach-dang-tin": () =>
            import("@/features/legal/docs/en/chinh-sach-dang-tin.md"),
        "chinh-sach-thanh-toan": () =>
            import("@/features/legal/docs/en/chinh-sach-thanh-toan.md"),
        "tuyen-bo-du-lieu": () =>
            import("@/features/legal/docs/en/tuyen-bo-du-lieu.md"),
        "ban-quyen": () => import("@/features/legal/docs/en/ban-quyen.md"),
        "thuong-mai-dien-tu": () =>
            import("@/features/legal/docs/en/thuong-mai-dien-tu.md"),
        thue: () => import("@/features/legal/docs/en/thue.md"),
        "ho-so-du-lieu": () => import("@/features/legal/docs/en/ho-so-du-lieu.md"),
        "quy-trinh-van-hanh": () =>
            import("@/features/legal/docs/en/quy-trinh-van-hanh.md"),
        "nguon-du-lieu": () => import("@/features/legal/docs/en/nguon-du-lieu.md"),
        "thoa-thuan-api": () => import("@/features/legal/docs/en/thoa-thuan-api.md"),
    },
};

async function readMarkdown(loader: MarkdownLoader): Promise<string> {
    const loaded = await loader();

    return typeof loaded.default === "string" ? loaded.default : "";
}

export async function loadLegalDocument(
    slug: string,
    locale: Locale,
): Promise<string | null> {
    if (!isLegalSlug(slug)) {
        return null;
    }

    try {
        return await readMarkdown(DOCUMENT_LOADERS[locale][slug]);
    } catch {
        if (locale === LOCALE.DEFAULT) {
            return "";
        }

        return readMarkdown(DOCUMENT_LOADERS[LOCALE.DEFAULT][slug]);
    }
}
