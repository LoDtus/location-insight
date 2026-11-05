"use client";

import { Film, ImagePlus, X } from "lucide-react";
import { useRef, useState, type JSX } from "react";

import {
    CATEGORY_LABEL,
    MAX_IMAGES,
    createFeedback,
    errorText,
    uploadFeedbackFile,
    validateFile,
    type FeedbackCategory,
    type FeedbackDetail,
} from "../feedback.api";

interface Picked {
    file: File;
    url: string;
}

export function FeedbackForm({ onCreated }: { onCreated: (created: FeedbackDetail) => void }): JSX.Element {
    const [category, setCategory] = useState<FeedbackCategory>("bug");
    const [description, setDescription] = useState("");
    const [picked, setPicked] = useState<Picked[]>([]);
    const [pending, setPending] = useState("");
    const [error, setError] = useState("");
    const input = useRef<HTMLInputElement>(null);

    const images = picked.filter((item) => item.file.type !== "video/mp4").length;
    const hasVideo = picked.some((item) => item.file.type === "video/mp4");
    const valid = description.trim().length >= 10;

    function add(files: File[]): void {
        const next = [...picked];
        let message = "";
        for (const file of files) {
            const problem = validateFile(file);
            const isVideo = file.type === "video/mp4";
            if (problem) message = problem;
            else if (isVideo && (hasVideo || next.some((item) => item.file.type === "video/mp4"))) message = "Mỗi góp ý chỉ đính kèm một video.";
            else if (!isVideo && next.filter((item) => item.file.type !== "video/mp4").length >= MAX_IMAGES) message = `Tối đa ${MAX_IMAGES} ảnh.`;
            else next.push({ file, url: URL.createObjectURL(file) });
        }
        setPicked(next);
        setError(message);
    }

    function remove(index: number): void {
        URL.revokeObjectURL(picked[index]?.url ?? "");
        setPicked((current) => current.filter((_, position) => position !== index));
    }

    async function submit(): Promise<void> {
        if (!valid || pending) return;
        setError("");
        try {
            const mediaIds: string[] = [];
            for (const [index, item] of picked.entries()) {
                setPending(`Đang tải tệp ${index + 1}/${picked.length}…`);
                mediaIds.push(await uploadFeedbackFile(item.file));
            }
            setPending("Đang gửi…");
            const created = await createFeedback({ category, description: description.trim(), mediaIds });
            picked.forEach((item) => URL.revokeObjectURL(item.url));
            setPicked([]);
            setDescription("");
            onCreated(created);
        } catch (failure) {
            setError(errorText(failure));
        } finally {
            setPending("");
        }
    }

    return (
        <form
            className="mx-auto grid w-full max-w-2xl gap-4 p-4 sm:p-8"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <div>
                <h1 className="m-0 text-2xl font-semibold">Gửi góp ý</h1>
                <p className="mt-1 mb-0 text-sm text-charcoal/70">
                    Báo lỗi, đề xuất tính năng hoặc đặt câu hỏi. Đội ngũ sẽ trả lời ngay trong mục này.
                </p>
            </div>
            <label className="grid gap-1 text-sm font-semibold">
                Loại góp ý
                <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                    className="min-h-11 rounded-xl border border-charcoal/25 bg-white px-3 text-base font-normal focus-visible:outline-2 focus-visible:outline-green"
                >
                    {(Object.keys(CATEGORY_LABEL) as FeedbackCategory[]).map((key) => (
                        <option key={key} value={key}>
                            {CATEGORY_LABEL[key]}
                        </option>
                    ))}
                </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
                Mô tả
                <textarea
                    value={description}
                    maxLength={4000}
                    rows={7}
                    placeholder="Bạn gặp chuyện gì? Làm thế nào để thấy lại? Bạn mong muốn điều gì?"
                    onChange={(event) => setDescription(event.target.value)}
                    className="resize-y rounded-xl border border-charcoal/25 bg-white p-3 text-base font-normal leading-relaxed focus-visible:outline-2 focus-visible:outline-green"
                />
                <span className="text-right text-xs font-normal text-charcoal/60">{description.length}/4000</span>
            </label>

            <div className="grid gap-2">
                <p className="m-0 text-sm font-semibold">Ảnh hoặc video (không bắt buộc)</p>
                {picked.length > 0 ? (
                    <ul className="m-0 flex flex-wrap gap-3 p-0">
                        {picked.map((item, index) => (
                            <li key={item.url} className="relative list-none">
                                {item.file.type === "video/mp4" ? (
                                    <span className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-charcoal/25 bg-white text-xs">
                                        <Film className="size-6" aria-hidden="true" />
                                        <span className="max-w-20 truncate">{item.file.name}</span>
                                    </span>
                                ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={item.url} alt={`Ảnh đính kèm ${index + 1}`} className="size-24 rounded-xl object-cover" />
                                )}
                                <button
                                    type="button"
                                    className="absolute -top-2 -right-2 inline-flex size-7 items-center justify-center rounded-full bg-charcoal text-cream focus-visible:outline-2 focus-visible:outline-green"
                                    aria-label={`Bỏ tệp ${index + 1}`}
                                    onClick={() => remove(index)}
                                >
                                    <X className="size-3.5" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}
                <div>
                    <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/30 px-4 font-semibold hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
                        onClick={() => input.current?.click()}
                    >
                        <ImagePlus className="size-4" aria-hidden="true" />
                        Thêm ảnh hoặc video
                    </button>
                    <p className="mt-1 mb-0 text-xs text-charcoal/60">
                        Tối đa {MAX_IMAGES} ảnh (JPEG, PNG, WebP, mỗi ảnh ≤ 8 MB) và 1 video MP4 (≤ 50 MB). Đã chọn {images} ảnh{hasVideo ? " và 1 video" : ""}.
                    </p>
                </div>
                <input
                    ref={input}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                        add([...(event.target.files ?? [])]);
                        event.target.value = "";
                    }}
                />
            </div>

            {error ? (
                <p role="alert" className="m-0 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
            {pending ? (
                <p role="status" className="m-0 text-sm text-charcoal/70">
                    {pending}
                </p>
            ) : null}
            <div>
                <button
                    type="submit"
                    disabled={!valid || Boolean(pending)}
                    className="min-h-11 rounded-full bg-green px-8 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:bg-charcoal/25 disabled:text-charcoal/60"
                >
                    Gửi góp ý
                </button>
            </div>
        </form>
    );
}
