"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useMemo, type JSX } from "react";

import { buildRichTextExtensions } from "@/shared/components/editor/rich-text-extensions";
import RichTextToolbar from "@/shared/components/editor/rich-text-toolbar";
import { RICH_TEXT_CLASS } from "@/shared/components/editor/rich-text.style";
import type { RichTextChange, RichTextDoc } from "@/shared/components/editor/rich-text.types";
import { EMPTY_RICH_TEXT } from "@/shared/components/editor/rich-text.utils";
import { useLocale } from "@/shared/hooks/useLocale";

type RichTextEditorProps = {
    /** Nội dung ban đầu. Chỉ đọc lúc dựng; sau đó trình soạn tự giữ trạng thái. */
    initialValue?: RichTextDoc;
    /** Chế độ Markdown: nội dung vào/ra là chuỗi Markdown (`initialMarkdown`, `change.markdown`). */
    markdown?: boolean;
    initialMarkdown?: string;
    onChange: (change: RichTextChange) => void;
    ariaLabel: string;
    placeholder?: string;
    maxLength?: number;
    minHeightClass?: string;
    invalid?: boolean;
    describedBy?: string;
};

/**
 * Trình soạn nội dung dùng chung (Tiptap). Giao diện thanh công cụ do dự án tự dựng,
 * dùng lại ở mọi module cần soạn văn bản: mô tả tin rao, bài viết, phản hồi...
 */
export default function RichTextEditor({
    initialValue = EMPTY_RICH_TEXT,
    markdown = false,
    initialMarkdown = "",
    onChange,
    ariaLabel,
    placeholder,
    maxLength,
    minHeightClass = "min-h-56",
    invalid = false,
    describedBy,
}: RichTextEditorProps): JSX.Element {
    const { locale } = useLocale();
    const vi = locale === "vi";
    const extensions = useMemo(() => buildRichTextExtensions({ placeholder, maxLength, markdown }), [placeholder, maxLength, markdown]);
    const editor = useEditor({
        extensions,
        content: markdown ? initialMarkdown : initialValue,
        ...(markdown ? { contentType: "markdown" as const } : {}),
        immediatelyRender: false,
        editorProps: {
            attributes: {
                role: "textbox",
                "aria-multiline": "true",
                "aria-label": ariaLabel,
                "aria-invalid": String(invalid),
                ...(describedBy ? { "aria-describedby": describedBy } : {}),
                class: `${minHeightClass} px-4 py-3 outline-none ${RICH_TEXT_CLASS} [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-charcoal/40 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]`,
            },
        },
        onUpdate: ({ editor: current }) => {
            onChange({
                doc: current.getJSON() as RichTextDoc,
                characters: current.storage.characterCount.characters(),
                ...(markdown ? { markdown: current.getMarkdown() } : {}),
            });
        },
    });

    const names = {
        toolbar: vi ? "Định dạng văn bản" : "Text formatting",
        undo: vi ? "Hoàn tác" : "Undo",
        redo: vi ? "Làm lại" : "Redo",
        paragraph: vi ? "Đoạn văn" : "Paragraph",
        heading2: vi ? "Tiêu đề lớn" : "Heading",
        heading3: vi ? "Tiêu đề nhỏ" : "Subheading",
        bold: vi ? "In đậm" : "Bold",
        italic: vi ? "In nghiêng" : "Italic",
        underline: vi ? "Gạch chân" : "Underline",
        strike: vi ? "Gạch ngang" : "Strikethrough",
        bullet: vi ? "Danh sách chấm" : "Bulleted list",
        ordered: vi ? "Danh sách số" : "Numbered list",
        quote: vi ? "Trích dẫn" : "Quote",
        alignLeft: vi ? "Căn trái" : "Align left",
        alignCenter: vi ? "Căn giữa" : "Align center",
        alignRight: vi ? "Căn phải" : "Align right",
        rule: vi ? "Đường kẻ ngang" : "Horizontal rule",
        clear: vi ? "Xóa định dạng" : "Clear formatting",
    };
    const labels = {
        link: vi ? "Chèn liên kết" : "Insert link",
        linkPlaceholder: vi ? "Dán địa chỉ liên kết, ví dụ example.com" : "Paste a link, e.g. example.com",
        linkApply: vi ? "Áp dụng" : "Apply",
        linkInvalid: vi ? "Liên kết không hợp lệ. Chỉ chấp nhận http, https, mailto, tel." : "Invalid link. Only http, https, mailto, tel are allowed.",
        removeLink: vi ? "Gỡ liên kết" : "Remove link",
    };

    return (
        <div
            className={`overflow-hidden rounded-xl border bg-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-green ${invalid ? "border-red-600" : "border-charcoal/20"}`}
        >
            {editor ? <RichTextToolbar editor={editor} labels={labels} names={names} /> : <div className="h-[49px] border-b border-charcoal/15 bg-white" />}
            <EditorContent editor={editor} />
        </div>
    );
}
