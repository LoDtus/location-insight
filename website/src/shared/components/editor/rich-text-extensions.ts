import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Heading from "@tiptap/extension-heading";
import Image from "@tiptap/extension-image";
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
    /**
     * Ảnh khối trong nội dung (Markdown `![mô tả](/images/… "chú thích")`). Chỉ bật cho bài viết (soạn bằng Markdown);
     * mặc định bật theo `markdown`. Mô tả tin rao và các ô soạn ngắn không nhận ảnh dán vào.
     */
    images?: boolean;
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
 * luôn dựng lại được đúng như lúc soạn. Không có bảng hay HTML thô: nội dung gồm đoạn, tiêu đề, danh sách,
 * trích dẫn, đường kẻ, liên kết và (chỉ bài viết) ảnh.
 */
export function buildRichTextExtensions(options: RichTextOptions = {}): Extensions {
    const markdown = options.markdown === true;
    const images = options.images ?? markdown;
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
        ...(images ? [Image.configure({ inline: false, allowBase64: false })] : []),
        ...(markdown ? [Markdown] : [TextAlign.configure({ types: ["heading", "paragraph"] })]),
        Placeholder.configure({ placeholder: options.placeholder ?? "" }),
        CharacterCount.configure({ limit: options.maxLength }),
    ];
}
