import { createHmac, timingSafeEqual } from 'node:crypto';

export function signUnsubscribe(secret: string, userId: string, category: string): string {
  return createHmac('sha256', secret).update(`unsub.${userId}.${category}`).digest('base64url');
}

export function verifyUnsubscribe(
  secret: string,
  userId: string,
  category: string,
  token: string,
): boolean {
  const expected = Buffer.from(signUnsubscribe(secret, userId, category));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
