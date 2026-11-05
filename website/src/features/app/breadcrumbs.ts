export type Crumb = { label: string; href?: string };

type Names = { vi: string; en: string };

/** Tab có nút dẫn sang nội dung khác (chi tiết, tạo mới). Tab không có thì không hiện đường dẫn. */
const TABS: Record<string, Names & { create?: Names }> = {
    properties: { vi: "Tin rao bán", en: "For sale", create: { vi: "Đăng tin mới", en: "New listing" } },
    blogs: { vi: "Bài viết", en: "Articles", create: { vi: "Viết bài mới", en: "New article" } },
    users: { vi: "Người dùng", en: "Users" },
    feed: { vi: "Diễn đàn", en: "Discussions" },
    discussions: { vi: "Thảo luận", en: "Discussions" },
    feedback: { vi: "Góp ý", en: "Feedback" },
    payments: { vi: "Thanh toán", en: "Payments" },
    profile: { vi: "Hồ sơ", en: "Profile" },
};

/** Trang chi tiết tin đã có đường dẫn riêng ngay trong nội dung nên bỏ qua ở đây. */
const OWN_TRAIL = new Set(["properties"]);

/** Trang gốc của tab đã có thanh lọc riêng ở đầu cột nên không cần đường dẫn; trang con vẫn có. */
const NO_ROOT_TRAIL = new Set(["feed"]);

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

/** Đường dẫn A > B > C cho /app và /admin; null khi tab không cần. */
export function buildCrumbs(pathname: string, vi: boolean): Crumb[] | null {
    const match = /^\/(app|admin)(?:\/([^/]+))?(?:\/([^/]+))?(?:\/.*)?$/.exec(pathname);
    if (!match) return null;
    const [, root, tab, sub] = match;
    const names = tab ? TABS[tab] : undefined;
    if (!tab || !names) return null;
    if (sub && sub !== "new" && OWN_TRAIL.has(tab)) return null;
    if (!sub && NO_ROOT_TRAIL.has(tab)) return null;
    const pick = (value: Names): string => (vi ? value.vi : value.en);
    const crumbs: Crumb[] = [
        { label: vi ? "Trang chủ" : "Home", href: `/${root}/properties` },
        { label: pick(names), href: sub ? `/${root}/${tab}` : undefined },
    ];
    if (sub) {
        const label = sub === "new" && names.create ? pick(names.create) : tab === "profile" ? safeDecode(sub) : vi ? "Chi tiết" : "Detail";
        crumbs.push({ label });
    }
    return crumbs;
}
