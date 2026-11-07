import type { Metadata } from "next";
import { ReactNode } from "react";

import AppBreadcrumbs from "@/features/app/components/breadcrumbs";
import AppHeader from "@/features/app/components/app-header";
import { RequireSession } from "@/features/auth/route-gate";
import { MessagingProvider } from "@/features/messaging/messaging-provider";
import { PwaProvider } from "@/features/pwa/components/pwa-provider";
import TopNavLayout from "@/shared/components/layouts/top-nav.layout";
import { PRIVATE_ROBOTS } from "@/shared/constants/seo.constant";

export const metadata: Metadata = {
    robots: PRIVATE_ROBOTS,
};

export default function Layout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <RequireSession>
            <MessagingProvider>
                <PwaProvider>
                    {/* /app: header ngang như trang công khai thay cho sidebar (/admin vẫn dùng sidebar). */}
                    <TopNavLayout header={<AppHeader />} subheader={<AppBreadcrumbs />}>
                        {children}
                    </TopNavLayout>
                </PwaProvider>
            </MessagingProvider>
        </RequireSession>
    );
}
