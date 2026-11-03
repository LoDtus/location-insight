"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type JSX } from "react";

import { useAuth } from "@/features/auth/use-auth";
import { Dialog } from "@/features/messaging/components/dialog";
import { PersonAvatar } from "@/features/messaging/components/person-avatar";

import { followError, listFollowers, listFollowing, type FollowEntry } from "../follow.api";
import { FollowButton } from "./follow-button";

type Kind = "followers" | "following";

interface Loaded {
    key: string;
    items: FollowEntry[];
    cursor: string | null;
    error: string;
}

export function FollowListDialog({
    userId,
    root,
    initial,
    onClose,
    onChanged,
}: {
    userId: string;
    root: string;
    initial: Kind;
    onClose: () => void;
    onChanged: () => void;
}): JSX.Element {
    const me = useAuth().user?.userId;
    const [kind, setKind] = useState<Kind>(initial);
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [more, setMore] = useState(false);
    const sentinel = useRef<HTMLDivElement>(null);
    const key = `${userId}|${kind}`;

    useEffect(() => {
        let active = true;
        (kind === "followers" ? listFollowers(userId) : listFollowing(userId))
            .then((page) => {
                if (active) setLoaded({ key, items: page.items, cursor: page.nextCursor, error: "" });
            })
            .catch((error: unknown) => {
                if (active) setLoaded({ key, items: [], cursor: null, error: followError(error) });
            });
        return () => {
            active = false;
        };
    }, [userId, kind, key]);

    const ready = loaded?.key === key;
    const items = ready ? loaded.items : [];
    const cursor = ready ? loaded.cursor : null;

    useEffect(() => {
        const element = sentinel.current;
        if (!element || !cursor || more) return;
        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            setMore(true);
            (kind === "followers" ? listFollowers(userId, cursor) : listFollowing(userId, cursor))
                .then((page) =>
                    setLoaded((current) =>
                        current && current.key === key
                            ? { ...current, items: [...current.items, ...page.items], cursor: page.nextCursor }
                            : current,
                    ),
                )
                .catch(() => undefined)
                .finally(() => setMore(false));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [cursor, kind, userId, key, more]);

    function setFollowing(id: string, following: boolean): void {
        setLoaded((current) =>
            current ? { ...current, items: current.items.map((item) => (item.id === id ? { ...item, followedByMe: following } : item)) } : current,
        );
    }

    return (
        <Dialog title={kind === "followers" ? "Người theo dõi" : "Đang theo dõi"} onClose={onClose}>
            <div className="mb-3 flex gap-2" role="tablist" aria-label="Danh sách">
                {(["followers", "following"] as const).map((item) => (
                    <button
                        key={item}
                        type="button"
                        role="tab"
                        aria-selected={kind === item}
                        className={`min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${kind === item ? "border-charcoal bg-charcoal text-cream" : "border-charcoal/25"}`}
                        onClick={() => setKind(item)}
                    >
                        {item === "followers" ? "Người theo dõi" : "Đang theo dõi"}
                    </button>
                ))}
            </div>
            {!ready ? (
                <p className="m-0 text-sm" role="status">
                    Đang tải…
                </p>
            ) : loaded.error ? (
                <p className="m-0 text-sm" role="alert">
                    {loaded.error}
                </p>
            ) : items.length === 0 ? (
                <p className="m-0 text-sm text-charcoal/70">Chưa có ai.</p>
            ) : (
                <ul className="m-0 grid gap-1 p-0">
                    {items.map((item) => (
                        <li key={item.id} className="flex list-none items-center gap-3 py-1">
                            <PersonAvatar name={item.displayName} url={item.avatarUrl} size={44} />
                            <span className="min-w-0 flex-1">
                                {item.username ? (
                                    <Link href={`${root}/profile/@${item.username}`} onClick={onClose} className="block truncate font-semibold text-inherit no-underline">
                                        {item.displayName}
                                    </Link>
                                ) : (
                                    <span className="block truncate font-semibold">{item.displayName}</span>
                                )}
                                <span className="block truncate text-sm text-charcoal/65">
                                    {item.username ? `@${item.username}` : ""}
                                    {item.followsMe ? " · Theo dõi bạn" : ""}
                                </span>
                            </span>
                            {item.id !== me ? (
                                <FollowButton
                                    userId={item.id}
                                    following={item.followedByMe}
                                    followsMe={item.followsMe}
                                    onChange={(next) => {
                                        setFollowing(item.id, next.following);
                                        if (next.state) onChanged();
                                    }}
                                />
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
            {cursor ? <div ref={sentinel} className="h-6" aria-hidden="true" /> : null}
        </Dialog>
    );
}
