/** Nút của tài liệu Tiptap/ProseMirror ở dạng JSON, dùng để lưu và hiển thị mô tả. */
export type RichTextNode = {
    type: string;
    attrs?: Record<string, unknown>;
    content?: RichTextNode[];
    marks?: { type: string; attrs?: Record<string, unknown> }[];
    text?: string;
};

export type RichTextDoc = RichTextNode & { type: "doc" };

export type RichTextChange = {
    doc: RichTextDoc;
    /** Số ký tự chữ thực tế, không tính định dạng. */
    characters: number;
};
