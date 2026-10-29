import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importPKCS8, importSPKI, type CryptoKey } from 'jose';

@Injectable()
export class AuthConfig {
  private privateKey: CryptoKey | null = null;
  private publicKeys = new Map<string, CryptoKey>();

  constructor(private readonly config: ConfigService) {}

  get passwordEnabled(): boolean {
    return this.config.get<string>('AUTH_PASSWORD_ENABLED') === 'true';
  }

  get kid(): string {
    return this.config.get<string>('AUTH_JWT_KID') || 'dev-1';
  }

  get issuer(): string {
    return this.config.get<string>('AUTH_JWT_ISSUER') || 'location-insight';
  }

  get audience(): string {
    return (
      this.config.get<string>('AUTH_JWT_AUDIENCE') || 'location-insight-api'
    );
  }

  get googleClientId(): string {
    return this.config.get<string>('GOOGLE_CLIENT_ID') || '';
  }

  get googleClientSecret(): string {
    return this.config.get<string>('GOOGLE_CLIENT_SECRET') || '';
  }

  get googleRedirectUri(): string {
    return this.config.get<string>('GOOGLE_REDIRECT_URI') || '';
  }

  get googleConfigured(): boolean {
    return Boolean(
      this.googleClientId && this.googleClientSecret && this.googleRedirectUri,
    );
  }

  get allowedRedirects(): string[] {
    return splitList(
      this.config.get<string>('AUTH_ALLOWED_REDIRECTS') || '/app/properties,/app/map,/app',
    );
  }

  get allowedOrigins(): string[] {
    return splitList(this.config.get<string>('AUTH_ALLOWED_ORIGINS') || '');
  }

  get websiteOrigin(): string {
    return this.allowedOrigins[0] || 'http://127.0.0.1:22360';
  }

  get cookiePath(): string {
    const prefix = this.config.get<string>('GLOBAL_PREFIX') || 'api/v1';
    return `/${prefix}/auth`;
  }

  get adminCidrs(): string[] {
    return splitList(this.config.get<string>('ADMIN_ALLOWED_CIDRS') || '');
  }

  get analysisBudgetGuard(): boolean {
    return this.config.get<string>('ANALYSIS_BUDGET_GUARD') === 'true';
  }

  async signingKey(): Promise<CryptoKey> {
    if (this.privateKey) return this.privateKey;
    const encoded = this.config.get<string>('AUTH_JWT_PRIVATE_KEY');
    if (!encoded) {
      throw new Error('Thiếu AUTH_JWT_PRIVATE_KEY');
    }
    this.privateKey = await importPKCS8(decodePem(encoded), 'ES256');
    return this.privateKey;
  }

  async publicKey(kid: string): Promise<CryptoKey | null> {
    if (this.publicKeys.size === 0) await this.loadPublicKeys();
    return this.publicKeys.get(kid) ?? null;
  }

  private async loadPublicKeys(): Promise<void> {
    const raw = this.config.get<string>('AUTH_JWT_PUBLIC_KEYS') || '';
    for (const entry of splitList(raw)) {
      const separator = entry.indexOf(':');
      if (separator <= 0) continue;
      const kid = entry.slice(0, separator);
      const pem = decodePem(entry.slice(separator + 1));
      this.publicKeys.set(kid, await importSPKI(pem, 'ES256'));
    }
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function decodePem(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes('BEGIN')) return trimmed.replace(/\\n/g, '\n');
  return Buffer.from(trimmed, 'base64').toString('utf8');
}
