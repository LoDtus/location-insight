/** Hiển thị số điện thoại theo nhóm 4-3-3. Khi che, ba số cuối thành dấu sao. */
export function formatPhone(phone: string, masked: boolean): string {
    const digits = phone.replace(/\s/g, "");
    if (!/^(?:0|\+84)\d{9}$/.test(digits)) return masked ? "***" : digits;
    const local = digits.startsWith("+84") ? `0${digits.slice(3)}` : digits;
    const head = `${local.slice(0, 4)} ${local.slice(4, 7)}`;
    return masked ? `${head} ***` : `${head} ${local.slice(7)}`;
}

/** Chuỗi dùng cho liên kết tel:, chỉ gồm số và dấu cộng đầu. */
export function telHref(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
