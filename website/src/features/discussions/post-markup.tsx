import Link from "next/link";
import type { JSX, ReactNode } from "react";

/**
 * Markup nhẹ của bài đăng (lưu dạng chữ, không HTML; hiển thị bằng React nên không có XSS):
 *   **đậm**  *nghiêng*  ++gạch chân++  ~~gạch ngang~~  dòng bắt đầu "> " là trích dẫn
 *   [chữ](https://…) hoặc [chữ](/map?…) là liên kết; https://… đứng riêng tự thành liên kết.
 * Đường dẫn nội bộ bắt đầu bằng "/" (không phải "//") được gắn tiền tố khu vực (/app hoặc /admin).
 */

export const FORMATS = {
    bold: "**",
    italic: "*",
    underline: "++",
    strike: "~~",
} as const;
export type FormatKind = keyof typeof FORMATS;

const MAX_DEPTH = 3;
/** Thứ tự thử: liên kết có chữ, URL trần, rồi các dấu định dạng (dấu dài trước dấu ngắn). */
const TOKEN =
    /\[([^\]\n]{1,200})\]\(((?:https?:\/\/|\/(?!\/))[^\s)]{1,500})\)|(https?:\/\/[^\s<>()]{2,500}[^\s<>().,;:!?'"])|(\*\*|\+\+|~~)(?=\S)([\s\S]+?)(?<=\S)\4|\*(?=\S)([^*\n]+?)(?<=\S)\*/g;

/** Link nội bộ: "/map?…" → "/app/map?…"; đã có /app hoặc /admin thì giữ. */
export function internalHref(path: string, root: string): string {
    return /^\/(app|admin)(\/|$)/.test(path) ? path : `${root}${path}`;
}

function shortUrl(url: string): string {
    const bare = url.replace(/^https?:\/\/(www\.)?/, "");
    return bare.length > 42 ? `${bare.slice(0, 40)}…` : bare;
}

function renderLink(key: string, href: string, label: ReactNode, root: string): ReactNode {
    if (href.startsWith("/")) {
        return (
            <Link key={key} href={internalHref(href, root)} className="font-medium text-green underline decoration-green/40 underline-offset-2 hover:decoration-green">
                {label}
            </Link>
        );
    }
    return (
        <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="font-medium text-green underline decoration-green/40 underline-offset-2 hover:decoration-green"
        >
            {label}
        </a>
    );
}

function renderInline(text: string, root: string, depth: number, prefix: string): ReactNode[] {
    if (depth > MAX_DEPTH) return [text];
    const out: ReactNode[] = [];
    let last = 0;
    let index = 0;
    for (const match of text.matchAll(TOKEN)) {
        const start = match.index ?? 0;
        if (start > last) out.push(text.slice(last, start));
        const key = `${prefix}-${index++}`;
        const [whole, linkText, linkHref, bareUrl, marker, markedText, italicText] = match;
        if (linkText !== undefined && linkHref !== undefined) {
            out.push(renderLink(key, linkHref, renderInline(linkText, root, depth + 1, key), root));
        } else if (bareUrl !== undefined) {
            out.push(renderLink(key, bareUrl, shortUrl(bareUrl), root));
        } else if (marker !== undefined && markedText !== undefined) {
            const inner = renderInline(markedText, root, depth + 1, key);
            out.push(
                marker === "**" ? (
                    <strong key={key} className="font-semibold">
                        {inner}
                    </strong>
                ) : marker === "++" ? (
                    <u key={key} className="underline-offset-2">
                        {inner}
                    </u>
                ) : (
                    <s key={key}>{inner}</s>
                ),
            );
        } else if (italicText !== undefined) {
            out.push(<em key={key}>{renderInline(italicText, root, depth + 1, key)}</em>);
        } else {
            out.push(whole);
        }
        last = start + whole.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

/** Nội dung bài: đoạn thường giữ xuống dòng, các dòng "> " liền nhau gộp thành một khối trích dẫn. */
export function PostBody({ body, root, className = "" }: { body: string; root: string; className?: string }): JSX.Element {
    const blocks: Array<{ quote: boolean; lines: string[] }> = [];
    for (const line of body.split("\n")) {
        const quote = line.startsWith("> ");
        const text = quote ? line.slice(2) : line;
        const current = blocks.at(-1);
        if (current && current.quote === quote) current.lines.push(text);
        else blocks.push({ quote, lines: [text] });
    }
    return (
        <div className={`text-[15px] leading-relaxed break-words ${className}`}>
            {blocks.map((block, index) =>
                block.quote ? (
                    <blockquote key={index} className="my-1.5 border-l-[3px] border-charcoal/20 py-0.5 pl-3 whitespace-pre-wrap text-charcoal/75">
                        {renderInline(block.lines.join("\n"), root, 0, `q${index}`)}
                    </blockquote>
                ) : (
                    <p key={index} className="m-0 whitespace-pre-wrap">
                        {renderInline(block.lines.join("\n"), root, 0, `p${index}`)}
                    </p>
                ),
            )}
        </div>
    );
}

/** Bỏ markup để xem trước (tiêu đề trích dẫn, thông báo…), khớp stripMarkup ở backend. */
export function stripMarkup(value: string): string {
    return value
        .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|\/)[^)\s]+\)/g, "$1")
        .replace(/(\*\*|\+\+|~~)(.+?)\1/g, "$2")
        .replace(/\*([^*\n]+)\*/g, "$1")
        .replace(/^> /gm, "")
        .replace(/\s+/g, " ")
        .trim();
}

/** Bọc vùng chọn bằng dấu định dạng (bấm lại khi đã bọc thì gỡ). Trả về chuỗi mới và vùng chọn mới. */
export function toggleWrap(
    value: string,
    start: number,
    end: number,
    marker: string,
    placeholder: string,
): { value: string; start: number; end: number } {
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    if (before.endsWith(marker) && after.startsWith(marker) && selected.length > 0) {
        return {
            value: before.slice(0, -marker.length) + selected + after.slice(marker.length),
            start: start - marker.length,
            end: end - marker.length,
        };
    }
    const text = selected || placeholder;
    return {
        value: `${before}${marker}${text}${marker}${after}`,
        start: start + marker.length,
        end: start + marker.length + text.length,
    };
}

/** Thêm/gỡ "> " ở đầu mọi dòng của vùng chọn. */
export function toggleQuote(value: string, start: number, end: number): { value: string; start: number; end: number } {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = value.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const lines = value.slice(lineStart, lineEnd).split("\n");
    const quoted = lines.every((line) => line.startsWith("> "));
    const next = lines.map((line) => (quoted ? line.slice(2) : `> ${line}`)).join("\n");
    // Không chọn gì: để con trỏ cuối dòng (gõ tiếp là vào trích dẫn); có chọn: chọn lại cả vùng.
    const caret = start === end;
    return {
        value: value.slice(0, lineStart) + next + value.slice(lineEnd),
        start: caret ? lineStart + next.length : lineStart,
        end: lineStart + next.length,
    };
}

/** Trích dẫn một bài khi đăng lại/trích: tên tác giả rồi nội dung (bỏ markup, tối đa 280 ký tự), mỗi dòng "> ". */
export function quoteBlock(post: { authorName: string; body: string }): string {
    return `> **${post.authorName.replace(/[*+~[\]]/g, "")}**\n> ${stripMarkup(post.body).slice(0, 280)}`;
}
