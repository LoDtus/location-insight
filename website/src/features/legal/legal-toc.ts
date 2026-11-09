export interface LegalTocItem {
    id: string;
    text: string;
}

/** Id neo từ tiêu đề: bỏ dấu tiếng Việt, chữ thường, nối bằng gạch ngang. */
export function slugifyHeading(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/gi, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/** Mục lục từ các tiêu đề `## ` của tài liệu; id trùng được đánh số để luôn duy nhất. */
export function extractToc(markdown: string): LegalTocItem[] {
    const seen = new Map<string, number>();
    const items: LegalTocItem[] = [];

    for (const line of markdown.split("\n")) {
        const match = /^##\s+(.+?)\s*#*\s*$/.exec(line);

        if (!match) {
            continue;
        }

        const text = match[1].trim();
        const base = slugifyHeading(text) || "muc";
        const count = seen.get(base) ?? 0;

        seen.set(base, count + 1);
        items.push({ id: count === 0 ? base : `${base}-${count + 1}`, text });
    }

    return items;
}
