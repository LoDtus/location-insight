/** Các section của landing theo thứ tự trang; section đầu ứng với URL không có hash. */
export const LANDING_SECTIONS = ["gioi-thieu", "ban-do", "nha-dat", "bang-gia", "cach-hoat-dong", "cau-hoi-thuong-gap"] as const;

/** Sự kiện phát khi section đang xem đổi, để thanh menu đánh dấu mục tương ứng. */
export const LANDING_SECTION_EVENT = "landing:section";

function scrollParent(node: HTMLElement): HTMLElement | null {
    let current = node.parentElement;
    while (current) {
        const overflow = getComputedStyle(current).overflowY;
        if (overflow === "auto" || overflow === "scroll") return current;
        current = current.parentElement;
    }
    return null;
}

/**
 * Cuộn tới section trong đúng khung cuộn của landing. `scrollIntoView` sẽ cuộn cả khung ngoài
 * (đẩy header khỏi màn hình) khi section cuối thấp hơn màn hình.
 */
export function scrollToSection(id: string, behavior: ScrollBehavior): void {
    const target = document.getElementById(id);
    if (!target) return;
    const parent = scrollParent(target);
    if (!parent) {
        target.scrollIntoView({ behavior, block: "start" });
        return;
    }
    const top = target.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop;
    parent.scrollTo({ top, behavior });
}
