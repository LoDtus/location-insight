const LINK = /^\/(app|admin)\/[A-Za-z0-9/_\-?=&#.%@]*$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export function safeLink(value: string): string | null {
  const link = value.trim();
  if (!link.startsWith('/app/') && !link.startsWith('/admin/')) return null;
  if (link.includes('..') || link.includes('\\') || link.includes('//')) return null;
  if (!LINK.test(link) || link.length > 300) return null;
  return link;
}

export function plain(value: string, max: number): string {
  return value.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function topicOf(type: string): string {
  return type.replace(/[^A-Za-z0-9\-_]/g, '-').slice(0, 32);
}

const PUSH_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
  'notify.windows.com',
  'android.googleapis.com',
];

export function allowedPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

export function keyByteLength(value: string): number {
  try {
    return Buffer.from(value, 'base64url').length;
  } catch {
    return 0;
  }
}
