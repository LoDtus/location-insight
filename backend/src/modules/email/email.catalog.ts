import { EmailCategory } from './email.constants.js';

export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
  /** `url`: chỉ chấp nhận http(s) tuyệt đối khi render. */
  kind?: 'text' | 'url';
}

export interface TemplateDefinition {
  key: string;
  category: EmailCategory;
  name: string;
  description: string;
  /** Xóa nội dung khi đã gửi/chết (có chứa token). */
  sensitive: boolean;
  variables: TemplateVariable[];
  defaults: { subject: string; bodyHtml: string; bodyText: string };
}

/** Biến luôn có sẵn ở mọi loại. */
export const GLOBAL_VARIABLES: TemplateVariable[] = [
  { name: 'app_name', description: 'Tên ứng dụng', example: 'Địa Thế' },
  { name: 'app_url', description: 'Địa chỉ website', example: 'https://diathe.vn', kind: 'url' },
  { name: 'support_email', description: 'Email hỗ trợ', example: 'support@diathe.vn' },
];

const NAME: TemplateVariable = {
  name: 'display_name',
  description: 'Tên hiển thị của người nhận',
  example: 'Minh Anh',
};

const button = (href: string, label: string): string =>
  `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background-color:#1f6f50;color:#ffffff;padding:12px 22px;border-radius:8px;font-weight:600;text-decoration:none;">${label}</a></p>`;

