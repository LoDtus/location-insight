import type { RichTextDoc, RichTextNode } from "@/shared/components/editor/rich-text.types";

/**
 * Chuyển hai chiều giữa tài liệu Tiptap của ô soạn bài và markup nhẹ được lưu (xem post-markup.tsx):
 * đoạn → một dòng; xuống dòng mềm → "\n"; trích dẫn → các dòng "> "; đậm **, nghiêng *, gạch chân ++, gạch ngang ~~,
 * liên kết [chữ](url). Nhờ vậy người soạn thấy định dạng thật mà dữ liệu, backend và phần hiển thị không đổi.
 */

type MarkName = "link" | "bold" | "italic" | "underline" | "strike";
type Mark = { type: MarkName; href?: string };

/** Thứ tự lồng cố định: liên kết ngoài cùng. */
const ORDER: readonly MarkName[] = ["link", "bold", "italic", "underline", "strike"];
const OPEN: Record<Exclude<MarkName, "link">, string> = { bold: "**", italic: "*", underline: "++", strike: "~~" };

function marksOf(node: RichTextNode): Mark[] {
    const out: Mark[] = [];
    for (const name of ORDER) {
        const mark = node.marks?.find((item) => item.type === name);
        if (!mark) continue;
        const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : undefined;
        if (name === "link" && !href) continue;
        out.push(name === "link" ? { type: name, href } : { type: name });
    }
    return out;
}

function sameMark(a: Mark | undefined, b: Mark | undefined): boolean {
    return Boolean(a && b && a.type === b.type && a.href === b.href);
}

function openMark(mark: Mark): string {
    return mark.type === "link" ? "[" : OPEN[mark.type];
}

function closeMark(mark: Mark): string {
    return mark.type === "link" ? `](${mark.href ?? ""})` : OPEN[mark.type];
}

/** Nội dung một đoạn (text + hardBreak) ra markup, mở/đóng dấu theo ngăn xếp để lồng đúng. */
function inlineToMarkup(nodes: readonly RichTextNode[] | undefined): string {
    let out = "";
    let stack: Mark[] = [];
    const closeFrom = (index: number): void => {
        for (let at = stack.length - 1; at >= index; at -= 1) out += closeMark(stack[at]);
        stack = stack.slice(0, index);
    };
    for (const node of nodes ?? []) {
        if (node.type === "hardBreak") {
            closeFrom(0);
            out += "\n";
            continue;
        }
        if (node.type !== "text" || !node.text) continue;
        // Liên kết không chứa "]" trong chữ (sẽ cắt ngang cú pháp).
        const wanted = marksOf(node);
        const text = wanted.some((mark) => mark.type === "link") ? node.text.replace(/[[\]]/g, "") : node.text;
        const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
        const lead = match?.[1] ?? "";
        const core = match?.[2] ?? "";
        const trail = match?.[3] ?? "";
        if (!core) {
            // Chỉ có khoảng trắng: ở trong dấu nếu cùng định dạng với chữ trước, không thì đóng dấu trước rồi mới viết.
            const same = wanted.length === stack.length && wanted.every((mark, index) => sameMark(mark, stack[index]));
            if (!same) closeFrom(0);
            out += text;
            continue;
        }
        let common = 0;
        while (common < stack.length && common < wanted.length && sameMark(stack[common], wanted[common])) common += 1;
        closeFrom(common);
        // Khoảng trắng nằm ngoài dấu: "** a**" không hợp lệ.
        if (lead) {
            closeFrom(0);
            common = 0;
        }
        out += lead;
        for (const mark of wanted.slice(common)) out += openMark(mark);
        stack = wanted;
        out += core;
        if (trail) {
            closeFrom(0);
            out += trail;
        }
    }
    closeFrom(0);
    return out;
}

function blockLines(node: RichTextNode): string[] {
    if (node.type === "paragraph") return inlineToMarkup(node.content).split("\n");
    if (node.type === "blockquote") return (node.content ?? []).flatMap(blockLines).map((line) => `> ${line}`);
    return inlineToMarkup(node.content).split("\n");
}

/** Tài liệu Tiptap → markup lưu. Bỏ dòng trống ở đầu và cuối. */
export function docToMarkup(doc: RichTextDoc | RichTextNode): string {
    return (doc.content ?? [])
        .flatMap(blockLines)
        .join("\n")
        .replace(/^\n+|\n+$/g, "");
}

/* ---------------- markup → tài liệu (khôi phục bản nháp) ---------------- */

const TOKEN =
    /\[([^\]\n]{1,200})\]\(((?:https?:\/\/|\/(?!\/))[^\s)]{1,500})\)|(\*\*|\+\+|~~)(?=\S)([\s\S]+?)(?<=\S)\3|\*(?=\S)([^*\n]+?)(?<=\S)\*/g;

function withMark(nodes: RichTextNode[], mark: { type: string; attrs?: Record<string, unknown> }): RichTextNode[] {
    return nodes.map((node) => (node.type === "text" ? { ...node, marks: [...(node.marks ?? []), mark] } : node));
}

function inlineFromMarkup(text: string, depth = 0): RichTextNode[] {
    if (!text) return [];
    if (depth > 3) return [{ type: "text", text }];
    const out: RichTextNode[] = [];
    let last = 0;
    for (const match of text.matchAll(TOKEN)) {
        const start = match.index ?? 0;
        if (start > last) out.push({ type: "text", text: text.slice(last, start) });
        const [whole, linkText, href, marker, marked, italic] = match;
        if (linkText !== undefined && href !== undefined) {
            out.push(...withMark(inlineFromMarkup(linkText, depth + 1), { type: "link", attrs: { href } }));
        } else if (marker !== undefined && marked !== undefined) {
            const type = marker === "**" ? "bold" : marker === "++" ? "underline" : "strike";
            out.push(...withMark(inlineFromMarkup(marked, depth + 1), { type }));
        } else if (italic !== undefined) {
            out.push(...withMark(inlineFromMarkup(italic, depth + 1), { type: "italic" }));
        } else {
            out.push({ type: "text", text: whole });
        }
        last = start + whole.length;
    }
    if (last < text.length) out.push({ type: "text", text: text.slice(last) });
    return out;
}

function paragraph(line: string): RichTextNode {
    const content = inlineFromMarkup(line);
    return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

/** Markup lưu → tài liệu Tiptap (mỗi dòng một đoạn; các dòng "> " liền nhau thành một khối trích dẫn). */
export function markupToDoc(markup: string): RichTextDoc {
    const blocks: RichTextNode[] = [];
    let quote: RichTextNode | null = null;
    for (const line of markup.split("\n")) {
        if (line.startsWith("> ")) {
            if (!quote) {
                quote = { type: "blockquote", content: [] };
                blocks.push(quote);
            }
            quote.content?.push(paragraph(line.slice(2)));
        } else {
            quote = null;
            blocks.push(paragraph(line));
        }
    }
    return { type: "doc", content: blocks.length > 0 ? blocks : [{ type: "paragraph" }] };
}
