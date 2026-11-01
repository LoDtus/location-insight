export const MESSAGING_LIMITS = {
  bodyMax: 2000,
  previewMax: 120,
  excerptMax: 120,
  sharedExcerptMax: 200,
  pageDefault: 30,
  pageMax: 100,
  inboxPage: 30,
  attachmentsMax: 4,
  imageMaxBytes: 8 * 1024 * 1024,
  imageSideMax: 8000,
  imagePixelsMax: 40_000_000,
  uploadTtlSeconds: 300,
  readUrlTtlSeconds: 3600,
  pendingMax: 30,
  unreadCap: 99,
  requestVisibleDays: 30,
  reportContextRadius: 5,
  socketsPerUser: 5,
  searchMax: 10,
} as const;

export const MESSAGING_RATE = {
  send: { window: 60, max: 60 },
  sendConversation: { window: 10, max: 15 },
  newConversation: { window: 24 * 60 * 60, max: 20 },
  attach: { window: 60 * 60, max: 30 },
  react: { window: 60, max: 60 },
  report: { window: 24 * 60 * 60, max: 20 },
  search: { window: 60, max: 30 },
  read: { window: 10, max: 30 },
} as const;

export type MessagingRateName = keyof typeof MESSAGING_RATE;

export const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MESSAGING_KEYS = {
  rate: (name: MessagingRateName, scope: string) => `ratelimit:msg:${name}:${scope}`,
  members: (conversationId: string) => `msg:members:${conversationId}`,
  unread: (userId: string) => `msg:unread:${userId}`,
  online: (userId: string) => `presence:online:${userId}`,
  last: (userId: string) => `presence:last:${userId}`,
  sockets: (userId: string) => `msg:ws:sockets:${userId}`,
  maintenanceLock: 'msg:maintenance:lock',
};

export const MESSAGING_CHANNELS = {
  messageCreated: 'events:messaging:message.created',
  messageUpdated: 'events:messaging:message.updated',
  reactionChanged: 'events:messaging:reaction.changed',
  conversationRead: 'events:messaging:conversation.read',
  conversationUpdated: 'events:messaging:conversation.updated',
  typing: 'events:messaging:typing',
  unread: 'events:messaging:unread',
} as const;

export const SOCKET_EVENT_BY_CHANNEL: Readonly<Record<string, string>> = {
  [MESSAGING_CHANNELS.messageCreated]: 'message.created',
  [MESSAGING_CHANNELS.messageUpdated]: 'message.updated',
  [MESSAGING_CHANNELS.reactionChanged]: 'reaction.changed',
  [MESSAGING_CHANNELS.conversationRead]: 'conversation.read',
  [MESSAGING_CHANNELS.conversationUpdated]: 'conversation.updated',
  [MESSAGING_CHANNELS.typing]: 'typing',
  [MESSAGING_CHANNELS.unread]: 'unread.changed',
};

export const PRESENCE_ONLINE_TTL_SECONDS = 90;
export const PRESENCE_LAST_TTL_SECONDS = 30 * 24 * 60 * 60;
export const EVENT_VERSION = 1;
export const DELETED_USER_NAME = 'Người dùng đã xóa';
export const CANNOT_MESSAGE = 'Bạn không thể nhắn tin cho người này.';
