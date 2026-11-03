"use client";

import {
    AtSign,
    CalendarDays,
    Mail,
    MapPin,
    Pencil,
    ShieldCheck,
    UserRound,
} from "lucide-react";
import Link from "next/link";
import { FollowSummary } from "@/features/follow/components/follow-summary";
import { useEffect, useState, type FormEvent, type JSX } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS } from "@/app/auth/form-class";
import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import { profileUpdated } from "@/features/auth/auth.slice";
import { ProfileForumPost } from "@/features/profile/components/profile-forum-post";
import { ProfilePosts } from "@/features/profile/components/profile-posts";
import {
    getOwnProfile,
    getPublicProfile,
    updateOwnProfile,
    type Profile,
    type ProfileInput,
} from "@/features/profile/profile.api";
import { useAppDispatch } from "@/store/hooks";

const EMPTY: ProfileInput = {
    displayName: "",
    username: "",
    avatarUrl: "",
    city: "",
    bio: "",
};

function initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    return words
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toLocaleUpperCase("vi");
}

function joinedLabel(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? ""
        : new Intl.DateTimeFormat("vi-VN", {
              month: "long",
              year: "numeric",
          }).format(date);
}

function Avatar({ profile }: { profile: Profile }): JSX.Element {
    if (profile.avatarUrl) {
        return (
            // URL ảnh do người dùng hoặc nhà cung cấp đăng nhập thiết lập.
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={profile.avatarUrl}
                alt={`Ảnh đại diện của ${profile.displayName}`}
                className="size-[200px] rounded-full border border-charcoal/15 object-cover"
            />
        );
    }
    return (
        <span className="flex size-[200px] items-center justify-center rounded-full bg-green text-3xl font-semibold text-cream">
            {initials(profile.displayName)}
        </span>
    );
}

