"use client";

import { File as FileIcon, FileSpreadsheet, FileText, Presentation, type LucideIcon } from "lucide-react";
import type { JSX } from "react";

import { fileKindOf, formatBytes, type FileKind } from "../messaging.format";

const ICONS: Record<FileKind, LucideIcon> = {
    pdf: FileText,
    word: FileText,
    sheet: FileSpreadsheet,
    slide: Presentation,
    text: FileIcon,
};

export function FileTypeIcon({ fileName, className = "size-5" }: { fileName: string; className?: string }): JSX.Element {
    const Icon = ICONS[fileKindOf(fileName)];
    return <Icon className={className} aria-hidden="true" />;
}

/**
 * Thẻ tệp đính kèm. Địa chỉ tải do máy chủ ký, buộc tải xuống với tên đã làm sạch,
 * nên mở bằng thẻ <a> thường là đủ và không chạy nội dung tệp trong trang.
 */
export function FileCard({
    fileName,
    byteSize,
    url,
    tone = "plain",
    onClick,
}: {
    fileName: string;
    byteSize: number;
    url: string;
    tone?: "mine" | "theirs" | "plain";
    onClick?: (event: React.MouseEvent) => void;
}): JSX.Element {
    const colors =
        tone === "mine"
            ? "border-cream/40 text-cream hover:bg-cream/10"
            : "border-charcoal/15 bg-white text-charcoal hover:bg-charcoal/5";
    return (
        <a
            href={url}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${colors}`}
            aria-label={`Tải về ${fileName}, ${formatBytes(byteSize)}`}
            onClick={onClick}
        >
            <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${tone === "mine" ? "bg-cream/15" : "bg-green/10 text-green"}`}>
                <FileTypeIcon fileName={fileName} />
            </span>
            <span className="min-w-0">
                <span className="block truncate text-sm font-semibold [overflow-wrap:anywhere]">{fileName}</span>
                <span className="block text-xs opacity-70">{formatBytes(byteSize)}</span>
            </span>
        </a>
    );
}
