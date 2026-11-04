import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Heading from "@tiptap/extension-heading";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import type { Extensions } from "@tiptap/react";

export type RichTextOptions = {
    placeholder?: string;
    maxLength?: number;
    /**
     * Bật khi nội dung lưu ở dạng Markdown (bài viết do người và AI cùng soạn). Markdown không
     * biểu diễn được gạch chân và căn lề nên hai thứ đó bị tắt để nội dung không mất khi lưu.
     */
    markdown?: boolean;
};

/** Tiêu đề có thuộc tính `id` để mục lục nhảy tới được; không ghi gì vào Markdown. */
const HeadingWithId = Heading.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            id: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute("id"),
                renderHTML: (attributes: { id?: string | null }) => (attributes.id ? { id: attributes.id } : {}),
            },
        };
    },
}).configure({ levels: [2, 3] });

/**
 * Bộ extension dùng chung cho trình soạn và trình hiển thị, để nội dung lưu ra
 * luôn dựng lại được đúng như lúc soạn. Không có ảnh, bảng hay HTML thô: nội dung chỉ gồm
 * đoạn, tiêu đề, danh sách, trích dẫn, đường kẻ và liên kết.
 */
export function buildRichTextExtensions(options: RichTextOptions = {}): Extensions {
    const markdown = options.markdown === true;
    return [
        StarterKit.configure({
            heading: false,
            codeBlock: false,
            code: false,
            underline: markdown ? false : undefined,
            link: {
                openOnClick: false,
                autolink: true,
                defaultProtocol: "https",
                protocols: ["mailto", "tel"],
                HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
            },
        }),
        HeadingWithId,
        ...(markdown ? [Markdown] : [TextAlign.configure({ types: ["heading", "paragraph"] })]),
        Placeholder.configure({ placeholder: options.placeholder ?? "" }),
        CharacterCount.configure({ limit: options.maxLength }),
    ];
}
