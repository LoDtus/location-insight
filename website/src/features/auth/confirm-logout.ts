"use client";

import { getConfirmModal } from "@/shared/utils/confirm.utils";

/** Mọi nút "Đăng xuất" hỏi lại trước khi gọi logout(). Trả về true nếu người dùng đồng ý. */
export function confirmLogout(vi: boolean): Promise<boolean> {
    return getConfirmModal({
        title: vi ? "Đăng xuất?" : "Sign out?",
        content: vi
            ? "Bạn sẽ đăng xuất khỏi thiết bị này. Bản nháp, lịch sử tìm kiếm và cài đặt lưu trên trình duyệt sẽ bị xóa."
            : "You will be signed out on this device. Drafts, search history and settings stored in this browser will be cleared.",
        okText: vi ? "Đăng xuất" : "Sign out",
        cancelText: vi ? "Hủy" : "Cancel",
    });
}
