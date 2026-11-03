export const NOTIFICATION_CATEGORIES = [
  'social',
  'messages',
  'billing',
  'moderation',
  'security',
  'admin',
  'system',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type PushUrgency = 'very-low' | 'low' | 'normal' | 'high';

export interface CatalogEntry {
  category: NotificationCategory;
  icon: string;
  tone: NotificationTone;
  inApp: boolean;
  push: boolean;
  urgency: PushUrgency;
  ttl: number;
  title: (params: Record<string, string>) => string;
  subtitle: (params: Record<string, string>) => string;
}

const actor = (params: Record<string, string>): string => params.actorName || 'Một người dùng';

export const NOTIFICATION_CATALOG = {
  'follow.new': {
    category: 'social',
    icon: 'user-plus',
    tone: 'info',
    inApp: true,
    push: true,
    urgency: 'low',
    ttl: 3600,
    title: (params) => `${actor(params)} đã theo dõi bạn`,
    subtitle: (params) => `Xem hồ sơ của ${actor(params)}`,
  },
  'discussion.reply': {
    category: 'social',
    icon: 'message-circle',
    tone: 'info',
    inApp: true,
    push: true,
    urgency: 'low',
    ttl: 3600,
    title: (params) => `${actor(params)} đã trả lời bài của bạn`,
    subtitle: (params) => params.preview || 'Mở diễn đàn để xem',
  },
  'discussion.mention': {
    category: 'social',
    icon: 'at-sign',
    tone: 'info',
    inApp: true,
    push: true,
    urgency: 'normal',
    ttl: 3600,
    title: (params) => `${actor(params)} đã nhắc tới bạn`,
    subtitle: (params) => params.preview || 'Mở diễn đàn để xem',
  },
  'message.new': {
    category: 'messages',
    icon: 'messages-square',
    tone: 'info',
    inApp: false,
    push: true,
    urgency: 'normal',
    ttl: 3600,
    title: (params) => `${actor(params)} đã nhắn cho bạn`,
    subtitle: (params) => params.preview || 'Mở tin nhắn để xem',
  },
  'message.delete_request': {
    category: 'messages',
    icon: 'triangle-alert',
    tone: 'warning',
    inApp: true,
    push: true,
    urgency: 'normal',
    ttl: 86400,
    title: (params) => `${actor(params)} muốn xóa lịch sử trò chuyện`,
    subtitle: () => 'Mở tin nhắn để đồng ý hoặc từ chối',
  },
  'payment.succeeded': {
    category: 'billing',
    icon: 'badge-check',
    tone: 'success',
    inApp: true,
    push: true,
    urgency: 'normal',
    ttl: 86400,
    title: () => 'Thanh toán thành công',
    subtitle: (params) => params.preview || 'Gói của bạn đã được cập nhật',
  },
  'payment.failed': {
    category: 'billing',
    icon: 'triangle-alert',
    tone: 'danger',
    inApp: true,
    push: true,
    urgency: 'high',
    ttl: 86400,
    title: () => 'Thanh toán không thành công',
    subtitle: (params) => params.preview || 'Mở thanh toán để xem',
  },
  'plan.expiring': {
    category: 'billing',
    icon: 'clock',
    tone: 'warning',
    inApp: true,
    push: true,
    urgency: 'normal',
    ttl: 86400,
    title: () => 'Gói sắp hết hạn',
    subtitle: (params) => params.preview || 'Gia hạn để không gián đoạn',
  },
  'listing.approved': {
    category: 'moderation',
    icon: 'circle-check',
    tone: 'success',
    inApp: true,
    push: true,
    urgency: 'normal',
    ttl: 86400,
    title: () => 'Tin rao đã được duyệt',
    subtitle: (params) => params.preview || 'Tin của bạn đã hiển thị',
  },
  'listing.rejected': {
    category: 'moderation',
    icon: 'circle-x',
    tone: 'danger',
    inApp: true,
    push: true,
    urgency: 'normal',
    ttl: 86400,
    title: () => 'Tin rao chưa được duyệt',
    subtitle: (params) => params.preview || 'Mở tin để xem lý do',
  },
  'feedback.replied': {
    category: 'moderation',
    icon: 'message-square-heart',
    tone: 'info',
    inApp: true,
    push: true,
    urgency: 'normal',
    ttl: 86400,
    title: () => 'Góp ý của bạn có phản hồi',
    subtitle: (params) => params.preview || 'Mở góp ý để xem',
  },
  'security.new_login': {
    category: 'security',
    icon: 'shield-alert',
    tone: 'warning',
    inApp: true,
    push: true,
    urgency: 'high',
    ttl: 86400,
    title: () => 'Có lượt đăng nhập mới',
    subtitle: (params) => params.preview || 'Kiểm tra các phiên đang mở',
  },
  'security.password_changed': {
    category: 'security',
    icon: 'key-round',
    tone: 'warning',
    inApp: true,
    push: true,
    urgency: 'high',
    ttl: 86400,
    title: () => 'Mật khẩu vừa được đổi',
    subtitle: () => 'Nếu không phải bạn, hãy kiểm tra tài khoản',
  },
  'admin.report.new': {
    category: 'admin',
    icon: 'flag',
    tone: 'warning',
    inApp: true,
    push: true,
    urgency: 'normal',
    ttl: 86400,
    title: () => 'Có báo cáo mới cần xem',
    subtitle: (params) => params.preview || 'Mở hàng chờ kiểm duyệt',
  },
  'admin.feedback.new': {
    category: 'admin',
    icon: 'inbox',
    tone: 'info',
    inApp: true,
    push: false,
    urgency: 'low',
    ttl: 86400,
    title: () => 'Có góp ý mới',
    subtitle: (params) => params.preview || 'Mở hộp góp ý',
  },
  'admin.reconciliation.mismatch': {
    category: 'admin',
    icon: 'scale',
    tone: 'danger',
    inApp: true,
    push: true,
    urgency: 'high',
    ttl: 86400,
    title: () => 'Đối soát có lệch',
    subtitle: (params) => params.preview || 'Mở đối soát để kiểm tra',
  },
  'system.announcement': {
    category: 'system',
    icon: 'megaphone',
    tone: 'info',
    inApp: true,
    push: true,
    urgency: 'low',
    ttl: 86400,
    title: (params) => params.title || 'Thông báo từ Địa Thế',
    subtitle: (params) => params.preview || '',
  },
} as const satisfies Record<string, CatalogEntry>;

export type NotificationType = keyof typeof NOTIFICATION_CATALOG;

export function catalogOf(type: string): CatalogEntry | null {
  if (type in NOTIFICATION_CATALOG) return NOTIFICATION_CATALOG[type as NotificationType];
  return null;
}
