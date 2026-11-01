"use client";

import { useState, type JSX } from "react";

import { errorText, startConversation } from "../messaging.actions";
import type { Person } from "../messaging.types";
import { Dialog } from "./dialog";
import { PersonPicker } from "./person-picker";

export function NewMessageDialog({
    onClose,
    onOpen,
}: {
    onClose: () => void;
    onOpen: (conversationId: string) => void;
}): JSX.Element {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");

    async function pick(person: Person): Promise<void> {
        setPending(true);
        setError("");
        try {
            const id = await startConversation(person.id);
            onOpen(id);
        } catch (failure) {
            setError(errorText(failure, "Không mở được hội thoại."));
            setPending(false);
        }
    }

    return (
        <Dialog title="Tin nhắn mới" onClose={onClose}>
            <PersonPicker disabled={pending} onPick={(person) => void pick(person)} />
            {error ? (
                <p role="alert" className="mt-3 mb-0 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
        </Dialog>
    );
}
