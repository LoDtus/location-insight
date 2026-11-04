/** Kiểu chữ dùng chung cho nội dung trong trình soạn và khi hiển thị. */
export const RICH_TEXT_CLASS = [
    "text-sm leading-relaxed text-charcoal",
    "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
    "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold",
    "[&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold",
    "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
    "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-charcoal/20 [&_blockquote]:pl-4 [&_blockquote]:italic",
    "[&_hr]:my-4 [&_hr]:border-charcoal/20",
    "[&_a]:text-green [&_a]:underline [&_a]:underline-offset-2",
].join(" ");

/** Kiểu chữ cho trang bài viết công khai: cỡ chữ đọc dài, khoảng cách rộng, tiêu đề chừa chỗ cho thanh đầu trang. */
export const RICH_TEXT_ARTICLE_CLASS = [
    "text-[1.0625rem] leading-8 text-charcoal",
    "[&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
    "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:scroll-mt-20 [&_h2]:text-2xl [&_h2]:leading-tight [&_h2]:font-semibold",
    "[&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:scroll-mt-20 [&_h3]:text-xl [&_h3]:font-semibold",
    "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5",
    "[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-green [&_blockquote]:pl-5 [&_blockquote]:italic",
    "[&_hr]:my-8 [&_hr]:border-charcoal/20",
    "[&_a]:text-green [&_a]:underline [&_a]:underline-offset-4",
].join(" ");
