import type { RichTextDoc, RichTextNode } from "@/shared/components/editor/rich-text.types";

export const EMPTY_RICH_TEXT: RichTextDoc = { type: "doc", content: [{ type: "paragraph" }] };

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Chỉ cho phép http, https, mailto, tel. Chặn javascript:, data: và các giao thức khác
 * vì liên kết do người dùng nhập là đầu vào không tin cậy.
 */
export function normalizeLinkUrl(raw: string): string | null {
    const value = raw.trim();
    if (!value || /\s/.test(value)) return null;
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
    try {
        const url = new URL(candidate);
        if (!SAFE_LINK_PROTOCOLS.has(url.protocol)) return null;
        if ((url.protocol === "http:" || url.protocol === "https:") && !url.hostname.includes(".")) return null;
        return url.toString();
    } catch {
        return null;
    }
}

function collectText(node: RichTextNode, parts: string[]): void {
    if (typeof node.text === "string") parts.push(node.text);
    node.content?.forEach((child) => collectText(child, parts));
}

export function richTextToPlain(doc: RichTextDoc | null | undefined): string {
    if (!doc) return "";
    const parts: string[] = [];
    doc.content?.forEach((block) => {
        const blockParts: string[] = [];
        collectText(block, blockParts);
        parts.push(blockParts.join(""));
    });
    return parts.join("\n").trim();
}

export function isRichTextEmpty(doc: RichTextDoc | null | undefined): boolean {
    return richTextToPlain(doc).length === 0;
}

/** Kiểm tra dữ liệu đọc từ nơi lưu (localStorage, API) có đúng hình dạng tài liệu không. */
export function isRichTextDoc(value: unknown): value is RichTextDoc {
    if (!value || typeof value !== "object") return false;
    const node = value as Partial<RichTextDoc>;
    return node.type === "doc" && (node.content === undefined || Array.isArray(node.content));
}
