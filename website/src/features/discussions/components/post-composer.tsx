"use client";

import {
    Bold,
    CalendarClock,
    ChevronRight,
    Film,
    ImagePlus,
    Italic,
    Link2,
    Loader2,
    MapPin,
    MoreHorizontal,
    Quote,
    Smile,
    Strikethrough,
    Underline,
    X,
} from "lucide-react";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useId, useRef, useState, type JSX, type ReactNode } from "react";

import {
    DEFAULT_POST_SETTINGS,
    POST_VISIBILITIES,
    type DiscussionTopic,
    type PostSettings,
} from "@/features/discussions/discussions.api";
import { docToMarkup, markupToDoc } from "@/features/discussions/post-editor-doc";
import { isAbortError, resolvePlace, searchPlaces } from "@/features/map/map.service";
import type { MapSuggestion } from "@/features/map/map.types";

/** Giới hạn khớp backend (cột varchar(2000), tối đa 10 ảnh/video, ảnh 8 MB, video 50 MB). */
export const BODY_MAX = 2000;
export const MEDIA_MAX = 10;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4";

export interface ComposerDraft {
    body: string;
    files: File[];
    /** Tên chủ đề người dùng gõ; rỗng = "Thảo luận chung". */
    topicName: string;
    settings: PostSettings;
    /** ISO hoặc null (đăng ngay). */
    publishAt: string | null;
}

const EMOJIS = [
    "😀", "😂", "🥲", "😍", "🤔", "😮", "😢", "😡", "👍", "👎", "👏", "🙏", "💪", "🔥", "✨", "🎉",
    "❤️", "💚", "💯", "✅", "❌", "⚠️", "📍", "🏠", "🏢", "🏡", "🏗️", "🌳", "🌊", "🚇", "🚌", "🚗",
    "🛵", "🏫", "🏥", "🛒", "☕", "🍜", "💰", "📈", "📉", "🔑", "📄", "📷",
];

const TOOL =
    "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-charcoal/55 hover:bg-charcoal/[0.06] hover:text-charcoal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green disabled:opacity-40 aria-pressed:bg-green/10 aria-pressed:text-green";

function foldText(value: string): string {
    return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}

