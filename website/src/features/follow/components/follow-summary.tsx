"use client";

import { useEffect, useState, type JSX } from "react";

import { MessageButton } from "@/features/messaging/components/message-button";

import { getFollowState, type FollowState } from "../follow.api";
import { FollowButton } from "./follow-button";
import { FollowListDialog } from "./follow-list-dialog";

/** Hai bộ đếm, nhãn "Theo dõi bạn", nút Theo dõi và Nhắn tin của một hồ sơ. */
export function FollowSummary({ userId, root, own }: { userId: string; root: "/app" | "/admin"; own: boolean }): JSX.Element {
    const [state, setState] = useState<FollowState | null>(null);
    const [dialog, setDialog] = useState<"followers" | "following" | null>(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let active = true;
        getFollowState(userId)
            .then((next) => {
                if (active) setState(next);
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [userId, reload]);

    if (!state) return <div className="mt-4 h-11" aria-hidden="true" />;

    function changed(next: { following: boolean; state?: FollowState }): void {
        setState((current) => {
            if (!current) return current;
            if (next.state) return { ...next.state };
            const delta = next.following === current.following ? 0 : next.following ? 1 : -1;
            return { ...current, following: next.following, followerCount: Math.max(0, current.followerCount + delta) };
        });
    }

    return (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="m-0 flex items-center gap-1 text-sm">
                <button
                    type="button"
                    className="min-h-11 rounded-lg pr-1 font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    onClick={() => setDialog("followers")}
                >
                    {state.followerCount.toLocaleString("vi-VN")} người theo dõi
                </button>
                <span aria-hidden="true">·</span>
                <button
                    type="button"
                    className="min-h-11 rounded-lg px-1 font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    onClick={() => setDialog("following")}
                >
                    {state.followingCount.toLocaleString("vi-VN")} đang theo dõi
                </button>
            </p>
            {state.followedBy && !own ? (
                <span className="rounded-full bg-charcoal/10 px-3 py-1 text-xs font-semibold">Theo dõi bạn</span>
            ) : null}
            {!own ? (
                <div className="flex flex-wrap items-start gap-2">
                    <FollowButton userId={userId} following={state.following} followsMe={state.followedBy} onChange={changed} />
                    <MessageButton userId={userId} root={root} />
                </div>
            ) : null}
            {dialog ? (
                <FollowListDialog
                    userId={userId}
                    root={root}
                    initial={dialog}
                    onClose={() => setDialog(null)}
                    onChanged={() => setReload((value) => value + 1)}
                />
            ) : null}
        </div>
    );
}
