"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    Heading2,
    Heading3,
    Italic,
    Link2,
    Link2Off,
    List,
    ListOrdered,
    Minus,
    Pilcrow,
    Quote,
    Redo2,
    RemoveFormatting,
    Strikethrough,
    Underline,
    Undo2,
    type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { normalizeLinkUrl } from "@/shared/components/editor/rich-text.utils";

type ToolbarLabels = {
    link: string;
    linkPlaceholder: string;
    linkApply: string;
    linkInvalid: string;
    removeLink: string;
};

type ButtonSpec = {
    key: string;
    label: string;
    icon: LucideIcon;
    active?: boolean;
    disabled?: boolean;
    run: () => void;
};

const BUTTON_CLASS =
    "inline-flex size-9 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-charcoal hover:bg-charcoal/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-green/15 aria-pressed:text-green";

function Group({ children }: { children: JSX.Element[] }): JSX.Element {
    return <div className="flex items-center gap-0.5 border-r border-charcoal/15 pr-1.5 last:border-r-0 last:pr-0">{children}</div>;
}

function ToolButton({ spec }: { spec: ButtonSpec }): JSX.Element {
    const Icon = spec.icon;
    return (
        <button
            type="button"
            className={BUTTON_CLASS}
            aria-label={spec.label}
            title={spec.label}
            aria-pressed={spec.active ?? false}
            disabled={spec.disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={spec.run}
        >
            <Icon size={18} aria-hidden="true" />
        </button>
    );
}

/** Thanh công cụ kiểu Word: hoàn tác, tiêu đề, định dạng chữ, danh sách, căn lề, liên kết. */
export default function RichTextToolbar({
    editor,
    labels,
    names,
}: {
    editor: Editor;
    labels: ToolbarLabels;
    names: Record<string, string>;
}): JSX.Element {
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkValue, setLinkValue] = useState("");
    const [linkError, setLinkError] = useState(false);
    const state = useEditorState({
        editor,
        selector: ({ editor: current }) => ({
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            underline: current.isActive("underline"),
            strike: current.isActive("strike"),
            h2: current.isActive("heading", { level: 2 }),
            h3: current.isActive("heading", { level: 3 }),
            bullet: current.isActive("bulletList"),
            ordered: current.isActive("orderedList"),
            quote: current.isActive("blockquote"),
            left: current.isActive({ textAlign: "left" }),
            center: current.isActive({ textAlign: "center" }),
            right: current.isActive({ textAlign: "right" }),
            link: current.isActive("link"),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
        }),
    });
    const chain = () => editor.chain().focus();

    const groups: ButtonSpec[][] = [
        [
            { key: "undo", label: names.undo, icon: Undo2, disabled: !state.canUndo, run: () => chain().undo().run() },
            { key: "redo", label: names.redo, icon: Redo2, disabled: !state.canRedo, run: () => chain().redo().run() },
        ],
        [
            { key: "p", label: names.paragraph, icon: Pilcrow, active: !state.h2 && !state.h3, run: () => chain().setParagraph().run() },
            { key: "h2", label: names.heading2, icon: Heading2, active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
            { key: "h3", label: names.heading3, icon: Heading3, active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
        ],
        [
            { key: "bold", label: names.bold, icon: Bold, active: state.bold, run: () => chain().toggleBold().run() },
            { key: "italic", label: names.italic, icon: Italic, active: state.italic, run: () => chain().toggleItalic().run() },
            { key: "underline", label: names.underline, icon: Underline, active: state.underline, run: () => chain().toggleUnderline().run() },
            { key: "strike", label: names.strike, icon: Strikethrough, active: state.strike, run: () => chain().toggleStrike().run() },
        ],
        [
            { key: "bullet", label: names.bullet, icon: List, active: state.bullet, run: () => chain().toggleBulletList().run() },
            { key: "ordered", label: names.ordered, icon: ListOrdered, active: state.ordered, run: () => chain().toggleOrderedList().run() },
            { key: "quote", label: names.quote, icon: Quote, active: state.quote, run: () => chain().toggleBlockquote().run() },
        ],
        [
            { key: "left", label: names.alignLeft, icon: AlignLeft, active: state.left, run: () => chain().setTextAlign("left").run() },
            { key: "center", label: names.alignCenter, icon: AlignCenter, active: state.center, run: () => chain().setTextAlign("center").run() },
            { key: "right", label: names.alignRight, icon: AlignRight, active: state.right, run: () => chain().setTextAlign("right").run() },
        ],
        [
            {
                key: "link",
                label: state.link ? labels.removeLink : labels.link,
                icon: state.link ? Link2Off : Link2,
                active: state.link,
                run: () => {
                    if (state.link) {
                        chain().unsetLink().run();
                        return;
                    }
                    setLinkValue("");
                    setLinkError(false);
                    setLinkOpen((open) => !open);
                },
            },
            { key: "hr", label: names.rule, icon: Minus, run: () => chain().setHorizontalRule().run() },
            { key: "clear", label: names.clear, icon: RemoveFormatting, run: () => chain().unsetAllMarks().clearNodes().run() },
        ],
    ];

    const available = new Set(editor.extensionManager.extensions.map((extension) => extension.name));
    const needs: Record<string, string> = { underline: "underline", left: "textAlign", center: "textAlign", right: "textAlign" };
    const visible = groups
        .map((group) => group.filter((spec) => !needs[spec.key] || available.has(needs[spec.key])))
        .filter((group) => group.length > 0);

    function applyLink(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        event.stopPropagation();
        const href = normalizeLinkUrl(linkValue);
        if (!href) {
            setLinkError(true);
            return;
        }
        chain().extendMarkRange("link").setLink({ href }).run();
        setLinkOpen(false);
        setLinkValue("");
    }

    return (
        <div className="border-b border-charcoal/15 bg-white">
            <div role="toolbar" aria-label={names.toolbar} className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
                {visible.map((group) => (
                    <Group key={group[0].key}>
                        {group.map((spec) => (
                            <ToolButton key={spec.key} spec={spec} />
                        ))}
                    </Group>
                ))}
            </div>
            {linkOpen ? (
                <form className="flex flex-wrap items-center gap-2 border-t border-charcoal/10 px-2 py-2" onSubmit={applyLink}>
                    <input
                        autoFocus
                        className="box-border min-h-9 min-w-0 flex-1 rounded-md border border-charcoal/20 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-green"
                        value={linkValue}
                        placeholder={labels.linkPlaceholder}
                        aria-label={labels.link}
                        aria-invalid={linkError}
                        onChange={(event) => {
                            setLinkValue(event.target.value);
                            setLinkError(false);
                        }}
                    />
                    <button type="submit" className="min-h-9 rounded-md bg-green px-3 text-sm font-semibold text-cream">
                        {labels.linkApply}
                    </button>
                    {linkError ? (
                        <p role="alert" className="m-0 basis-full text-xs text-red-700">
                            {labels.linkInvalid}
                        </p>
                    ) : null}
                </form>
            ) : null}
        </div>
    );
}
