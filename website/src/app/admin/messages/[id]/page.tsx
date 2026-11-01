import type { Metadata } from "next";

import { MessagesScreen } from "@/features/messaging/components/messages-screen";

export const metadata: Metadata = { title: "Tin nhắn" };

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
    const { id } = await params;
    return <MessagesScreen conversationId={id} root="/admin" />;
}