export const EMAIL_CATALOG: TemplateDefinition[] = [
  {
    key: 'verify_email',
    category: 'security',
    name: 'Xác minh email',
    description: 'Gửi khi đăng ký bằng mật khẩu để xác minh địa chỉ email.',
    sensitive: true,
    variables: [
      NAME,
      { name: 'verify_url', description: 'Liên kết xác minh (dùng một lần)', example: 'https://diathe.vn/auth/verify-email?token=abc', kind: 'url' },
      { name: 'expires_minutes', description: 'Số phút liên kết còn hiệu lực', example: '60' },
    ],
    defaults: {
      subject: 'Xác minh email {{app_name}} của bạn',
      bodyHtml: `<p>Chào {{display_name}},</p><p>Cảm ơn bạn đã đăng ký {{app_name}}. Hãy xác minh địa chỉ email để hoàn tất tài khoản.</p>${button('{{verify_url}}', 'Xác minh email')}<p style="color:#6b7280;font-size:13px;">Liên kết có hiệu lực trong {{expires_minutes}} phút. Nếu bạn không đăng ký, hãy bỏ qua email này.</p>`,
      bodyText: `Chào {{display_name}},\n\nXác minh email {{app_name}} của bạn tại:\n{{verify_url}}\n\nLiên kết có hiệu lực trong {{expires_minutes}} phút. Nếu bạn không đăng ký, hãy bỏ qua email này.`,
    },
  },
  {
    key: 'reset_password',
    category: 'security',
    name: 'Đặt lại mật khẩu',
    description: 'Gửi khi người dùng yêu cầu quên mật khẩu.',
    sensitive: true,
    variables: [
      NAME,
      { name: 'reset_url', description: 'Liên kết đặt lại mật khẩu (dùng một lần)', example: 'https://diathe.vn/auth/reset-password?token=abc', kind: 'url' },
      { name: 'expires_minutes', description: 'Số phút liên kết còn hiệu lực', example: '60' },
    ],
    defaults: {
      subject: 'Đặt lại mật khẩu {{app_name}}',
      bodyHtml: `<p>Chào {{display_name}},</p><p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>${button('{{reset_url}}', 'Đặt lại mật khẩu')}<p style="color:#6b7280;font-size:13px;">Liên kết có hiệu lực trong {{expires_minutes}} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn.</p>`,
      bodyText: `Chào {{display_name}},\n\nĐặt lại mật khẩu {{app_name}} tại:\n{{reset_url}}\n\nLiên kết có hiệu lực trong {{expires_minutes}} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
    },
  },
  {
    key: 'password_changed',
    category: 'security',
    name: 'Mật khẩu đã thay đổi',
    description: 'Thông báo bảo mật sau khi đặt lại mật khẩu thành công.',
    sensitive: false,
    variables: [NAME, { name: 'changed_at', description: 'Thời điểm đổi (UTC)', example: '02/11/2026 09:30 UTC' }],
    defaults: {
      subject: 'Mật khẩu {{app_name}} của bạn đã được thay đổi',
      bodyHtml: `<p>Chào {{display_name}},</p><p>Mật khẩu tài khoản của bạn vừa được thay đổi lúc {{changed_at}}. Các phiên đăng nhập cũ đã bị đăng xuất.</p><p>Nếu không phải bạn thực hiện, hãy liên hệ {{support_email}} ngay.</p>`,
      bodyText: `Chào {{display_name}},\n\nMật khẩu tài khoản của bạn vừa được thay đổi lúc {{changed_at}}. Các phiên đăng nhập cũ đã bị đăng xuất.\nNếu không phải bạn, hãy liên hệ {{support_email}} ngay.`,
    },
  },
  {
    key: 'welcome',
    category: 'transactional',
    name: 'Chào mừng',
    description: 'Gửi sau khi người dùng xác minh email thành công.',
    sensitive: false,
    variables: [NAME],
    defaults: {
      subject: 'Chào mừng bạn đến với {{app_name}}',
      bodyHtml: `<p>Chào {{display_name}},</p><p>Email của bạn đã được xác minh. Bạn có thể bắt đầu khám phá khu vực, lưu địa điểm và trò chuyện cùng cộng đồng.</p>${button('{{app_url}}', 'Mở {{app_name}}')}`,
      bodyText: `Chào {{display_name}},\n\nEmail của bạn đã được xác minh. Bắt đầu tại {{app_url}}`,
    },
  },
  {
    key: 'feedback_reply',
    category: 'transactional',
    name: 'Trả lời góp ý',
    description: 'Gửi khi quản trị viên trả lời một góp ý của người dùng.',
    sensitive: false,
    variables: [
      NAME,
      { name: 'feedback_excerpt', description: 'Trích đoạn góp ý gốc', example: 'Bản đồ không tải được trên điện thoại…' },
      { name: 'reply_excerpt', description: 'Trích đoạn câu trả lời', example: 'Cảm ơn bạn, chúng tôi đã sửa lỗi này.' },
      { name: 'feedback_url', description: 'Liên kết tới cuộc trao đổi', example: 'https://diathe.vn/app/feedback/abc', kind: 'url' },
    ],
    defaults: {
      subject: 'Góp ý của bạn đã có phản hồi',
      bodyHtml: `<p>Chào {{display_name}},</p><p>Đội ngũ {{app_name}} vừa trả lời góp ý của bạn.</p><blockquote style="margin:16px 0;padding:8px 14px;border-left:3px solid #d1d5db;color:#6b7280;">{{feedback_excerpt}}</blockquote><p><strong>Phản hồi:</strong> {{reply_excerpt}}</p>${button('{{feedback_url}}', 'Xem cuộc trao đổi')}`,
      bodyText: `Chào {{display_name}},\n\nGóp ý: {{feedback_excerpt}}\n\nPhản hồi: {{reply_excerpt}}\n\nXem tại {{feedback_url}}`,
    },
  },
  {
    key: 'new_follower',
    category: 'notification',
    name: 'Có người theo dõi',
    description: 'Gửi khi có người theo dõi bạn (mỗi cặp một lần).',
    sensitive: false,
    variables: [
      NAME,
      { name: 'follower_name', description: 'Tên người vừa theo dõi', example: 'Hoàng Nam' },
      { name: 'profile_url', description: 'Liên kết tới hồ sơ người theo dõi', example: 'https://diathe.vn/app/profile/abc', kind: 'url' },
    ],
    defaults: {
      subject: '{{follower_name}} vừa theo dõi bạn',
      bodyHtml: `<p>Chào {{display_name}},</p><p><strong>{{follower_name}}</strong> vừa bắt đầu theo dõi bạn trên {{app_name}}.</p>${button('{{profile_url}}', 'Xem hồ sơ')}`,
      bodyText: `Chào {{display_name}},\n\n{{follower_name}} vừa theo dõi bạn trên {{app_name}}.\nXem hồ sơ: {{profile_url}}`,
    },
  },
];

const BY_KEY = new Map(EMAIL_CATALOG.map((t) => [t.key, t]));

export function findTemplate(key: string): TemplateDefinition | undefined {
  return BY_KEY.get(key);
}

export function allVariables(def: TemplateDefinition): TemplateVariable[] {
  return [...def.variables, ...GLOBAL_VARIABLES];
}
