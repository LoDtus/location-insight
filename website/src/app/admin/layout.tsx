import type { Metadata } from "next";
import { ReactNode } from "react";

import AppBreadcrumbs from "@/features/app/components/breadcrumbs";
import AppSidebar from "@/features/app/components/app-sidebar";
import { RequireAdmin } from "@/features/auth/route-gate";
import { MessagingProvider } from "@/features/messaging/messaging-provider";
import { PwaProvider } from "@/features/pwa/components/pwa-provider";
import SidebarLayout from "@/shared/components/layouts/sidebar.layout";
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
        <RequireAdmin>
            <MessagingProvider>
                <PwaProvider>
                    <SidebarLayout sidebar={<AppSidebar surface="admin" />} header={<AppBreadcrumbs />}>{children}</SidebarLayout>
                </PwaProvider>
            </MessagingProvider>
        </RequireAdmin>
    );
}
