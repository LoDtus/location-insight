import { HttpStatus, Injectable } from '@nestjs/common';
import { decodeProtectedHeader, jwtVerify, SignJWT } from 'jose';
import { v7 as uuidv7 } from 'uuid';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { AUTH_LIMITS } from './auth.constants.js';
import { AuthConfig } from './auth.config.js';

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  jti: string;
  iat: number;
}

@Injectable()
export class TokenService {
  constructor(private readonly authConfig: AuthConfig) {}

  async signAccessToken(userId: string, sessionId: string): Promise<string> {
    const key = await this.authConfig.signingKey();
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({
        alg: 'ES256',
        typ: 'at+jwt',
        kid: this.authConfig.kid,
      })
      .setIssuer(this.authConfig.issuer)
      .setAudience(this.authConfig.audience)
      .setSubject(userId)
      .setJti(uuidv7())
      .setIssuedAt()
      .setExpirationTime(`${AUTH_LIMITS.accessTtlSeconds}s`)
      .sign(key);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    let header: ReturnType<typeof decodeProtectedHeader>;
    try {
      header = decodeProtectedHeader(token);
    } catch {
      throw this.invalid();
    }

    if (header.alg !== 'ES256' || header.typ !== 'at+jwt' || !header.kid) {
      throw this.invalid();
    }

    const key = await this.authConfig.publicKey(header.kid);
    if (!key) throw this.invalid();

    try {
      const { payload } = await jwtVerify(token, key, {
        issuer: this.authConfig.issuer,
        audience: this.authConfig.audience,
        algorithms: ['ES256'],
        typ: 'at+jwt',
      });
      if (!payload.sub || typeof payload.sid !== 'string' || !payload.jti) {
        throw this.invalid();
      }
      return {
        sub: payload.sub,
        sid: payload.sid,
        jti: String(payload.jti),
        iat: Number(payload.iat ?? 0),
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      const code = (error as { code?: string }).code;
      if (code === 'ERR_JWT_EXPIRED') {
        throw new BusinessException(
          ErrorCode.TOKEN_EXPIRED,
          'Phiên đăng nhập đã hết hạn.',
          null,
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw this.invalid();
    }
  }

  private invalid(): BusinessException {
    return new BusinessException(
      ErrorCode.TOKEN_INVALID,
      'Token không hợp lệ.',
      null,
      HttpStatus.UNAUTHORIZED,
    );
  }
}