/** "2026-11-07T14:30" theo giờ máy cho ô datetime-local. */
function localInputValue(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSchedule(iso: string): string {
    return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

type FormatKind = "bold" | "italic" | "underline" | "strike";

/** Chỉ nhận liên kết http(s) và đường dẫn nội bộ bắt đầu bằng "/" (không "//"), khớp phần hiển thị bài. */
function allowedHref(url: string): boolean {
    return /^https?:\/\/\S+$/.test(url) || (url.startsWith("/") && !url.startsWith("//"));
}

/** Lớp chữ cho vùng soạn: giống phần hiển thị bài (đoạn sát nhau, trích dẫn viền trái, liên kết xanh). */
const EDITOR_CLASS = [
    "min-h-12 text-[15px] leading-relaxed outline-none break-words",
    "[&_p]:m-0 [&_strong]:font-semibold [&_u]:underline-offset-2",
    "[&_blockquote]:my-1.5 [&_blockquote]:border-l-[3px] [&_blockquote]:border-charcoal/20 [&_blockquote]:py-0.5 [&_blockquote]:pl-3 [&_blockquote]:text-charcoal/75",
    "[&_a]:font-medium [&_a]:text-green [&_a]:underline [&_a]:decoration-green/40 [&_a]:underline-offset-2",
    "[&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-charcoal/40 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
].join(" ");

/** Kiểm tra tệp trước khi tải (backend kiểm lại). Trả về thông báo lỗi hoặc null. */
function checkFiles(files: File[]): string | null {
    if (files.length > MEDIA_MAX) return `Một bài có tối đa ${MEDIA_MAX} ảnh và video.`;
    for (const file of files) {
        if (!ACCEPT.split(",").includes(file.type)) return `“${file.name}” không phải ảnh JPEG/PNG/WebP hoặc video MP4.`;
        if (file.type.startsWith("image/") && file.size > IMAGE_MAX_BYTES) return `Ảnh “${file.name}” lớn hơn 8 MB.`;
        if (file.type === "video/mp4" && file.size > VIDEO_MAX_BYTES) return `Video “${file.name}” lớn hơn 50 MB.`;
    }
    return null;
}

/**
 * Ô soạn bài kiểu Threads: ảnh đại diện + đường dọc; dòng "Tên › Chủ đề" (gõ trực tiếp, có gợi ý); nội dung tự cao
 * dần tới gần hết màn hình rồi mới cuộn; thanh công cụ định dạng / ảnh / video / emoji / trích dẫn / liên kết / địa
 * điểm; "Tùy chọn bài" (ai xem, trả lời, ẩn lượt thích/xem, chia sẻ, hẹn giờ) bên trái nút Đăng.
 * `mode="reply"`: không có chủ đề và tùy chọn bài.
 */
export function PostComposer({
    mode = "post",
    displayName,
    avatarUrl,
    placeholder,
    topics = [],
    initialTopic = "",
    quote,
    onClearQuote,
    draftKey,
    submitLabel,
    onSubmit,
}: {
    mode?: "post" | "reply";
    displayName: string;
    avatarUrl?: string | null;
    placeholder: string;
    topics?: DiscussionTopic[];
    /** Tên chủ đề điền sẵn (vd. đang lọc theo chủ đề). */
    initialTopic?: string;
    quote?: { author: string; body: string } | null;
    onClearQuote?: () => void;
    /** Khóa localStorage để giữ bản nháp (theo người dùng). */
    draftKey?: string;
    submitLabel?: string;
    /** Trả về true khi đã đăng xong (ô soạn được xóa). */
    onSubmit: (draft: ComposerDraft) => Promise<boolean>;
}): JSX.Element {
    const ids = useId();
    const fileRef = useRef<HTMLInputElement>(null);
    /** Markup đang soạn (sinh từ trình soạn), là thứ được gửi và lưu. */
    const [body, setBody] = useState("");
    const [topicName, setTopicName] = useState(initialTopic);
    const [topicFocus, setTopicFocus] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<Array<{ url: string; video: boolean }>>([]);
    const [settings, setSettings] = useState<PostSettings>(DEFAULT_POST_SETTINGS);
    const [publishAt, setPublishAt] = useState<string | null>(null);
    const [popover, setPopover] = useState<"emoji" | "link" | "place" | "options" | null>(null);
    /** Chữ đang chọn lúc mở bảng chèn liên kết (làm chữ hiển thị mặc định). */
    const [linkSelection, setLinkSelection] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const restored = useRef(false);
    // Trình xử lý của trình soạn được tạo một lần: gọi hàm mới nhất qua ref.
    const submitRef = useRef<() => void>(() => undefined);
    const addFilesRef = useRef<(files: File[]) => void>(() => undefined);

    /*
     * Trình soạn Tiptap: định dạng hiện ngay khi gõ (đậm, nghiêng, gạch chân, gạch ngang, trích dẫn, liên kết).
     * Không có tiêu đề, danh sách, code hay HTML thô: chỉ những gì markup nhẹ biểu diễn được, để lưu ra không mất gì.
     */
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: false,
                bulletList: false,
                orderedList: false,
                listItem: false,
                listKeymap: false,
                code: false,
                codeBlock: false,
                horizontalRule: false,
                link: {
                    openOnClick: false,
                    autolink: false,
                    linkOnPaste: true,
                    defaultProtocol: "https",
                    isAllowedUri: (url) => allowedHref(url),
                    HTMLAttributes: { rel: "noopener noreferrer nofollow ugc", target: null },
                },
            }),
            Placeholder.configure({ placeholder }),
        ],
        editorProps: {
            attributes: {
                role: "textbox",
                "aria-multiline": "true",
                "aria-label": placeholder,
                class: EDITOR_CLASS,
            },
            handleKeyDown: (_view, event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    submitRef.current();
                    return true;
                }
                return false;
            },
            handlePaste: (_view, event) => {
                const pasted = Array.from(event.clipboardData?.files ?? []).filter((file) => ACCEPT.split(",").includes(file.type));
                if (pasted.length === 0) return false;
                addFilesRef.current(pasted);
                return true;
            },
        },
        onUpdate: ({ editor: current }) => setBody(docToMarkup(current.getJSON())),
    });

    /** Định dạng đang bật tại con trỏ (nút trên thanh công cụ sáng lên). */
    const active = useEditorState({
        editor,
        selector: ({ editor: current }) => ({
            bold: current?.isActive("bold") ?? false,
            italic: current?.isActive("italic") ?? false,
            underline: current?.isActive("underline") ?? false,
            strike: current?.isActive("strike") ?? false,
            quote: current?.isActive("blockquote") ?? false,
            link: current?.isActive("link") ?? false,
        }),
    });

    // Khôi phục bản nháp một lần, khi trình soạn đã sẵn sàng.
    useEffect(() => {
        if (!editor || !draftKey || restored.current) return;
        restored.current = true;
        try {
            const raw = window.localStorage.getItem(draftKey);
            const saved = raw ? (JSON.parse(raw) as { body?: unknown; topic?: unknown }) : null;
            if (typeof saved?.body === "string" && saved.body.trim()) {
                editor.commands.setContent(markupToDoc(saved.body.slice(0, BODY_MAX)), { emitUpdate: true });
            }
            // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc storage khi gắn
            if (typeof saved?.topic === "string" && !initialTopic) setTopicName(saved.topic.slice(0, 80));
        } catch {
            // bản nháp hỏng: bỏ qua
        }
    }, [editor, draftKey, initialTopic]);

    // Lưu bản nháp (markup + chủ đề; tệp không lưu được).
    useEffect(() => {
        if (!draftKey) return;
        const timer = setTimeout(() => {
            try {
                if (body.trim() || topicName.trim()) window.localStorage.setItem(draftKey, JSON.stringify({ body, topic: topicName }));
                else window.localStorage.removeItem(draftKey);
            } catch {
                // storage bị chặn
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [draftKey, body, topicName]);

    useEffect(() => {
        const next = files.map((file) => ({ url: URL.createObjectURL(file), video: file.type === "video/mp4" }));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- URL xem trước gắn với vòng đời tệp
        setPreviews(next);
        return () => {
            for (const item of next) URL.revokeObjectURL(item.url);
        };
    }, [files]);

    function format(kind: FormatKind): void {
        if (!editor) return;
        const chain = editor.chain().focus();
        if (kind === "bold") chain.toggleBold().run();
        else if (kind === "italic") chain.toggleItalic().run();
        else if (kind === "underline") chain.toggleUnderline().run();
        else chain.toggleStrike().run();
    }

    function insert(text: string): void {
        editor?.chain().focus().insertContent(text).run();
    }

    /** Chèn một cụm ở dạng markup (liên kết, địa điểm) thành chữ có định dạng; tự thêm khoảng trắng nếu dính chữ. */
    function insertToken(markup: string): void {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        const before = from > 1 ? editor.state.doc.textBetween(from - 1, from, "\n") : "";
        const after = editor.state.doc.textBetween(to, Math.min(to + 1, editor.state.doc.content.size), "\n");
        const nodes = markupToDoc(markup).content?.[0]?.content ?? [];
        editor
            .chain()
            .focus()
            .insertContent([
                ...(before && !/\s/.test(before) ? [{ type: "text", text: " " }] : []),
                ...nodes,
                ...(after && !/\s/.test(after) ? [] : [{ type: "text", text: " " }]),
            ])
            // Gõ tiếp sau liên kết thì không kéo dài liên kết.
            .unsetMark("link")
            .run();
    }

    function addFiles(incoming: File[]): void {
        const next = [...files, ...incoming];
        const problem = checkFiles(next);
        if (problem) {
            setError(problem);
            return;
        }
        setError(null);
        setFiles(next);
    }

    async function submit(): Promise<void> {
        if (pending || (!body.trim() && files.length === 0 && !quote)) return;
        if (body.length > BODY_MAX) {
            setError(`Nội dung tối đa ${BODY_MAX} ký tự (tính cả định dạng).`);
            return;
        }
        setPending(true);
        setError(null);
        try {
            const done = await onSubmit({ body: body.trim(), files, topicName: topicName.trim(), settings, publishAt });
            if (done) {
                editor?.commands.clearContent(true);
                setBody("");
                setFiles([]);
                setPublishAt(null);
                setPopover(null);
                if (draftKey) {
                    try {
                        window.localStorage.removeItem(draftKey);
                    } catch {
                        // bỏ qua
                    }
                }
            }
        } finally {
            setPending(false);
        }
    }

    useEffect(() => {
        submitRef.current = () => void submit();
        addFilesRef.current = addFiles;
    });

    const topicMatches = topics
        .filter((topic) => !topicName.trim() || foldText(topic.name).includes(foldText(topicName)))
        .slice(0, 6);
    const exactTopic = topics.some((topic) => foldText(topic.name) === foldText(topicName));
    const remaining = BODY_MAX - body.length;
    const changedOptions =
        settings.visibility !== "public" ||
        !settings.repliesAllowed ||
        settings.hideLikeCount ||
        settings.hideViewCount ||
        !settings.allowShare ||
        publishAt !== null;
    const visibilityLabel = POST_VISIBILITIES.find((item) => item.id === settings.visibility)?.label ?? "";

    return (
        <form
            className="flex gap-3 px-4 pt-4 pb-3"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <div className="flex w-10 shrink-0 flex-col items-center">
                <Avatar name={displayName} url={avatarUrl} />
                <span className="mt-2 w-0.5 flex-1 rounded-full bg-charcoal/15" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1 text-[15px] leading-5">
                    <span className="shrink-0 font-semibold">{displayName}</span>
                    {mode === "post" ? (
                        <>
                            <ChevronRight className="size-4 shrink-0 text-charcoal/35" aria-hidden="true" />
                            <div className="relative min-w-0 flex-1">
                                <input
                                    type="text"
                                    value={topicName}
                                    maxLength={80}
                                    placeholder="Chủ đề hoặc cộng đồng"
                                    role="combobox"
                                    aria-controls={`${ids}-topics`}
                                    aria-label="Chủ đề"
                                    aria-autocomplete="list"
                                    aria-expanded={topicFocus && topicMatches.length > 0}
                                    onFocus={() => setTopicFocus(true)}
                                    onBlur={() => setTimeout(() => setTopicFocus(false), 120)}
                                    onChange={(event) => setTopicName(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            editor?.commands.focus("end");
                                        }
                                    }}
                                    className="w-full min-w-0 border-0 bg-transparent p-0 text-[15px] text-green outline-none placeholder:font-normal placeholder:text-charcoal/40"
                                />
                                {topicFocus && (topicMatches.length > 0 || (topicName.trim() && !exactTopic)) ? (
                                    <ul id={`${ids}-topics`} role="listbox" className="absolute top-full left-0 z-30 mt-1 w-64 list-none rounded-xl bg-white p-1 shadow-[0_8px_24px_rgba(16,17,17,0.16)] ring-1 ring-charcoal/10">
                                        {topicMatches.map((topic) => (
                                            <li key={topic.id} role="option" aria-selected={foldText(topic.name) === foldText(topicName)}>
                                                <button
                                                    type="button"
                                                    tabIndex={-1}
                                                    onMouseDown={(event) => {
                                                        event.preventDefault();
                                                        setTopicName(topic.name);
                                                        setTopicFocus(false);
                                                        editor?.commands.focus("end");
                                                    }}
                                                    className="flex w-full items-center rounded-lg bg-transparent px-2.5 py-1.5 text-left text-sm hover:bg-charcoal/5"
                                                >
                                                    {topic.name}
                                                </button>
                                            </li>
                                        ))}
                                        {topicName.trim() && !exactTopic ? (
                                            <li role="presentation" className="px-2.5 py-1.5 text-xs text-charcoal/60">
                                                Đăng sẽ tạo chủ đề mới “<b className="text-charcoal">{topicName.trim()}</b>”
                                            </li>
                                        ) : null}
                                    </ul>
                                ) : null}
                            </div>
                        </>
                    ) : null}
                    {mode === "post" ? (
                        <div className="relative ml-auto flex shrink-0 items-center gap-1 self-start">
                            {changedOptions ? (
                                <span className="hidden max-w-48 items-center gap-1 truncate text-xs font-semibold text-green sm:inline-flex">
                                    {publishAt ? <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                                    {[visibilityLabel, publishAt ? `Hẹn ${formatSchedule(publishAt)}` : null].filter(Boolean).join(" · ")}
                                </span>
                            ) : null}
                            <button
                                type="button"
                                aria-label="Tùy chọn bài"
                                title="Tùy chọn bài: ai xem, trả lời, chia sẻ, ẩn lượt thích/xem, hẹn giờ"
                                aria-haspopup="dialog"
                                aria-expanded={popover === "options"}
                                data-popover-toggle=""
                                onClick={() => setPopover((current) => (current === "options" ? null : "options"))}
                                className={`relative -mt-1.5 -mr-2 inline-flex size-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-green ${popover === "options" ? "bg-charcoal/[0.06] text-charcoal" : "text-charcoal/55 hover:bg-charcoal/[0.06] hover:text-charcoal"}`}
                            >
                                <MoreHorizontal className="size-5" aria-hidden="true" />
                                {changedOptions ? <span className="absolute top-1 right-1 size-2 rounded-full bg-green ring-2 ring-white" aria-hidden="true" /> : null}
                            </button>
                            {popover === "options" ? (
                                <Popover onClose={() => setPopover(null)} label="Tùy chọn bài" align="right" wide>
                                    <PostOptionsForm settings={settings} onChange={setSettings} publishAt={publishAt} onPublishAt={setPublishAt} />
                                </Popover>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                {/* Tự cao theo nội dung tới gần hết màn hình rồi cuộn. */}
                <div className="mt-1 max-h-[calc(100dvh-14rem)] overflow-y-auto [scrollbar-width:thin]">
                    <EditorContent editor={editor} />
                </div>

                {quote ? (
                    <div className="mt-2 rounded-2xl border-l-[3px] border-charcoal/20 bg-charcoal/[0.03] py-2 pr-2 pl-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                            <p className="m-0 font-semibold">{quote.author}</p>
                            {onClearQuote ? (
                                <button type="button" aria-label="Bỏ trích dẫn" onClick={onClearQuote} className={`${TOOL} size-7`}>
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            ) : null}
                        </div>
                        <p className="mt-0.5 mb-0 line-clamp-3 text-charcoal/75">{quote.body}</p>
                    </div>
                ) : null}

                {previews.length > 0 ? (
                    <ul className="mt-3 flex list-none gap-2 overflow-x-auto p-0 pb-1 [scrollbar-width:thin]" aria-label="Ảnh và video đã chọn">
                        {previews.map((item, index) => (
                            <li key={item.url} className="relative h-40 shrink-0 overflow-hidden rounded-xl bg-charcoal/5">
                                {item.video ? (
                                    <video src={item.url} className="h-full w-auto max-w-72 object-cover" muted playsInline controls />
                                ) : (
                                    // Object URL: bản xem trước của tệp vừa chọn.
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={item.url} alt="" className="h-full w-auto max-w-72 object-cover" />
                                )}
                                <button
                                    type="button"
                                    aria-label={`Bỏ tệp ${index + 1}`}
                                    onClick={() => setFiles((current) => current.filter((_, at) => at !== index))}
                                    className="absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-full bg-charcoal/70 text-white hover:bg-charcoal"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}

                {/* Một hàng: công cụ bên trái, số ký tự còn lại + nút Đăng/Trả lời bên phải. */}
                <div className="mt-2 flex items-center gap-2">
                <div className="relative -ml-2 flex min-w-0 flex-1 flex-wrap items-center gap-0.5" role="toolbar" aria-label="Định dạng và đính kèm">
                    <input
                        ref={fileRef}
                        type="file"
                        accept={ACCEPT}
                        multiple
                        className="sr-only"
                        tabIndex={-1}
                        onChange={(event) => {
                            addFiles(Array.from(event.target.files ?? []));
                            event.target.value = "";
                        }}
                    />
                    <ToolButton label="Thêm ảnh" onClick={() => fileRef.current?.click()} disabled={files.length >= MEDIA_MAX}>
                        <ImagePlus className="size-[18px]" aria-hidden="true" />
                    </ToolButton>
                    <ToolButton label="Thêm video" onClick={() => fileRef.current?.click()} disabled={files.length >= MEDIA_MAX}>
                        <Film className="size-[18px]" aria-hidden="true" />
                    </ToolButton>
                    <span className="mx-1 h-5 w-px bg-charcoal/10" aria-hidden="true" />
                    <ToolButton label="In đậm (Ctrl+B)" active={active?.bold} onClick={() => format("bold")}>
                        <Bold className="size-[18px]" aria-hidden="true" />
                    </ToolButton>
                    <ToolButton label="In nghiêng (Ctrl+I)" active={active?.italic} onClick={() => format("italic")}>
                        <Italic className="size-[18px]" aria-hidden="true" />
                    </ToolButton>
                    <ToolButton label="Gạch chân (Ctrl+U)" active={active?.underline} onClick={() => format("underline")}>
                        <Underline className="size-[18px]" aria-hidden="true" />
                    </ToolButton>
                    <ToolButton label="Gạch ngang (Ctrl+Shift+S)" active={active?.strike} onClick={() => format("strike")}>
                        <Strikethrough className="size-[18px]" aria-hidden="true" />
                    </ToolButton>
                    <ToolButton label="Trích dẫn" active={active?.quote} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                        <Quote className="size-[18px]" aria-hidden="true" />
                    </ToolButton>
                    <span className="mx-1 h-5 w-px bg-charcoal/10" aria-hidden="true" />
                    <ToolButton label="Emoji" pressed={popover === "emoji"} onClick={() => setPopover((current) => (current === "emoji" ? null : "emoji"))}>
                        <Smile className="size-[18px]" aria-hidden="true" />
                    </ToolButton>
                    <ToolButton
                        label="Chèn liên kết"
                        pressed={popover === "link"}
                        active={active?.link}
                        onClick={() => {
                            if (editor) {
                                const { from, to } = editor.state.selection;
                                setLinkSelection(editor.state.doc.textBetween(from, to, " "));
                            }
                            setPopover((current) => (current === "link" ? null : "link"));
                        }}
                    >
                        <Link2 className="size-[18px]" aria-hidden="true" />
                    </ToolButton>
                    <ToolButton label="Gắn địa điểm" pressed={popover === "place"} onClick={() => setPopover((current) => (current === "place" ? null : "place"))}>
                        <MapPin className="size-[18px]" aria-hidden="true" />
                    </ToolButton>

                    {popover === "emoji" ? (
                        <Popover onClose={() => setPopover(null)} label="Chọn emoji">
                            <div className="grid grid-cols-8 gap-0.5">
                                {EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        aria-label={`Chèn ${emoji}`}
                                        onClick={() => insert(emoji)}
                                        className="inline-flex size-9 items-center justify-center rounded-lg bg-transparent text-xl hover:bg-charcoal/[0.06]"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </Popover>
                    ) : null}
                    {popover === "link" ? (
                        <Popover onClose={() => setPopover(null)} label="Chèn liên kết">
                            <LinkForm
                                selected={linkSelection}
                                onInsert={(text) => {
                                    insertToken(text);
                                    setPopover(null);
                                }}
                            />
                        </Popover>
                    ) : null}
                    {popover === "place" ? (
                        <Popover onClose={() => setPopover(null)} label="Gắn địa điểm">
                            <PlaceForm
                                onInsert={(text) => {
                                    insertToken(text);
                                    setPopover(null);
                                }}
                            />
                        </Popover>
                    ) : null}
                </div>
                    <span
                        className={`shrink-0 text-xs tabular-nums ${remaining < 0 ? "text-red-700" : remaining <= 200 ? "text-gold" : "text-charcoal/40"}`}
                        aria-live="polite"
                    >
                        {remaining <= 300 ? remaining : ""}
                    </span>
                    <button
                        type="submit"
                        className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full bg-charcoal px-4 text-sm font-semibold text-white hover:bg-charcoal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={pending || (!body.trim() && files.length === 0 && !quote)}
                    >
                        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                        {pending ? "Đang đăng" : publishAt ? "Lên lịch" : (submitLabel ?? "Đăng")}
                    </button>
                </div>

                {error ? (
                    <p role="alert" className="m-0 mt-2 text-sm text-red-700">
                        {error}
                    </p>
                ) : null}
            </div>
        </form>
    );
}

function ToolButton({
    label,
    onClick,
    disabled,
    pressed,
    active,
    children,
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    /** Nút mở bảng (emoji, liên kết…) đang mở. */
    pressed?: boolean;
    /** Định dạng đang bật tại con trỏ. */
    active?: boolean;
    children: ReactNode;
}): JSX.Element {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={pressed ?? active}
            data-popover-toggle={pressed === undefined ? undefined : ""}
            disabled={disabled}
            // Giữ vùng chọn trong ô soạn khi bấm nút định dạng.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className={TOOL}
        >
            {children}
        </button>
    );
}

/** Bảng nổi dưới (hoặc trên) thanh công cụ; Esc hoặc bấm ra ngoài để đóng. */
function Popover({
    label,
    onClose,
    placement = "below",
    align = "left",
    wide = false,
    children,
}: {
    label: string;
    onClose: () => void;
    placement?: "below" | "above";
    align?: "left" | "right";
    wide?: boolean;
    children: ReactNode;
}): JSX.Element {
    const ref = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    });
    useEffect(() => {
        function onPointer(event: PointerEvent): void {
            const target = event.target as Element | null;
            // Nút mở bảng tự bật/tắt; không đóng ở đây để khỏi đóng rồi mở lại.
            if (ref.current?.contains(target as Node) || target?.closest("[data-popover-toggle]")) return;
            closeRef.current();
        }
        // Bấm vào nút mở cũng là "ngoài": để nút tự bật/tắt, lắng nghe từ lượt sau.
        const timer = setTimeout(() => document.addEventListener("pointerdown", onPointer, true), 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("pointerdown", onPointer, true);
        };
    }, []);
    return (
        <div
            ref={ref}
            role="dialog"
            aria-label={label}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.stopPropagation();
                    onClose();
                }
            }}
            className={`absolute ${align === "right" ? "right-0" : "left-0"} z-30 rounded-2xl bg-white p-2 shadow-[0_12px_32px_rgba(16,17,17,0.18)] ring-1 ring-charcoal/10 ${placement === "above" ? "bottom-full mb-2" : "top-full mt-1"} ${wide ? "w-[min(22rem,calc(100vw-3rem))]" : "w-[min(20rem,calc(100vw-3rem))]"}`}
        >
            {children}
        </div>
    );
}

/** Liên kết: có chữ hiển thị thì thành [chữ](url), để trống thì chèn đường dẫn thuần. */
function LinkForm({ selected, onInsert }: { selected: string; onInsert: (text: string) => void }): JSX.Element {
    const [url, setUrl] = useState("");
    const [text, setText] = useState(selected.trim());
    const id = useId();
    const value = url.trim();
    const internal = value.startsWith("/") && !value.startsWith("//");
    const valid = /^https?:\/\/[^\s]+\.[^\s]+$/.test(value) || (internal && !/\s/.test(value));
    function submit(): void {
        if (!valid) return;
        const label = text.trim().replace(/[[\]]/g, "");
        onInsert(label ? `[${label}](${value})` : value);
    }
    // Không dùng <form>: bảng nằm trong form soạn bài (form lồng nhau không hợp lệ).
    return (
        <div
            className="grid gap-2 p-1"
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    submit();
                }
            }}
        >
            <label htmlFor={`${id}-url`} className="text-xs font-semibold text-charcoal/70">
                Đường dẫn
            </label>
            <input
                id={`${id}-url`}
                autoFocus
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://… hoặc /map?…"
                className="min-h-9 rounded-lg border border-charcoal/15 px-2.5 text-sm outline-none focus:border-green focus:ring-2 focus:ring-green/20"
            />
            <label htmlFor={`${id}-text`} className="text-xs font-semibold text-charcoal/70">
                Chữ hiển thị <span className="font-normal text-charcoal/45">(để trống = đường dẫn thuần)</span>
            </label>
            <input
                id={`${id}-text`}
                value={text}
                maxLength={120}
                onChange={(event) => setText(event.target.value)}
                className="min-h-9 rounded-lg border border-charcoal/15 px-2.5 text-sm outline-none focus:border-green focus:ring-2 focus:ring-green/20"
            />
            {value && !valid ? <p className="m-0 text-xs text-red-700">Chỉ nhận http(s):// hoặc đường dẫn trong trang bắt đầu bằng “/”.</p> : null}
            <button type="button" onClick={submit} disabled={!valid} className="min-h-9 rounded-lg bg-charcoal text-sm font-semibold text-white disabled:opacity-40">
                Chèn liên kết
            </button>
        </div>
    );
}

/** Tìm địa điểm (Vietmap) rồi chèn liên kết mở đúng điểm đó trên bản đồ của trang. */
function PlaceForm({ onInsert }: { onInsert: (text: string) => void }): JSX.Element {
    const [query, setQuery] = useState("");
    const [items, setItems] = useState<MapSuggestion[]>([]);
    const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
    const [asPlainLink, setAsPlainLink] = useState(false);
    const [resolving, setResolving] = useState<string | null>(null);

    useEffect(() => {
        const text = query.trim();
        if (text.length < 2) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- xóa gợi ý khi chuỗi quá ngắn
            setItems([]);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setStatus("loading");
            searchPlaces(text, null, {}, controller.signal)
                .then((result) => {
                    setItems(result);
                    setStatus("idle");
                })
                .catch((error: unknown) => {
                    if (!isAbortError(error)) setStatus("error");
                });
        }, 300);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    async function choose(item: MapSuggestion): Promise<void> {
        setResolving(item.refId);
        try {
            const place = await resolvePlace(item.refId);
            const at = `${Number(place.lat.toFixed(6))},${Number(place.lng.toFixed(6))}`;
            const href = `/map?c=${at}&z=16&pin=${at}`;
            const name = item.name.replace(/[[\]]/g, "");
            onInsert(asPlainLink ? `📍 ${name} ${window.location.origin}${href}` : `📍 [${name}](${href})`);
        } catch {
            setStatus("error");
        } finally {
            setResolving(null);
        }
    }

    return (
        <div className="grid gap-2 p-1">
            <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm địa điểm, địa chỉ"
                aria-label="Tìm địa điểm"
                className="min-h-9 rounded-lg border border-charcoal/15 px-2.5 text-sm outline-none focus:border-green focus:ring-2 focus:ring-green/20"
            />
            <label className="flex items-center gap-2 text-xs text-charcoal/70">
                <input type="checkbox" checked={asPlainLink} onChange={(event) => setAsPlainLink(event.target.checked)} className="size-3.5 accent-green" />
                Chèn dạng đường dẫn thuần (thay vì tên có liên kết)
            </label>
            {status === "loading" ? <p className="m-0 text-xs text-charcoal/60">Đang tìm…</p> : null}
            {status === "error" ? <p className="m-0 text-xs text-red-700">Không tìm được lúc này.</p> : null}
            <ul className="m-0 max-h-56 list-none overflow-y-auto p-0">
                {items.map((item) => (
                    <li key={item.refId}>
                        <button
                            type="button"
                            disabled={resolving !== null}
                            onClick={() => void choose(item)}
                            className="flex w-full items-start gap-2 rounded-lg bg-transparent px-2 py-1.5 text-left hover:bg-charcoal/5 disabled:opacity-50"
                        >
                            {resolving === item.refId ? (
                                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden="true" />
                            ) : (
                                <MapPin className="mt-0.5 size-4 shrink-0 text-green" aria-hidden="true" />
                            )}
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold">{item.name}</span>
                                <span className="block truncate text-xs text-charcoal/60">{item.address}</span>
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Tùy chọn bài: ai xem, trả lời, ẩn lượt thích/xem, chia sẻ, (khi soạn) hẹn giờ. Dùng cả khi sửa cài đặt bài. */
export function PostOptionsForm({
    settings,
    onChange,
    publishAt,
    onPublishAt,
}: {
    settings: PostSettings;
    onChange: (next: PostSettings) => void;
    publishAt?: string | null;
    onPublishAt?: (value: string | null) => void;
}): JSX.Element {
    const id = useId();
    const [now] = useState(() => Date.now());
    const min = localInputValue(new Date(now + 3 * 60 * 1000));
    const max = localInputValue(new Date(now + 30 * 24 * 60 * 60 * 1000));
    const toggle = (key: keyof Omit<PostSettings, "visibility">, label: string, hint: string): JSX.Element => (
        <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg px-2 py-2 hover:bg-charcoal/[0.04]">
            <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-charcoal/55">{hint}</span>
            </span>
            <input
                type="checkbox"
                role="switch"
                checked={settings[key]}
                onChange={(event) => onChange({ ...settings, [key]: event.target.checked })}
                className="mt-1 size-4 shrink-0 accent-green"
            />
        </label>
    );
    return (
        <div className="grid gap-1 p-1">
            <fieldset className="m-0 grid gap-0.5 border-0 p-0">
                <legend className="mb-1 px-2 text-xs font-semibold text-charcoal/60">Ai có thể xem</legend>
                {POST_VISIBILITIES.map((item) => (
                    <label
                        key={item.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 ${settings.visibility === item.id ? "bg-green/[0.07]" : "hover:bg-charcoal/[0.04]"}`}
                    >
                        <input
                            type="radio"
                            name={`${id}-visibility`}
                            checked={settings.visibility === item.id}
                            onChange={() => onChange({ ...settings, visibility: item.id })}
                            className="size-4 accent-green"
                        />
                        <span>
                            <span className="block text-sm font-semibold">{item.label}</span>
                            <span className="block text-xs text-charcoal/55">{item.hint}</span>
                        </span>
                    </label>
                ))}
            </fieldset>
            <div role="presentation" className="mx-2 my-1 h-px bg-charcoal/10" />
            {toggle("repliesAllowed", "Cho phép trả lời", "Tắt thì chỉ bạn trả lời được")}
            {toggle("allowShare", "Cho phép chia sẻ, đăng lại", "Tắt thì người khác không thấy nút đăng lại và chia sẻ")}
            {toggle("hideLikeCount", "Ẩn số lượt thích", "Chỉ bạn thấy số lượt thích")}
            {toggle("hideViewCount", "Ẩn số lượt xem", "Chỉ bạn thấy số lượt xem")}
            {onPublishAt ? (
                <>
                    <div role="presentation" className="mx-2 my-1 h-px bg-charcoal/10" />
                    <div className="grid gap-1.5 px-2 py-1">
                        <label htmlFor={`${id}-schedule`} className="flex items-center gap-1.5 text-sm font-semibold">
                            <CalendarClock className="size-4" aria-hidden="true" /> Lên lịch đăng
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                id={`${id}-schedule`}
                                type="datetime-local"
                                min={min}
                                max={max}
                                value={publishAt ? localInputValue(new Date(publishAt)) : ""}
                                onChange={(event) => onPublishAt(event.target.value ? new Date(event.target.value).toISOString() : null)}
                                className="min-h-9 min-w-0 flex-1 rounded-lg border border-charcoal/15 px-2 text-sm outline-none focus:border-green focus:ring-2 focus:ring-green/20"
                            />
                            {publishAt ? (
                                <button type="button" onClick={() => onPublishAt(null)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-charcoal/70 hover:bg-charcoal/5">
                                    Đăng ngay
                                </button>
                            ) : null}
                        </div>
                        <p className="m-0 text-xs text-charcoal/55">Từ vài phút tới 30 ngày sau. Bài chờ nằm ở mục “Đã lên lịch”.</p>
                    </div>
                </>
            ) : null}
        </div>
    );
}

export function Avatar({
    name,
    url,
    online = false,
}: {
    name: string;
    url?: string | null;
    /** Chấm xanh góc dưới phải: đang trực tuyến. */
    online?: boolean;
}): JSX.Element {
    const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
    const letter = (parts.at(-1) ?? "?").slice(0, 1).toUpperCase();
    return (
        <span className="relative inline-flex size-10 shrink-0">
            {url ? (
                // Profile photos are remote and may be signed.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="size-10 rounded-full object-cover" />
            ) : (
                <span className="flex size-10 items-center justify-center rounded-full bg-green text-sm font-semibold text-cream">{letter}</span>
            )}
            {online ? (
                <span
                    role="img"
                    aria-label="Đang trực tuyến"
                    title="Đang trực tuyến"
                    className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full bg-[#22c55e] ring-[2.5px] ring-white"
                />
            ) : null}
        </span>
    );
}
