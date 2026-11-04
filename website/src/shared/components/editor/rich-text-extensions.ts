import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import type { Extensions } from "@tiptap/react";

export type RichTextOptions = {
    placeholder?: string;
    maxLength?: number;
};

/**
 * Bộ extension dùng chung cho trình soạn và trình hiển thị, để nội dung lưu ra
 * luôn dựng lại được đúng như lúc soạn. Không có ảnh, bảng hay HTML thô: nội dung chỉ gồm
 * đoạn, tiêu đề, danh sách, trích dẫn, đường kẻ và liên kết.
 */
export function buildRichTextExtensions(options: RichTextOptions = {}): Extensions {
    return [
        StarterKit.configure({
            heading: { levels: [2, 3] },
            codeBlock: false,
            code: false,
            link: {
                openOnClick: false,
                autolink: true,
                defaultProtocol: "https",
                protocols: ["mailto", "tel"],
                HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
            },
        }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Placeholder.configure({ placeholder: options.placeholder ?? "" }),
        CharacterCount.configure({ limit: options.maxLength }),
    ];
}
