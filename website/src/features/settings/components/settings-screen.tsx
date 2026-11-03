"use client";

import type { JSX } from "react";

import { EmailPreferencesCard } from "@/features/email/components/email-preferences-card";

export function SettingsScreen(): JSX.Element {
    return (
        <main className="box-border h-full overflow-auto px-4 py-8 sm:px-8">
            <div className="mx-auto w-full max-w-3xl">
                <h1 className="m-0 text-2xl font-medium">Cài đặt</h1>
                <div className="mt-6">
                    <EmailPreferencesCard />
                </div>
            </div>
        </main>
    );
}
