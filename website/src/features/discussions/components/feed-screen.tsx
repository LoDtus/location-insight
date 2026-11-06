"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import { AuthApiError } from "@/features/auth/auth.api";
import { useAuth } from "@/features/auth/use-auth";
import {
    createPost,
    createTopic,
    deletePost,
    likePost,
    listBookmarks,
    listPosts,
    listTopics,
    slugifyTopic,
    topicFeed,
    unlikePost,
    uploadDiscussionFile,
    type DiscussionPost,
    type DiscussionTopic,
} from "@/features/discussions/discussions.api";
import { PostCard } from "@/features/discussions/components/post-card";
import { useAuthorPresence } from "@/features/discussions/components/use-author-presence";
import { usePostActions } from "@/features/discussions/components/use-post-actions";
import { PostComposer } from "@/features/discussions/components/post-composer";
import { ALL_FEED, readFeedView, writeFeedView, type FeedView } from "@/features/discussions/feed-params";
import { SharePostDialog } from "@/features/messaging/components/share-post-dialog";
import { getConfirmModal } from "@/shared/utils/confirm.utils";

export function FeedScreen({ root }: { root: ShellRoot }): JSX.Element {
    const auth = useAuth();
    const router = useRouter();
    const scroller = useRef<HTMLElement>(null);
    const sentinel = useRef<HTMLDivElement>(null);
    const loadingMore = useRef(false);
    const [topics, setTopics] = useState<DiscussionTopic[]>([]);
    const [posts, setPosts] = useState<DiscussionPost[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [filter, setFilter] = useState("");
    const [scope, setScope] = useState<FeedView["scope"]>("all");
    const [topicSlug, setTopicSlug] = useState("");
    const [newTopic, setNewTopic] = useState("");
    const [body, setBody] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [quote, setQuote] = useState<DiscussionPost | null>(null);
    const [message, setMessage] = useState("");
    const [sharing, setSharing] = useState<DiscussionPost | null>(null);
    const [pending, setPending] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadFirst = useCallback(async (nextFilter: string, nextScope: FeedView["scope"] = "all"): Promise<void> => {
        const [topicPage, postPage] = await Promise.all([
            listTopics(),
            nextScope === "following"
                ? listPosts(undefined, "following")
                : nextScope === "saved"
                  ? listBookmarks()
                  : nextFilter
                    ? topicFeed(nextFilter)
                    : listPosts(),
        ]);
        setTopics(topicPage.items.filter((topic) => topic.status === "open"));
        setPosts(postPage.items);
        setCursor(postPage.nextCursor);
        setTopicSlug((current) => current || topicPage.items.find((topic) => topic.status === "open")?.slug || "");
    }, []);

    useEffect(() => {
        // Bộ lọc nằm trên URL để chia sẻ được; đọc một lần khi vào trang.
        const initial = readFeedView(window.location.search);
        setFilter(initial.topic);
        setScope(initial.scope);
        let active = true;
        void loadFirst(initial.topic, initial.scope)
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được diễn đàn.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [loadFirst]);

    const loadMore = useCallback(async (): Promise<void> => {
        if (!cursor || loadingMore.current) return;
        loadingMore.current = true;
        try {
            const page =
                scope === "following"
                    ? await listPosts(cursor, "following")
                    : scope === "saved"
                      ? await listBookmarks(cursor)
                      : filter
                      ? await topicFeed(filter, cursor)
                      : await listPosts(cursor);
            setPosts((current) => {
                const seen = new Set(current.map((item) => item.id));
                return [...current, ...page.items.filter((item) => !seen.has(item.id))];
            });
            setCursor(page.nextCursor);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa tải thêm được.");
        } finally {
            loadingMore.current = false;
        }
    }, [cursor, filter, scope]);

    useEffect(() => {
        const root = scroller.current;
        const target = sentinel.current;
        if (!root || !target || !cursor) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) void loadMore();
            },
            { root, rootMargin: "240px" },
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [cursor, loadMore]);

    /** Đổi bộ lọc: ghi lên URL bằng replaceState (không thêm mục lịch sử) rồi tải lại trang đầu. */
    function choose(view: FeedView): void {
        setFilter(view.topic);
        setScope(view.scope);
        const query = writeFeedView(window.location.search, view);
        window.history.replaceState(null, "", `${window.location.pathname}${query}${window.location.hash}`);
        void loadFirst(view.topic, view.scope).catch((error: unknown) => {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa tải được.");
        });
    }

    async function publish(): Promise<void> {
        const images = files.filter((file) => file.type.startsWith("image/"));
        const videos = files.filter((file) => file.type === "video/mp4");
        if (videos.length > 1 || (videos.length > 0 && images.length > 0) || images.length > 4) {
            setMessage("Một bài chỉ có 4 ảnh hoặc một video.");
            return;
        }
        setPending(true);
        setMessage("");
        try {
            let slug = topicSlug;
            const named = newTopic.trim();
            if (named) {
                const nextSlug = slugifyTopic(named);
                if (nextSlug.length < 3) {
                    setMessage("Tên chủ đề cần ra được slug ít nhất 3 ký tự.");
                    return;
                }
                const topic = await createTopic({ name: named, slug: nextSlug });
                slug = topic.slug;
                setTopics((current) => [topic, ...current]);
                setTopicSlug(topic.slug);
                setNewTopic("");
            }
            if (!slug) {
                setMessage("Hãy chọn hoặc tạo một chủ đề.");
                return;
            }
            const text = quote
                ? `${body.trim()}\n\nTrích ${quote.authorName}: ${quote.body}`.trim()
                : body.trim();
            const mediaIds: string[] = [];
            for (const file of files) mediaIds.push(await uploadDiscussionFile(file));
            const post = await createPost({ topicSlug: slug, kind: "note", body: text, mediaIds });
            setBody("");
            setFiles([]);
            setQuote(null);
            if (!filter || filter === slug) setPosts((current) => [post, ...current]);
        } catch (error) {
            setMessage(error instanceof AuthApiError ? error.message : "Chưa đăng được bài.");
        } finally {
            setPending(false);
        }
    }

    async function toggleLike(post: DiscussionPost): Promise<void> {
        const next = post.likedByMe ? await unlikePost(post.id) : await likePost(post.id);
        setPosts((current) =>
            current.map((item) =>
                item.id === post.id ? { ...item, likeCount: next.likeCount, likedByMe: !post.likedByMe } : item,
            ),
        );
    }

    async function repost(post: DiscussionPost): Promise<void> {
        const created = await createPost({
            topicSlug: post.topicSlug,
            kind: "note",
            body: `Đăng lại từ @${post.authorUsername ?? post.authorName}:\n${post.body}`,
        });
        if (!filter || filter === post.topicSlug) setPosts((current) => [created, ...current]);
        setMessage("Đã đăng lại.");
    }

    const online = useAuthorPresence(posts.map((post) => post.authorId));
    const actions = usePostActions({
        root,
        onSaved: (postId, value) =>
            setPosts((current) =>
                // Ở mục "Đã lưu", bỏ lưu thì bài rời khỏi danh sách.
                scope === "saved" && !value
                    ? current.filter((item) => item.id !== postId)
                    : current.map((item) => (item.id === postId ? { ...item, savedByMe: value } : item)),
            ),
        onBlocked: (authorId) => setPosts((current) => current.filter((item) => item.authorId !== authorId)),
    });

    return (
        <main ref={scroller} className="h-full overflow-auto bg-white">
            {/* Viền hai bên chỉ khi cột đã chạm max-w-960 của FocusLayout (3840px) cộng sidebar mở rộng (272px);
                hẹp hơn thì cột sát sidebar và mép màn, viền sẽ chồng lên viền của hàng xóm. */}
            {/* Cột nội dung thu vào giữa (rộng tối đa ~680 px như các mạng xã hội), không viền hai bên. */}
            <div className="mx-auto min-h-full w-full max-w-[680px] bg-white">
                <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-charcoal/10 bg-white px-4 py-3">
                    <TopicTab
                        label="Mới nhất"
                        current={filter === "" && scope === "all"}
                        onClick={() => choose(ALL_FEED)}
                    />
                    <TopicTab
                        label="Đang theo dõi"
                        current={scope === "following"}
                        onClick={() => choose({ scope: "following", topic: "" })}
                    />
                    <TopicTab label="Đã lưu" current={scope === "saved"} onClick={() => choose({ scope: "saved", topic: "" })} />
                    {topics.map((topic) => (
                        <TopicTab
                            key={topic.id}
                            label={topic.name}
                            current={filter === topic.slug && scope === "all"}
                            onClick={() => choose({ scope: "all", topic: topic.slug })}
                        />
                    ))}
                </div>
                <PostComposer
                    displayName={auth.user?.displayName ?? "Bạn"}
                    avatarUrl={auth.user?.avatarUrl}
                    placeholder="Có gì mới?"
                    body={body}
                    onBody={setBody}
                    topics={topics}
                    topicSlug={topicSlug}
                    onTopic={setTopicSlug}
                    newTopic={newTopic}
                    onNewTopic={setNewTopic}
                    files={files}
                    onFiles={setFiles}
                    pending={pending}
                    quote={quote ? { author: quote.authorName, body: quote.body } : null}
                    onClearQuote={() => setQuote(null)}
                    onSubmit={() => void publish()}
                />
                {message ? (
                    <p role="status" className="m-0 border-t border-charcoal/10 px-4 py-3 text-sm">
                        {message}
                    </p>
                ) : null}
                {loading ? <p className="m-0 px-4 py-8 text-sm">Đang tải diễn đàn.</p> : null}
                {!loading && posts.length === 0 ? (
                    <p className="m-0 px-4 py-8 text-sm">
                        {scope === "following"
                            ? "Hãy theo dõi vài người để thấy bài của họ ở đây."
                            : scope === "saved"
                              ? "Chưa lưu bài nào. Bấm biểu tượng dấu trang ở một bài để đọc lại sau."
                              : "Chưa có bài trong mục này. Hãy viết điều bạn đang thắc mắc."}
                    </p>
                ) : null}
                {/* Một đường kẻ giữa các bài (và một đường ngăn với ô soạn bài). */}
                <ol className="m-0 list-none divide-y divide-charcoal/10 border-t border-charcoal/10 p-0">
                    {posts.map((post) => (
                        <li key={post.id}>
                            <PostCard
                                online={online ? online.has(post.authorId) : undefined}
                                onTopic={(slug) => {
                                    choose({ scope: "all", topic: slug });
                                    scroller.current?.scrollTo({ top: 0 });
                                }}
                                post={post}
                                root={root}
                                connected={false}
                                mine={auth.user?.userId === post.authorId}
                                onLike={() => void toggleLike(post).catch(() => setMessage("Chưa thích được."))}
                                onReply={() => router.push(`${root}/feed/${post.id}`)}
                                onRepost={() => void repost(post).catch(() => setMessage("Chưa đăng lại được."))}
                                onQuote={() => {
                                    setQuote(post);
                                    scroller.current?.scrollTo({ top: 0 });
                                }}
                                onShare={() => (setSharing(post))}
                                onSave={() => actions.toggleSave(post)}
                                onReport={() => actions.report(post)}
                                onBlock={() => actions.block(post)}
                                onCopyLink={() => actions.copyLink(post)}
                                onDelete={() => {
                                    void getConfirmModal({
                                        title: "Xóa bài",
                                        content: "Bài này sẽ không còn hiện trên diễn đàn.",
                                        okText: "Xóa",
                                        cancelText: "Huỷ",
                                    }).then((accepted) => {
                                        if (!accepted) return;
                                        void deletePost(post.id)
                                            .then(() => setPosts((current) => current.filter((item) => item.id !== post.id)))
                                            .catch(() => setMessage("Chưa xóa được."));
                                    });
                                }}
                            />
                        </li>
                    ))}
                </ol>
                <div ref={sentinel} className="h-16" />
            </div>
            {actions.dialog}
            {sharing ? (
                <SharePostDialog
                    postId={sharing.id}
                    link={`${window.location.origin}${root}/feed/${sharing.id}`}
                    onClose={() => setSharing(null)}
                    onDone={(text) => {
                        setSharing(null);
                        setMessage(text);
                    }}
                />
            ) : null}
        </main>
    );
}

function TopicTab({
    label,
    current,
    onClick,
}: {
    label: string;
    current: boolean;
    onClick: () => void;
}): JSX.Element {
    return (
        <button
            type="button"
            className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green ${current ? "bg-green text-cream" : "text-charcoal hover:bg-charcoal/5"}`}
            aria-current={current ? "page" : undefined}
            onClick={onClick}
        >
            {label}
        </button>
    );
}
