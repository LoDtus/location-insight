export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export const EMOJI_PICKER = [
    "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
    "🤔", "😅", "😭", "😢", "😡", "🥳", "😴", "🙄",
    "👍", "👎", "👏", "🙏", "💪", "🤝", "👌", "🙌",
    "❤️", "💔", "🔥", "✨", "🎉", "🏠", "📍", "💰",
] as const;

export const BODY_MAX = 2000;
export const ATTACHMENTS_MAX = 4;
export const NEAR_BOTTOM_PX = 120;
export const LOAD_OLDER_PX = 200;
export const DRAFT_KEY = (conversationId: string): string => `messaging-draft:${conversationId}`;
