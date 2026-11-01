"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type JSX } from "react";

import { useAuth } from "@/features/auth/use-auth";

import type { Folder } from "../messaging.reducers";
import { useMessagingState } from "../messaging.store";
import { ConversationList } from "./conversation-list";
import { NewMessageDialog } from "./new-message-dialog";
import { SettingsDialog } from "./settings-dialog";
import { Thread } from "./thread";

/** Hai cột trên máy tính (danh sách + hội thoại); một cột theo tầng trên điện thoại. */
export function MessagesScreen({
    conversationId = null,
    root = "/app",
}: {
    conversationId?: string | null;
    root?: "/app" | "/admin";
}): JSX.Element {
    const router = useRouter();
    const auth = useAuth();
    const [chosen, setChosen] = useState<{ id: string | null; folder: Folder } | null>(null);
    const [composing, setComposing] = useState(false);
    const [settings, setSettings] = useState(false);
    const conversation = useMessagingState((state) => (conversationId ? state.conversations[conversationId] : undefined));

    const derived: Folder =
        conversation && conversation.state === "pending" && !conversation.iAmInitiator ? "requests" : "inbox";
    const folder = chosen && chosen.id === conversationId ? chosen.folder : derived;

    if (!auth.user) return <></>;

    return (
        <main className="flex h-full min-h-0 w-full bg-white" aria-label="Tin nhắn">
            <div className={`${conversationId ? "hidden md:flex" : "flex"} h-full min-h-0 w-full md:w-auto`}>
                <ConversationList
                    root={root}
                    activeId={conversationId}
                    folder={folder}
                    onFolder={(next) => setChosen({ id: conversationId, folder: next })}
                    onCompose={() => setComposing(true)}
                    onSettings={() => setSettings(true)}
                />
            </div>
            <div className={`${conversationId ? "flex" : "hidden md:flex"} h-full min-h-0 min-w-0 flex-1`}>
                {conversationId ? (
                    <Thread
                        key={conversationId}
                        conversationId={conversationId}
                        root={root}
                        onBack={() => router.push(`${root}/messages`)}
                        onGone={() => router.replace(`${root}/messages`)}
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-charcoal/70">
                        <MessageCircle className="size-12" aria-hidden="true" />
                        <p className="m-0 text-lg font-semibold text-charcoal">Tin nhắn của bạn</p>
                        <p className="m-0 max-w-sm text-sm">Chọn một hội thoại ở bên trái hoặc bắt đầu một cuộc trò chuyện mới.</p>
                        <button
                            type="button"
                            className="min-h-11 rounded-full bg-green px-6 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                            onClick={() => setComposing(true)}
                        >
                            Tin nhắn mới
                        </button>
                    </div>
                )}
            </div>
            {composing ? (
                <NewMessageDialog
                    onClose={() => setComposing(false)}
                    onOpen={(id) => {
                        setComposing(false);
                        router.push(`${root}/messages/${id}`);
                    }}
                />
            ) : null}
            {settings ? <SettingsDialog onClose={() => setSettings(false)} /> : null}
        </main>
    );
}
