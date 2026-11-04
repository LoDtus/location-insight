import type { JSX } from "react";

import RichTextContent from "@/shared/components/editor/rich-text-content";
import { markdownToDoc, withHeadingIds } from "@/shared/components/editor/rich-text-markdown";

/** Hiển thị nội dung Markdown bằng đúng bộ dựng của trình soạn, tiêu đề có id cho mục lục. */
export default function RichTextMarkdownContent({ source, className = "" }: { source: string; className?: string }): JSX.Element {
    const { doc } = withHeadingIds(markdownToDoc(source));
    return <RichTextContent doc={doc} className={className} />;
}
