import type { Metadata } from "next";

import { AdminReportsScreen } from "@/features/messaging/components/admin-reports-screen";

export const metadata: Metadata = { title: "Báo cáo tin nhắn" };

export default function Page() {
    return <AdminReportsScreen />;
}
