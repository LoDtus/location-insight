import type { Metadata } from "next";

import { MessagesScreen } from "@/features/messaging/components/messages-screen";

export const metadata: Metadata = { title: "Tin nhắn" };

export default function Page() {
    return <MessagesScreen />;
}
