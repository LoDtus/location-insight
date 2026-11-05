/** Bộ lọc của trang diễn đàn: mới nhất, đang theo dõi, hoặc một chủ đề. */
export type FeedView = { scope: "all"; topic: string } | { scope: "following"; topic: "" };

export const ALL_FEED: FeedView = { scope: "all", topic: "" };

const TOPIC_PARAM = "chu-de";
const SCOPE_PARAM = "muc";
const FOLLOWING = "dang-theo-doi";
/** Khớp với slug do `slugifyTopic` tạo: chữ thường, số, gạch nối, tối đa 80 ký tự. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Đọc bộ lọc từ query string; giá trị lạ thì về "Mới nhất". */
export function readFeedView(search: string | URLSearchParams): FeedView {
    const params = typeof search === "string" ? new URLSearchParams(search) : search;
    if (params.get(SCOPE_PARAM) === FOLLOWING) return { scope: "following", topic: "" };
    const topic = params.get(TOPIC_PARAM) ?? "";
    if (topic.length <= 80 && SLUG.test(topic)) return { scope: "all", topic };
    return ALL_FEED;
}

/**
 * Ghi bộ lọc vào query string hiện có, giữ nguyên các tham số khác.
 * Trả về chuỗi bắt đầu bằng "?" hoặc chuỗi rỗng khi không còn tham số nào.
 */
export function writeFeedView(search: string, view: FeedView): string {
    const params = new URLSearchParams(search);
    params.delete(TOPIC_PARAM);
    params.delete(SCOPE_PARAM);
    if (view.scope === "following") params.set(SCOPE_PARAM, FOLLOWING);
    else if (view.topic) params.set(TOPIC_PARAM, view.topic);
    const query = params.toString();
    return query ? `?${query}` : "";
}
