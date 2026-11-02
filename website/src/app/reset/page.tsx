import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
    createNonce,
    forwardedForIsPrivate,
    isAllowedHost,
    isDevResetEnabled,
} from "@/features/dev-reset/dev-reset.guard";

import ResetPanel from "./reset-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Reset dữ liệu dev",
    robots: { index: false, follow: false },
};

/**
 * Chỉ dành cho máy dev: xóa toàn bộ database rồi dựng lại + seed.
 * Mọi điều kiện sai đều trả 404 như thể trang không tồn tại. Thư mục này bị xóa khỏi image production.
 */
export default async function ResetPage() {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
    if (
        !isDevResetEnabled() ||
        !host ||
        !isAllowedHost(host) ||
        !forwardedForIsPrivate(requestHeaders.get("x-forwarded-for"))
    ) {
        notFound();
    }

    const nonce = createNonce(process.env.DEV_RESET_TOKEN ?? "", host);
    return (
        <ResetPanel
            nonce={nonce}
            database={process.env.DATABASE_NAME ?? "(không rõ)"}
            databaseHost={process.env.DATABASE_HOST ?? "(không rõ)"}
        />
    );
}
