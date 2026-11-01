import type { Metadata } from "next";

import { FeedbackWorkspace } from "@/features/feedback/components/feedback-workspace";

export const metadata: Metadata = { title: "Góp ý" };

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
    const { id } = await params;
    return <FeedbackWorkspace mode="admin" selectedId={id} />;
}
