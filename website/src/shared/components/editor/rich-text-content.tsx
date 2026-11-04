import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import type { JSX } from "react";

import { buildRichTextExtensions } from "@/shared/components/editor/rich-text-extensions";
import { RICH_TEXT_ARTICLE_CLASS, RICH_TEXT_CLASS } from "@/shared/components/editor/rich-text.style";
import type { RichTextDoc } from "@/shared/components/editor/rich-text.types";

const EXTENSIONS = buildRichTextExtensions();

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
    const base = variant === "article" ? RICH_TEXT_ARTICLE_CLASS : RICH_TEXT_CLASS;
    return <div className={`${base} ${className}`.trim()}>{renderToReactElement({ content: doc, extensions: EXTENSIONS })}</div>;
}
