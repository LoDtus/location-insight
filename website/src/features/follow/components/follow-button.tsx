"use client";

import { useState, type JSX } from "react";

import { followError, followUser, unfollowUser, type FollowState } from "../follow.api";

/** Nút Theo dõi / Đang theo dõi, cập nhật lạc quan và hoàn lại khi lỗi. */
export function FollowButton({
    userId,
    following,
    followsMe = false,
    onChange,
    className = "",
}: {
    userId: string;
    following: boolean;
    followsMe?: boolean;
    onChange: (next: { following: boolean; state?: FollowState }) => void;
    className?: string;
}): JSX.Element {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const [hover, setHover] = useState(false);

    async function toggle(): Promise<void> {
        if (pending) return;
        const target = !following;
        setPending(true);
        setError("");
        onChange({ following: target });
        try {
            const state = await (target ? followUser(userId) : unfollowUser(userId));
            onChange({ following: state.following, state });
        } catch (failure) {
            onChange({ following });
            setError(followError(failure));
        } finally {
            setPending(false);
        }
    }

    const label = following ? (hover ? "Bỏ theo dõi" : "Đang theo dõi") : followsMe ? "Theo dõi lại" : "Theo dõi";
    return (
        <span className="inline-flex flex-col items-start">
            <button
                type="button"
                aria-pressed={following}
                disabled={pending}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                onFocus={() => setHover(true)}
                onBlur={() => setHover(false)}
                onClick={() => void toggle()}
                className={`inline-flex min-h-11 min-w-32 items-center justify-center rounded-full px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:cursor-wait disabled:opacity-70 ${
                    following ? "border border-charcoal/40 bg-transparent text-charcoal hover:border-red-700 hover:text-red-700" : "bg-green text-cream"
                } ${className}`}
            >
                {label}
            </button>
            {error ? (
                <span role="alert" className="mt-1 text-xs text-red-700">
                    {error}
                </span>
            ) : null}
        </span>
    );
}
