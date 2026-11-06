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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FollowSummary } from "@/features/follow/components/follow-summary";
import { Suspense, useEffect, useRef, useState, type FormEvent, type JSX } from "react";

import { AUTH_BUTTON_CLASS, AUTH_FIELD_CLASS } from "@/app/auth/form-class";
import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import { profileUpdated } from "@/features/auth/auth.slice";
import { useAuth } from "@/features/auth/use-auth";
import { AvatarCropDialog } from "@/features/profile/components/avatar-crop-dialog";
import { ProfileForumPost } from "@/features/profile/components/profile-forum-post";
import { ProfilePosts } from "@/features/profile/components/profile-posts";
import {
    getOwnProfile,
    getProfileById,
    getPublicProfile,
    getSharedAvatar,
    updateOwnProfile,
    uploadAvatar,
    type Profile,
    type ProfileInput,
    type SharedAvatar,
} from "@/features/profile/profile.api";
import { avatarFileId, isUuid, profileHref } from "@/features/profile/profile-path";
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

function AvatarViewer({
    src,
    name,
    message,
    onClose,
}: {
    src: string | null;
    name: string;
    message?: string;
    onClose: () => void;
}): JSX.Element {
    useEffect(() => {
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/80 p-6"
            role="dialog"
            aria-modal="true"
            aria-label={name ? `Ảnh đại diện của ${name}` : "Ảnh đại diện"}
            onClick={onClose}
        >
            <button
                type="button"
                className="absolute top-4 right-4 inline-flex min-h-11 items-center px-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={onClose}
            >
                Đóng
            </button>
            {src ? (
                // Ảnh đã lưu của hồ sơ, phóng lớn để xem đủ khung.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src}
                    alt={name ? `Ảnh đại diện của ${name}` : "Ảnh đại diện"}
                    className="max-h-[80vh] max-w-[80vw] object-contain"
                    onClick={(event) => event.stopPropagation()}
                />
            ) : (
                <p className="m-0 text-sm text-white" role="status">
                    {message || "Đang mở ảnh…"}
                </p>
            )}
        </div>
    );
}

function ProfileScreenContent({
    root,
    username,
    userId,
}: {
    root: ShellRoot;
    username?: string;
    userId?: string;
}): JSX.Element {
    const dispatch = useAppDispatch();
    const auth = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const own = username === undefined && userId === undefined;
    const [profile, setProfile] = useState<Profile | null>(null);
    const [draft, setDraft] = useState<ProfileInput>(EMPTY);
    const [editing, setEditing] = useState(false);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState("");
    const [postedTick, setPostedTick] = useState(0);
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [avatarPending, setAvatarPending] = useState(false);
    const [shared, setShared] = useState<SharedAvatar | null>(null);
    const [sharedNote, setSharedNote] = useState("");
    const [localPreview, setLocalPreview] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const avatarParam = searchParams.get("avatar");

    useEffect(() => {
        let active = true;
        const request = userId
            ? getProfileById(userId)
            : own
              ? getOwnProfile()
              : getPublicProfile(username ?? "");
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
    }, [own, username, userId]);

    useEffect(() => {
        if (!avatarParam) {
            setShared(null);
            setSharedNote("");
            return;
        }
        if (!isUuid(avatarParam)) {
            setShared(null);
            setSharedNote("Không tìm thấy ảnh đại diện.");
            return;
        }
        let active = true;
        setShared(null);
        setSharedNote("");
        void getSharedAvatar(avatarParam)
            .then((next) => {
                if (active) setShared(next);
            })
            .catch((error: unknown) => {
                if (!active) return;
                setShared(null);
                setSharedNote(
                    error instanceof AuthApiError
                        ? error.message
                        : "Không tìm thấy ảnh đại diện.",
                );
            });
        return () => {
            active = false;
        };
    }, [avatarParam]);

    function closeSharedAvatar(): void {
        if (!shared) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("avatar");
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
            return;
        }
        const mine = shared.userId === auth.user?.userId;
        if (mine) {
            router.replace(auth.user?.role === "admin" ? "/admin/profile" : "/app/profile");
            return;
        }
        router.replace(
            shared.username
                ? profileHref("/app", shared.username)
                : `/app/profile/${shared.userId}`,
        );
    }

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
                    username: next.username,
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
            <main className="box-border h-full overflow-auto">
                <p role={message ? "alert" : "status"} className="m-0 px-4 py-8 text-sm">
                    {message || "Đang tải hồ sơ…"}
                </p>
                {avatarParam && !editing ? (
                    <AvatarViewer
                        src={shared?.avatarUrl ?? null}
                        name={shared?.displayName ?? ""}
                        message={sharedNote}
                        onClose={closeSharedAvatar}
                    />
                ) : null}
            </main>
        );
    }

    return (
        <main className="box-border h-full overflow-auto">
            <header className="border-b border-charcoal/15">
                    <form className="flex flex-col md:flex-row md:items-center" onSubmit={save}>
                        <div className="flex shrink-0 justify-center self-center p-6 md:p-10">
                            <AvatarControl
                                profile={editing ? { ...profile, avatarUrl: draft.avatarUrl || null, displayName: draft.displayName || profile.displayName } : profile}
                                editing={own && editing}
                                pending={avatarPending}
                                onView={() => {
                                    const fileId = avatarFileId(profile.avatarUrl);
                                    if (!fileId) {
                                        if (profile.avatarUrl) setLocalPreview(profile.avatarUrl);
                                        return;
                                    }
                                    router.push(`/app/profile?avatar=${fileId}`);
                                }}
                                onChange={() => fileRef.current?.click()}
                            />
                            {own ? (
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="sr-only"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        event.target.value = "";
                                        if (!file) return;
                                        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
                                            setMessage("Ảnh cần là JPEG, PNG hoặc WebP và không quá 8 MB.");
                                            return;
                                        }
                                        setCropSrc((current) => {
                                            if (current) URL.revokeObjectURL(current);
                                            return URL.createObjectURL(file);
                                        });
                                    }}
                                />
                            ) : null}
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
                                        onClick={() => {
                                            setEditing(true);
                                            if (!searchParams.get("avatar")) return;
                                            const params = new URLSearchParams(searchParams.toString());
                                            params.delete("avatar");
                                            const query = params.toString();
                                            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
                                        }}
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

                            <section className="mt-6 rounded-md border border-charcoal/15 bg-white p-5" aria-labelledby="gioi-thieu">
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

            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
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
                            href={profileHref("/app", profile.username)}
                            className="font-semibold underline underline-offset-4"
                        >
                            Xem hồ sơ công khai
                        </Link>
                    </p>
                ) : null}
            </div>
            {cropSrc ? (
                <AvatarCropDialog
                    src={cropSrc}
                    pending={avatarPending}
                    onCancel={() => {
                        if (avatarPending) return;
                        URL.revokeObjectURL(cropSrc);
                        setCropSrc(null);
                    }}
                    onConfirm={(file) => {
                        setAvatarPending(true);
                        setMessage("");
                        void uploadAvatar(file)
                            .then((next) => {
                                setProfile(next);
                                setDraft((current) => ({ ...current, avatarUrl: next.avatarUrl ?? "" }));
                                dispatch(profileUpdated({ displayName: next.displayName, avatarUrl: next.avatarUrl, username: next.username }));
                                setMessage("Đã cập nhật ảnh đại diện.");
                                URL.revokeObjectURL(cropSrc);
                                setCropSrc(null);
                            })
                            .catch((error: unknown) => {
                                setMessage(error instanceof AuthApiError ? error.message : "Chưa cập nhật được ảnh đại diện.");
                            })
                            .finally(() => setAvatarPending(false));
                    }}
                />
            ) : null}
            {avatarParam && !editing ? (
                <AvatarViewer
                    src={shared?.avatarUrl ?? null}
                    name={shared?.displayName ?? ""}
                    message={sharedNote}
                    onClose={closeSharedAvatar}
                />
            ) : null}
            {localPreview ? (
                <AvatarViewer
                    src={localPreview}
                    name={profile.displayName}
                    onClose={() => setLocalPreview(null)}
                />
            ) : null}
        </main>
    );
}

function AvatarControl({
    profile,
    editing,
    pending,
    onView,
    onChange,
}: {
    profile: Profile;
    editing: boolean;
    pending: boolean;
    onView: () => void;
    onChange: () => void;
}): JSX.Element {
    const canChange = editing;
    const canView = !editing && Boolean(profile.avatarUrl);
    if (!canChange && !canView) return <Avatar profile={profile} />;
    const label = canChange ? "Thay đổi ảnh đại diện" : "Xem chi tiết";
    return (
        <button
            type="button"
            className="group relative rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
            aria-label={label}
            disabled={pending}
            onClick={canChange ? onChange : onView}
        >
            <Avatar profile={profile} />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-charcoal/60 px-4 text-center text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {label}
            </span>
        </button>
    );
}

export default function ProfileScreen(props: {
    root: ShellRoot;
    username?: string;
    userId?: string;
}): JSX.Element {
    return (
        <Suspense
            fallback={
                <main className="box-border h-full overflow-auto">
                    <p role="status" className="m-0 px-4 py-8 text-sm">
                        Đang tải hồ sơ…
                    </p>
                </main>
            }
        >
            <ProfileScreenContent {...props} />
        </Suspense>
    );
}
