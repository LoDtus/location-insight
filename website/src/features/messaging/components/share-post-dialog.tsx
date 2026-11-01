"use client";

import { Link2, SendHorizontal } from "lucide-react";
import { useState, type JSX } from "react";

import { errorText, startConversation } from "../messaging.actions";
import { sendMessage as sendRequest } from "../messaging.api";
import type { Person } from "../messaging.types";
import { Dialog } from "./dialog";
import { PersonPicker } from "./person-picker";

/** Chia sẻ một bài ở /feed: sao chép liên kết hoặc gửi cho một người qua tin nhắn. */
export function SharePostDialog({
    postId,
    link,
    onClose,
    onDone,
}: {
    postId: string;
    link: string;
    onClose: () => void;
    onDone: (text: string) => void;
}): JSX.Element {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");

    async function copy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(link);
            onDone("Đã sao chép liên kết.");
        } catch {
            setError("Chưa sao chép được liên kết.");
        }
    }

    async function send(person: Person): Promise<void> {
        setPending(true);
        setError("");
        try {
            const conversationId = await startConversation(person.id);
            await sendRequest(conversationId, {
                clientMsgId: crypto.randomUUID(),
                kind: "post_share",
                postId,
            });
            onDone(`Đã gửi cho ${person.displayName}.`);
        } catch (failure) {
            setError(errorText(failure, "Chưa gửi được."));
            setPending(false);
        }
    }

    return (
        <Dialog title="Chia sẻ bài viết" onClose={onClose}>
            <button
                type="button"
                className="mb-4 flex min-h-11 w-full items-center gap-3 rounded-xl border border-charcoal/20 px-3 font-semibold hover:bg-cream focus-visible:outline-2 focus-visible:outline-green"
                onClick={() => void copy()}
            >
                <Link2 className="size-4" aria-hidden="true" />
                Sao chép liên kết
            </button>
            <p className="m-0 mb-2 flex items-center gap-2 text-sm font-semibold">
                <SendHorizontal className="size-4" aria-hidden="true" />
                Gửi qua tin nhắn
            </p>
            <PersonPicker disabled={pending} onPick={(person) => void send(person)} />
            {error ? (
                <p role="alert" className="mt-3 mb-0 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
        </Dialog>
    );
}
