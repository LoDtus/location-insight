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

/**
 * Kiểu chữ cho trang bài viết công khai, theo báo điện tử (VnExpress, Thanh Niên): thân bài chữ không chân 18px,
 * dòng 1.6, đoạn cách 18px; tiêu đề mục chữ có chân đậm; tiêu đề chừa chỗ cho thanh đầu trang khi nhảy từ mục lục.
 */
export const RICH_TEXT_ARTICLE_CLASS = [
    "font-sans text-[1.0625rem] leading-[1.6] text-charcoal sm:text-lg",
    "[&_p]:mt-0 [&_p]:mb-[18px] [&_p:last-child]:mb-0",
    "[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h2]:font-serif [&_h2]:text-[1.375rem] [&_h2]:leading-[1.45] [&_h2]:font-bold",
    "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:scroll-mt-24 [&_h3]:font-serif [&_h3]:text-[1.1875rem] [&_h3]:leading-[1.5] [&_h3]:font-bold",
    "[&_ul]:mt-0 [&_ul]:mb-[18px] [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-0 [&_ol]:mb-[18px] [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
    "[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-green [&_blockquote]:bg-charcoal/[0.03] [&_blockquote]:py-3 [&_blockquote]:pr-4 [&_blockquote]:pl-5",
    "[&_hr]:my-8 [&_hr]:border-charcoal/20",
    "[&_a]:text-green [&_a]:underline [&_a]:underline-offset-4",
].join(" ");
