"use client";

import { useState, type JSX } from "react";

import { EmailLog } from "./email-log";
import { SuppressionList } from "./suppression-list";
import { TemplateEditor } from "./template-editor";

const TABS = [
    { id: "templates", label: "Mẫu email" },
    { id: "log", label: "Nhật ký gửi" },
    { id: "suppressions", label: "Danh sách chặn" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function EmailWorkspace(): JSX.Element {
    const [tab, setTab] = useState<TabId>("templates");

    return (
        <main className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-white" aria-label="Quản lý email">
            <header className="flex flex-col gap-3 border-b border-charcoal/10 px-4 pt-4 md:px-6">
                <h1 className="m-0 text-xl font-semibold">Email</h1>
                <div role="tablist" aria-label="Quản lý email" className="flex gap-1 overflow-x-auto">
                    {TABS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            id={`email-tab-${item.id}`}
                            aria-selected={tab === item.id}
                            aria-controls={`email-panel-${item.id}`}
                            onClick={() => setTab(item.id)}
                            className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-green ${
                                tab === item.id ? "border-green text-green" : "border-transparent text-charcoal/70 hover:text-charcoal"
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </header>
            <section
                role="tabpanel"
                id={`email-panel-${tab}`}
                aria-labelledby={`email-tab-${tab}`}
                className="min-h-0 flex-1 p-4 md:p-6"
            >
                {tab === "templates" ? <TemplateEditor /> : null}
                {tab === "log" ? <EmailLog /> : null}
                {tab === "suppressions" ? <SuppressionList /> : null}
            </section>
        </main>
    );
}
