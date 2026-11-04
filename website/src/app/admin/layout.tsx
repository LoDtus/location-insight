import type { Metadata } from "next";
import { ReactNode } from "react";

import AppSidebar from "@/features/app/components/app-sidebar";
import { ShellContent } from "@/features/app/components/shell-content";
import { RequireAdmin } from "@/features/auth/route-gate";
import { MessagingProvider } from "@/features/messaging/messaging-provider";
import { PwaProvider } from "@/features/pwa/components/pwa-provider";
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
                    <div className="flex h-full min-h-0 w-full bg-white pb-[env(safe-area-inset-bottom)] text-charcoal">
                        <AppSidebar surface="admin" />
                        <div id="noi-dung" className="h-full min-h-0 min-w-0 flex-1">
                            <ShellContent>{children}</ShellContent>
                        </div>
                    </div>
                </PwaProvider>
            </MessagingProvider>
        </RequireAdmin>
    );
}
