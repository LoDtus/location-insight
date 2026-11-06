import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import type { JSX, ReactNode } from "react";

import { buildRichTextExtensions } from "@/shared/components/editor/rich-text-extensions";
import { safeImageSrc } from "@/shared/components/editor/rich-text-image";
import { RICH_TEXT_ARTICLE_CLASS, RICH_TEXT_CLASS } from "@/shared/components/editor/rich-text.style";
import type { RichTextDoc } from "@/shared/components/editor/rich-text.types";

/** Trình dựng luôn biết nút ảnh (nội dung Markdown có thể chứa ảnh); chỉ kiểu "article" mới vẽ ảnh ra. */
const EXTENSIONS = buildRichTextExtensions({ images: true });

type ImageNode = { attrs: Record<string, unknown> };

/**
 * Ảnh trong bài: chỉ nguồn an toàn; chú thích lấy từ title của Markdown. `data-lightbox` để trang bài viết
 * mở trình xem ảnh khi bấm (xem ArticleImageViewer).
 */
function renderImage({ node }: { node: ImageNode }): ReactNode {
    const src = safeImageSrc(node.attrs.src);
    if (!src) return null;
    const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
    const caption = typeof node.attrs.title === "string" ? node.attrs.title.trim() : "";
    return (
        <figure className="mx-0 my-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh do tác giả chèn, có thể là URL ngoài */}
            <img src={src} alt={alt || caption} loading="lazy" decoding="async" data-lightbox="" tabIndex={0} className="m-0 h-auto w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green" />
            {caption ? <figcaption className="mt-2 text-center font-sans text-[15px] leading-[1.6] text-charcoal/70">{caption}</figcaption> : null}
        </figure>
    );
}

/**
 * Hiển thị nội dung do trình soạn tạo ra. Dựng thẳng thành phần React từ JSON,
 * không dùng dangerouslySetInnerHTML, nên không có đường chèn HTML hay script.
 */
export default function RichTextContent({
    doc,
    className = "",
    variant = "compact",
}: {
    doc: RichTextDoc;
    className?: string;
    variant?: "compact" | "article";
}): JSX.Element {
    const article = variant === "article";
    const base = article ? RICH_TEXT_ARTICLE_CLASS : RICH_TEXT_CLASS;
    return (
        <div className={`${base} ${className}`.trim()}>
            {renderToReactElement({
                content: doc,
                extensions: EXTENSIONS,
                options: { nodeMapping: { image: article ? renderImage : () => null } },
            })}
        </div>
    );
}
