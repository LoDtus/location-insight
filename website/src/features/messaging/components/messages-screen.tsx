"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type JSX } from "react";

import { useAuth } from "@/features/auth/use-auth";

import type { Folder } from "../messaging.reducers";
import { useMessagingState } from "../messaging.store";
import { ConversationInfoPanel } from "./conversation-info-panel";
import { ConversationList } from "./conversation-list";
import { NewMessageDialog } from "./new-message-dialog";
import { SettingsDialog } from "./settings-dialog";
import { Thread } from "./thread";

const INFO_KEY = "messaging-info-open";
/** Danh sách 340 px + hội thoại + cột thông tin 320 px. Cột hẹp của shell không đủ thì mở dạng ngăn trượt. */
const COLUMN_MIN = 1100;

function usePaneWide(minWidth: number): { ref: (node: HTMLElement | null) => void; wide: boolean } {
    const [node, setNode] = useState<HTMLElement | null>(null);
    const [wide, setWide] = useState(false);

    useEffect(() => {
        if (!node) return;
        const observer = new ResizeObserver((entries) => {
            const next = (entries[0]?.contentRect.width ?? 0) >= minWidth;
            setWide((current) => (current === next ? current : next));
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, [node, minWidth]);

    return { ref: setNode, wide };
}

function readInfoPreference(): boolean {
    try {
        return window.localStorage.getItem(INFO_KEY) !== "0";
    } catch {
        return true;
    }
}

function writeInfoPreference(open: boolean): void {
    try {
        window.localStorage.setItem(INFO_KEY, open ? "1" : "0");
    } catch {
        /* localStorage có thể bị chặn */
    }
}

/**
 * Ba cột trên màn rộng (danh sách + hội thoại + thông tin); hai cột trên máy tính vừa, nơi thông tin mở dạng ngăn trượt;
 * một cột theo tầng trên điện thoại.
 */
export function MessagesScreen({
    conversationId = null,
    root = "/app",
}: {
    conversationId?: string | null;
    root?: "/app" | "/admin";
}): JSX.Element {
    const router = useRouter();
    const auth = useAuth();
    const pane = usePaneWide(COLUMN_MIN);
    const wide = pane.wide;
    const [chosen, setChosen] = useState<{ id: string | null; folder: Folder } | null>(null);
    const [composing, setComposing] = useState(false);
    const [settings, setSettings] = useState(false);
    const [columnOpen, setColumnOpen] = useState(readInfoPreference);
    // Ngăn trượt gắn với hội thoại đang mở: chuyển hội thoại thì tự đóng.
    const [sheetFor, setSheetFor] = useState<string | null>(null);
    const conversation = useMessagingState((state) => (conversationId ? state.conversations[conversationId] : undefined));

    const derived: Folder =
        conversation && conversation.state === "pending" && !conversation.iAmInitiator ? "requests" : "inbox";
    const folder = chosen && chosen.id === conversationId ? chosen.folder : derived;
    const sheetOpen = conversationId !== null && sheetFor === conversationId;
    const infoOpen = wide ? columnOpen : sheetOpen;

    useEffect(() => {
        if (!sheetOpen) return;
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") setSheetFor(null);
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [sheetOpen]);

    if (!auth.user) return <></>;

    function toggleInfo(): void {
        if (wide) {
            setColumnOpen((current) => {
                writeInfoPreference(!current);
                return !current;
            });
        } else {
            setSheetFor((current) => (current === conversationId ? null : conversationId));
        }
    }

    function leave(): void {
        router.replace(`${root}/messages`);
    }

    return (
        <main ref={pane.ref} className="flex h-full min-h-0 w-full bg-white" aria-label="Tin nhắn">
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
                        infoOpen={infoOpen}
                        onToggleInfo={toggleInfo}
                        onBack={() => router.push(`${root}/messages`)}
                        onGone={leave}
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
            {conversationId && wide && columnOpen ? (
                <div className="h-full min-h-0 w-[320px] shrink-0 border-l border-charcoal/10">
                    <ConversationInfoPanel
                        key={conversationId}
                        conversationId={conversationId}
                        variant="column"
                        onClose={toggleInfo}
                        onGone={leave}
                    />
                </div>
            ) : null}
            {conversationId && !wide && sheetOpen ? (
                <div className="fixed inset-0 z-40 flex justify-end bg-charcoal/40">
                    <button type="button" className="absolute inset-0 cursor-default" aria-label="Đóng thông tin" tabIndex={-1} onClick={() => setSheetFor(null)} />
                    <div className="relative h-full w-full max-w-sm bg-white shadow-xl">
                        <ConversationInfoPanel
                            key={conversationId}
                            conversationId={conversationId}
                            variant="sheet"
                            onClose={() => setSheetFor(null)}
                            onGone={leave}
                        />
                    </div>
                </div>
            ) : null}
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
