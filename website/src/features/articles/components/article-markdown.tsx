import type { ReactNode } from "react";

type Inline =
    | { kind: "text"; value: string }
    | { kind: "strong"; value: string }
    | { kind: "link"; label: string; href: string };

function safeHref(href: string): string | null {
    if (href.startsWith("/") && !href.startsWith("//")) return href;
    try {
        const url = new URL(href);
        if (url.protocol === "https:") return url.toString();
    } catch {
        return null;
    }
    return null;
}

function parseInline(line: string): Inline[] {
    const parts: Inline[] = [];
    const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
    let cursor = 0;

    for (const match of line.matchAll(pattern)) {
        const index = match.index ?? 0;
        if (index > cursor) parts.push({ kind: "text", value: line.slice(cursor, index) });
        if (match[1]) {
            parts.push({ kind: "strong", value: match[1] });
        } else if (match[2] && match[3]) {
            const href = safeHref(match[3]);
            parts.push(href ? { kind: "link", label: match[2], href } : { kind: "text", value: match[2] });
        }
        cursor = index + match[0].length;
    }

    if (cursor < line.length) parts.push({ kind: "text", value: line.slice(cursor) });
    return parts;
}

function InlineText({ parts }: { parts: Inline[] }): ReactNode {
    return parts.map((part, index) => {
        if (part.kind === "strong") return <strong key={index}>{part.value}</strong>;
        if (part.kind === "link") {
            return (
                <a key={index} href={part.href} className="underline underline-offset-4">
                    {part.label}
                </a>
            );
        }
        return <span key={index}>{part.value}</span>;
    });
}

export default function ArticleMarkdown({ source }: { source: string }) {
    const blocks = source.trim().split(/\n{2,}/);

    return (
        <div className="flex flex-col gap-4 text-base leading-relaxed">
            {blocks.map((block, index) => {
                const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
                if (lines.length === 0) return null;
                if (lines.every((line) => line.startsWith("- "))) {
                    return (
                        <ul key={index} className="m-0 flex list-disc flex-col gap-2 pl-5">
                            {lines.map((line) => (
                                <li key={line}>
                                    <InlineText parts={parseInline(line.slice(2))} />
                                </li>
                            ))}
                        </ul>
                    );
                }
                const heading = /^(#{2,3})\s+(.+)$/.exec(lines[0]);
                if (heading && lines.length === 1) {
                    const Tag = heading[1].length === 2 ? "h2" : "h3";
                    return (
                        <Tag key={index} className="m-0 text-xl font-semibold">
                            {heading[2]}
                        </Tag>
                    );
                }
                return (
                    <p key={index} className="m-0">
                        <InlineText parts={parseInline(lines.join(" "))} />
                    </p>
                );
            })}
        </div>
    );
}
