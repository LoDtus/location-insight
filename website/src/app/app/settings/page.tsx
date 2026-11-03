import type { Metadata } from "next";

import { SettingsScreen } from "@/features/settings/components/settings-screen";

export const metadata: Metadata = { title: "Cài đặt" };

export default function Page() {
    return <SettingsScreen />;
}