export default function ProfileScreen({
    root,
    username,
}: {
    root: ShellRoot;
    username?: string;
}): JSX.Element {
    const dispatch = useAppDispatch();
    const own = username === undefined;
    const [profile, setProfile] = useState<Profile | null>(null);
    const [draft, setDraft] = useState<ProfileInput>(EMPTY);
    const [editing, setEditing] = useState(false);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState("");
    const [postedTick, setPostedTick] = useState(0);

    useEffect(() => {
        let active = true;
        const request = own ? getOwnProfile() : getPublicProfile(username ?? "");
        void request
            .then((next) => {
                if (!active) return;
                setProfile(next);
                setDraft({
                    displayName: next.displayName,
                    username: next.username ?? "",
                    avatarUrl: next.avatarUrl ?? "",
                    city: next.city ?? "",
                    bio: next.bio,
                });
            })
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(
                    error instanceof AuthApiError
                        ? error.message
                        : "Chưa tải được hồ sơ.",
                );
            });
        return () => {
            active = false;
        };
    }, [own, username]);

    function update<Key extends keyof ProfileInput>(
        key: Key,
        value: ProfileInput[Key],
    ): void {
        setDraft((current) => ({ ...current, [key]: value }));
    }

    async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setPending(true);
        setMessage("");
        try {
            const next = await updateOwnProfile(draft);
            setProfile(next);
            setEditing(false);
            setMessage("Đã cập nhật hồ sơ.");
            dispatch(
                profileUpdated({
                    displayName: next.displayName,
                    avatarUrl: next.avatarUrl,
                }),
            );
        } catch (error) {
            setMessage(
                error instanceof AuthApiError
                    ? error.message
                    : "Chưa cập nhật được hồ sơ.",
            );
        } finally {
            setPending(false);
        }
    }

    if (!profile) {
        return (
            <main className="box-border h-full overflow-auto px-4 py-8 sm:px-8">
                <p role={message ? "alert" : "status"} className="m-0 text-sm">
                    {message || "Đang tải hồ sơ…"}
                </p>
            </main>
        );
    }

    return (
        <main className="box-border h-full overflow-auto px-4 py-8 sm:px-8">
            <div className="mx-auto w-full max-w-5xl">
                <header className="border-b border-charcoal/15">
                    <form className="flex flex-col md:flex-row" onSubmit={save}>
                        <div className="flex shrink-0 justify-center p-6 md:p-10">
                            <Avatar profile={editing ? { ...profile, avatarUrl: draft.avatarUrl || null, displayName: draft.displayName || profile.displayName } : profile} />
                        </div>
                        <div className="min-w-0 flex-1 border-t border-charcoal/15 px-4 py-5 md:border-t-0 md:border-l md:px-7">
                            <div className="mb-2 flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    {editing ? (
                                        <input
                                            className={`${AUTH_FIELD_CLASS} text-2xl font-medium`}
                                            value={draft.displayName}
                                            maxLength={100}
                                            autoComplete="name"
                                            aria-label="Tên hiển thị"
                                            required
                                            onChange={(event) => update("displayName", event.target.value)}
                                        />
                                    ) : (
                                        <h1 className="m-0 truncate text-3xl font-medium">
                                            {profile.displayName}
                                        </h1>
                                    )}
                                </div>
                                {editing ? null : (
                                    <span className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border border-charcoal/20 px-3 text-xs font-semibold">
                                        {profile.role === "admin" ? (
                                            <ShieldCheck className="size-3.5" aria-hidden="true" />
                                        ) : (
                                            <UserRound className="size-3.5" aria-hidden="true" />
                                        )}
                                        {profile.role === "admin" ? "Quản trị viên" : "Thành viên"}
                                    </span>
                                )}
                                {own && !editing ? (
                                    <button
                                        type="button"
                                        className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-current bg-transparent px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                        onClick={() => setEditing(true)}
                                    >
                                        <Pencil className="size-4" aria-hidden="true" />
                                        Cập nhật hồ sơ
                                    </button>
                                ) : null}
                                {own && editing ? (
                                    <>
                                        <button
                                            type="submit"
                                            className="inline-flex min-h-11 shrink-0 items-center border border-current bg-green px-4 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-60"
                                            disabled={pending}
                                        >
                                            {pending ? "Đang lưu…" : "Lưu"}
                                        </button>
                                        <button
                                            type="button"
                                            className="inline-flex min-h-11 shrink-0 items-center border border-current bg-transparent px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                            onClick={() => {
                                                setEditing(false);
                                                setDraft({
                                                    displayName: profile.displayName,
                                                    username: profile.username ?? "",
                                                    avatarUrl: profile.avatarUrl ?? "",
                                                    city: profile.city ?? "",
                                                    bio: profile.bio,
                                                });
                                                setMessage("");
                                            }}
                                        >
                                            Hủy
                                        </button>
                                    </>
                                ) : null}
                            </div>

                            {editing ? (
                                <label className="mb-2 flex items-center gap-2 text-sm text-charcoal/70">
                                    <span className="shrink-0">Username</span>
                                    <span className="relative min-w-0 flex-1">
                                        <AtSign className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-charcoal/55" aria-hidden="true" />
                                        <input
                                            className={`${AUTH_FIELD_CLASS} pl-9`}
                                            value={draft.username}
                                            minLength={3}
                                            maxLength={40}
                                            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                                            aria-label="Username"
                                            required
                                            onChange={(event) => update("username", event.target.value.toLowerCase())}
                                        />
                                    </span>
                                </label>
                            ) : (
                                <p className="mt-1 mb-2 text-charcoal/70">@{profile.username ?? "chưa-có-username"}</p>
                            )}

                            <FollowSummary userId={profile.userId} root={root === "/admin" ? "/admin" : "/app"} own={own} />

                            {editing ? (
                                <>
                                    <label className="mb-2 flex items-center gap-2 text-sm text-charcoal/70">
                                        <span className="shrink-0">Ảnh đại diện</span>
                                        <span className="min-w-0 flex-1">
                                            <input
                                                className={AUTH_FIELD_CLASS}
                                                value={draft.avatarUrl}
                                                maxLength={512}
                                                placeholder="/images/anh-dai-dien.jpg"
                                                aria-label="Ảnh đại diện"
                                                onChange={(event) => update("avatarUrl", event.target.value)}
                                            />
                                        </span>
                                    </label>
                                    <label className="mb-2 flex items-center gap-2 text-sm text-charcoal/70">
                                        <MapPin className="size-4 shrink-0" aria-hidden="true" />
                                        <span className="min-w-0 flex-1">
                                            <input
                                                className={AUTH_FIELD_CLASS}
                                                value={draft.city}
                                                maxLength={120}
                                                placeholder="Hà Nội"
                                                aria-label="Khu vực"
                                                onChange={(event) => update("city", event.target.value)}
                                            />
                                        </span>
                                    </label>
                                </>
                            ) : (
                                <div className="mt-2">
                                    {own && profile.email ? (
                                        <p className="mb-2 flex items-center gap-2 text-sm text-charcoal/70">
                                            <Mail className="size-4 shrink-0" aria-hidden="true" />
                                            <span className="truncate">{profile.email}</span>
                                        </p>
                                    ) : null}
                                    {profile.city ? (
                                        <p className="mb-2 flex items-center gap-2 text-sm text-charcoal/70">
                                            <MapPin className="size-4 shrink-0" aria-hidden="true" />
                                            <span className="truncate">{profile.city}</span>
                                        </p>
                                    ) : null}
                                    <p className="mb-2 flex items-center gap-2 text-sm text-charcoal/70">
                                        <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                                        <span className="truncate">Tham gia từ {joinedLabel(profile.joinedAt)}</span>
                                    </p>
                                </div>
                            )}

                            <section className="mt-6 rounded-md border border-charcoal/15 bg-cream/60 p-5" aria-labelledby="gioi-thieu">
                                <h2 id="gioi-thieu" className="m-0 text-xl font-semibold">
                                    Giới thiệu
                                </h2>
                                {editing ? (
                                    <>
                                        <textarea
                                            className={`${AUTH_FIELD_CLASS} mt-3 min-h-32 bg-white py-3`}
                                            value={draft.bio}
                                            maxLength={500}
                                            placeholder="Giới thiệu"
                                            aria-label="Giới thiệu"
                                            onChange={(event) => update("bio", event.target.value)}
                                        />
                                        <span className="mt-1 block text-right text-xs text-charcoal/65">{draft.bio?.length ?? 0}/500</span>
                                    </>
                                ) : (
                                    <p className="mt-2 mb-0 whitespace-pre-wrap leading-7">
                                        {profile.bio ||
                                            (own
                                                ? "Thêm vài dòng để mọi người hiểu bạn đang quan tâm tới loại bất động sản nào."
                                                : "Người dùng chưa thêm phần giới thiệu.")}
                                    </p>
                                )}
                            </section>
                        </div>
                    </form>
                </header>

                {message ? (
                    <p
                        role={message.startsWith("Đã ") ? "status" : "alert"}
                        className="mt-6 mb-0 text-sm"
                    >
                        {message}
                    </p>
                ) : null}

                {own ? <ProfileForumPost root={root} onPosted={() => setPostedTick((current) => current + 1)} /> : null}

                {profile.username ? (
                    <ProfilePosts username={profile.username} root={root} reloadKey={postedTick} />
                ) : null}

                {own && root === "/app" && profile.username ? (
                    <p className="mt-8 mb-0 border-t border-charcoal/15 pt-6 text-sm">
                        <Link
                            href={`/app/profile/${profile.username}`}
                            className="font-semibold underline underline-offset-4"
                        >
                            Xem hồ sơ công khai
                        </Link>
                    </p>
                ) : null}
            </div>
        </main>
    );
}
