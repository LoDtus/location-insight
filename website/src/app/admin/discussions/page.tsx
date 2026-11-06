import type { Metadata } from "next";

import { AdminPostReportsScreen } from "@/features/discussions/components/admin-post-reports-screen";

export const metadata: Metadata = { title: "Báo cáo bài viết" };

export default function Page() {
    return <AdminPostReportsScreen />;
}
