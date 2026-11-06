import type { ComposerDraft } from "@/features/discussions/components/post-composer";
import {
    createPost,
    createTopic,
    slugifyTopic,
    uploadDiscussionFile,
    type DiscussionPost,
    type DiscussionTopic,
} from "@/features/discussions/discussions.api";

export class DraftError extends Error {}

/**
 * Đăng bài từ ô soạn: chủ đề gõ trùng (slug hoặc tên, không phân biệt hoa thường) thì dùng chủ đề có sẵn, không thì
 * tạo mới; để trống thì backend xếp vào "Thảo luận chung". Tải tệp lần lượt rồi tạo bài kèm tùy chọn và giờ hẹn.
 */
export async function publishDraft(
    draft: ComposerDraft,
    topics: readonly DiscussionTopic[],
    extraBody = "",
): Promise<{ post: DiscussionPost; createdTopic: DiscussionTopic | null }> {
    let topicSlug: string | undefined;
    let createdTopic: DiscussionTopic | null = null;
    const named = draft.topicName.trim();
    if (named) {
        const slug = slugifyTopic(named);
        const existing = topics.find((topic) => topic.slug === slug || topic.name.toLocaleLowerCase("vi") === named.toLocaleLowerCase("vi"));
        if (existing) topicSlug = existing.slug;
        else {
            if (slug.length < 3) throw new DraftError("Tên chủ đề cần ít nhất 3 chữ cái hoặc số.");
            createdTopic = await createTopic({ name: named, slug });
            topicSlug = createdTopic.slug;
        }
    }
    const mediaIds: string[] = [];
    for (const file of draft.files) mediaIds.push(await uploadDiscussionFile(file));
    const body = extraBody ? `${draft.body}\n\n${extraBody}`.trim() : draft.body;
    const post = await createPost({
        topicSlug,
        kind: "note",
        body,
        mediaIds,
        ...draft.settings,
        ...(draft.publishAt ? { publishAt: draft.publishAt } : {}),
    });
    return { post, createdTopic };
}
