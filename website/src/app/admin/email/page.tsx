import type { Metadata } from "next";

import { EmailWorkspace } from "@/features/email/components/email-workspace";

export const metadata: Metadata = { title: "Email" };

export default function Page() {
    return <EmailWorkspace />;
}
