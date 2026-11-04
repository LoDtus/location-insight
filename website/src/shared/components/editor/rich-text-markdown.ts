import { MarkdownManager } from "@tiptap/markdown";

import { buildRichTextExtensions } from "@/shared/components/editor/rich-text-extensions";
import type { RichTextDoc, RichTextNode } from "@/shared/components/editor/rich-text.types";

export type RichTextHeading = { id: string; level: 2 | 3; text: string };

let manager: MarkdownManager | null = null;

function markdownManager(): MarkdownManager {
    manager ??= new MarkdownManager({ extensions: buildRichTextExtensions({ markdown: true }) });
    return manager;
}

function foldId(text: string): string {
    return text
        .replace(/đ/gi, "d")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
}

function textOf(node: RichTextNode): string {
    if (typeof node.text === "string") return node.text;
    return (node.content ?? []).map(textOf).join("");
}

/**
 * Gắn `id` cho từng tiêu đề (h2, h3) và trả mục lục. Id suy từ chữ nên ổn định giữa các lần dựng,
 * trùng nhau thì thêm hậu tố số.
 */
export function withHeadingIds(doc: RichTextDoc): { doc: RichTextDoc; headings: RichTextHeading[] } {
    const used = new Map<string, number>();
    const headings: RichTextHeading[] = [];
    const content = (doc.content ?? []).map((node): RichTextNode => {
        if (node.type !== "heading") return node;
        const level = node.attrs?.level === 3 ? 3 : 2;
        const text = textOf(node).trim();
        const base = foldId(text) || "muc";
        const count = used.get(base) ?? 0;
        used.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count + 1}`;
        headings.push({ id, level, text });
        return { ...node, attrs: { ...node.attrs, id } };
    });
    return { doc: { ...doc, content }, headings };
}

/** Markdown → tài liệu Tiptap (dùng chung bộ extension với trình soạn nên dựng lại đúng như lúc soạn). */
export function markdownToDoc(source: string): RichTextDoc {
    const parsed = markdownManager().parse(source) as RichTextDoc;
    return { type: "doc", content: parsed.content ?? [] };
}
