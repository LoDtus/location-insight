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
                className="size-32 rounded-full border border-charcoal/15 object-cover sm:size-40"
            />
        );
    }
    return (
        <span className="flex size-32 items-center justify-center rounded-full bg-green text-3xl font-semibold text-cream sm:size-40">
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
                <header className="grid gap-6 border-b border-charcoal/15 pb-8 md:grid-cols-[12rem_minmax(0,1fr)]">
                    <div className="flex justify-center md:justify-start">
                        <Avatar profile={profile} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="m-0 text-3xl font-semibold">
                                        {profile.displayName}
                                    </h1>
                                    <span className="inline-flex min-h-7 items-center gap-1 rounded-full border border-charcoal/20 px-3 text-xs font-semibold">
                                        {profile.role === "admin" ? (
                                            <ShieldCheck
                                                className="size-3.5"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <UserRound
                                                className="size-3.5"
                                                aria-hidden="true"
                                            />
                                        )}
                                        {profile.role === "admin"
                                            ? "Quản trị viên"
                                            : "Thành viên"}
                                    </span>
                                </div>
                                <p className="mt-2 mb-0 text-charcoal/70">
                                    @{profile.username ?? "chưa-có-username"}
                                </p>
                            </div>
                            {own && !editing ? (
                                <button
                                    type="button"
                                    className="inline-flex min-h-11 w-auto items-center gap-2 border border-current bg-transparent px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                    onClick={() => setEditing(true)}
                                >
                                    <Pencil className="size-4" aria-hidden="true" />
                                    Cập nhật hồ sơ
                                </button>
                            ) : null}
                        </div>

                        <FollowSummary userId={profile.userId} root={root === "/admin" ? "/admin" : "/app"} own={own} />

                        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-charcoal/75">
                            {own && profile.email ? (
                                <span className="inline-flex items-center gap-2">
                                    <Mail className="size-4" aria-hidden="true" />
                                    {profile.email}
                                </span>
                            ) : null}
                            {profile.city ? (
                                <span className="inline-flex items-center gap-2">
                                    <MapPin className="size-4" aria-hidden="true" />
                                    {profile.city}
                                </span>
                            ) : null}
                            <span className="inline-flex items-center gap-2">
                                <CalendarDays className="size-4" aria-hidden="true" />
                                Tham gia từ {joinedLabel(profile.joinedAt)}
                            </span>
                        </div>
                        <section className="mt-6 max-w-2xl" aria-labelledby="gioi-thieu">
                            <h2 id="gioi-thieu" className="m-0 text-lg font-semibold">
                                Giới thiệu
                            </h2>
                            <p className="mt-2 mb-0 whitespace-pre-wrap leading-7">
                                {profile.bio ||
                                    (own
                                        ? "Thêm vài dòng để mọi người hiểu bạn đang quan tâm tới loại bất động sản nào."
                                        : "Người dùng chưa thêm phần giới thiệu.")}
                            </p>
                        </section>
                    </div>
                </header>

                {own && editing ? (
                    <form
                        className="mt-8 grid max-w-3xl gap-5"
                        onSubmit={save}
                    >
                        <div>
                            <h2 className="m-0 text-xl font-semibold">
                                Thông tin hồ sơ
                            </h2>
                            <p className="mt-1 mb-0 text-sm text-charcoal/70">
                                Tên, username, khu vực và giới thiệu có thể xuất hiện
                                trên hồ sơ công khai.
                            </p>
                        </div>
                        <label className="grid gap-1.5 text-sm font-semibold">
                            Tên hiển thị
                            <input
                                className={AUTH_FIELD_CLASS}
                                value={draft.displayName}
                                maxLength={100}
                                autoComplete="name"
                                required
                                onChange={(event) =>
                                    update("displayName", event.target.value)
                                }
                            />
                        </label>
                        <label className="grid gap-1.5 text-sm font-semibold">
                            Username
                            <span className="text-xs font-normal text-charcoal/65">
                                Dùng chữ thường, số và dấu gạch ngang.
                            </span>
                            <div className="relative">
                                <AtSign
                                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-charcoal/55"
                                    aria-hidden="true"
                                />
                                <input
                                    className={`${AUTH_FIELD_CLASS} pl-9`}
                                    value={draft.username}
                                    minLength={3}
                                    maxLength={40}
                                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                                    required
                                    onChange={(event) =>
                                        update(
                                            "username",
                                            event.target.value.toLowerCase(),
                                        )
                                    }
                                />
                            </div>
                        </label>
                        <label className="grid gap-1.5 text-sm font-semibold">
                            Ảnh đại diện
                            <span className="text-xs font-normal text-charcoal/65">
                                URL https hoặc ảnh trong thư mục /images/.
                            </span>
                            <input
                                className={AUTH_FIELD_CLASS}
                                value={draft.avatarUrl}
                                maxLength={512}
                                placeholder="/images/anh-dai-dien.jpg"
                                onChange={(event) =>
                                    update("avatarUrl", event.target.value)
                                }
                            />
                        </label>
                        <label className="grid gap-1.5 text-sm font-semibold">
                            Khu vực
                            <input
                                className={AUTH_FIELD_CLASS}
                                value={draft.city}
                                maxLength={120}
                                placeholder="Hà Nội"
                                onChange={(event) =>
                                    update("city", event.target.value)
                                }
                            />
                        </label>
                        <label className="grid gap-1.5 text-sm font-semibold">
                            Giới thiệu
                            <textarea
                                className={`${AUTH_FIELD_CLASS} min-h-32 py-3`}
                                value={draft.bio}
                                maxLength={500}
                                placeholder="Bạn đang tìm kiếm hoặc chia sẻ điều gì?"
                                onChange={(event) =>
                                    update("bio", event.target.value)
                                }
                            />
                            <span className="text-right text-xs font-normal text-charcoal/65">
                                {draft.bio?.length ?? 0}/500
                            </span>
                        </label>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="submit"
                                className={AUTH_BUTTON_CLASS}
                                disabled={pending}
                            >
                                {pending ? "Đang lưu…" : "Lưu thay đổi"}
                            </button>
                            <button
                                type="button"
                                className={`${AUTH_BUTTON_CLASS} bg-transparent text-charcoal`}
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
                        </div>
                    </form>
                ) : null}

                {message ? (
                    <p
                        role={message.startsWith("Đã ") ? "status" : "alert"}
                        className="mt-6 mb-0 text-sm"
                    >
                        {message}
                    </p>
                ) : null}

                {profile.username ? (
                    <ProfilePosts username={profile.username} root={root} reloadKey={postedTick} />
                ) : null}

                {own ? <ProfileForumPost root={root} onPosted={() => setPostedTick((current) => current + 1)} /> : null}

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
