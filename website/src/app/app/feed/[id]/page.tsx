"use client";

import { useParams } from "next/navigation";

import { ThreadScreen } from "@/features/discussions/components/thread-screen";

export default function Page() {
    const params = useParams<{ id: string }>();
    return <ThreadScreen id={params.id} root="/app" />;
}
