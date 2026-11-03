import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';
import {
  AuthRateLimit,
  AuthenticatedOnly,
  Public,
  RequireRecentAuth,
} from '../../common/decorators/access.decorator.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../shared/constants/error-code.constant.js';
import { HttpStatus } from '@nestjs/common';
import { PolicyService } from '../rbac/policy.service.js';
import { UserRole } from '../rbac/authorization.types.js';
import type { RequestWithPrincipal } from './auth.guard.js';
import { AuthConfig } from './auth.config.js';
import {
  REFRESH_COOKIE,
  REQUESTED_WITH,
  clientIp,
  deviceLabelFromAgent,
} from './auth.constants.js';
import { AUTH_LIMITS } from './auth.constants.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import {
  EmailDto,
  LoginDto,
  PasswordChangeDto,
  ReauthDto,
  RefreshDto,
  RegisterDto,
  RenameSessionDto,
  ResetPasswordDto,
  TokenDto,
} from './dto/auth.dto.js';
import { AuthProvider } from './entities/auth-identity.entity.js';
import { SessionRevokeReason } from './entities/auth-session.entity.js';
import { UserEntity, UserStatus } from './entities/user.entity.js';
import { TokenService } from './token.service.js';
import { SessionVerifierService } from './session-verifier.service.js';
import { GoogleOAuthService } from './google-oauth.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authConfig: AuthConfig,
    private readonly google: GoogleOAuthService,
    private readonly tokens: TokenService,
    private readonly verifier: SessionVerifierService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly limits: AuthRateLimitService,
    private readonly policy: PolicyService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  @Public()
  @AuthRateLimit('google')
  @Get('google/start')
  async googleStart(
    @Query('redirectTo') redirectTo: string | undefined,
    @Query('reauth') reauth: string | undefined,
    @Req() request: RequestWithPrincipal,
    @Res() response: Response,
  ): Promise<void> {
    let reauthUserId: string | null = null;
    if (reauth === '1') {
      const header = request.header('authorization') || '';
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!token) {
        throw new BusinessException(
          ErrorCode.UNAUTHENTICATED,
          'Cần đăng nhập.',
          null,
          HttpStatus.UNAUTHORIZED,
        );
      }
      const claims = await this.tokens.verifyAccessToken(token);
      const verified = await this.verifier.verify(
        claims.sid,
        claims.sub,
        claims.iat,
      );
      reauthUserId = verified.userId;
    }
    const url = await this.google.start(redirectTo, reauthUserId);
    response.redirect(url);
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.google.callback(code, state, error, {
      userAgent: request.header('user-agent') ?? null,
      ipAddress: clientIp(request.ip),
    });
    if (result.ok && result.issued) {
      this.setRefreshCookie(
        response,
        result.issued.refreshToken,
        result.issued.session.rememberMe,
        result.issued.session.absoluteExpiresAt,
      );
    }
    const target = new URL(result.redirectTo, this.authConfig.websiteOrigin);
    if (!result.ok) {
      target.pathname = '/auth/login';
      target.search = '';
      target.searchParams.set('error', result.error);
    }
    response.redirect(target.toString());
  }

  @Public()
  @AuthRateLimit('register')
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  async register(@Body() body: RegisterDto, @Req() request: Request) {
    await this.passwords.register({
      ...body,
      ipAddress: clientIp(request.ip),
    });
    return { accepted: true };
  }

  @Public()
  @AuthRateLimit('reset')
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body() body: TokenDto): Promise<void> {
    await this.passwords.verifyEmail(body.token);
  }

  @Public()
  @AuthRateLimit('login')
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertOrigin(request, true);
    await this.limits.assertLoginAccount(body.email);
    try {
      const user = await this.passwords.login(body.email, body.password);
      const native = request.header('x-client') === 'native';
      const rememberMe = native
        ? body.remember !== false
        : body.remember === true;
      return await this.issue(
        user,
        AuthProvider.PASSWORD,
        request,
        response,
        rememberMe,
      );
    } catch (error) {
      await this.limits.noteLoginFailure(body.email);
      throw error;
    }
  }

  @Public()
  @AuthRateLimit('reset')
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgot(@Body() body: EmailDto, @Req() request: Request) {
    await this.passwords.forgot(body.email, clientIp(request.ip));
    return { accepted: true };
  }

  @Public()
  @AuthRateLimit('reset')
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reset(@Body() body: ResetPasswordDto): Promise<void> {
    await this.passwords.reset(body.token, body.password);
  }

  @Public()
  @AuthRateLimit('refresh')
  @Post('refresh')
  async refresh(
    @Body() body: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertOrigin(request, true);
    const native = request.header('x-client') === 'native';
    const refreshToken = native
      ? body.refreshToken
      : request.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      throw new BusinessException(
        ErrorCode.REFRESH_INVALID,
        'Phiên đăng nhập không còn hợp lệ.',
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }
    try {
      const issued = await this.sessions.rotate(
        refreshToken,
        clientIp(request.ip),
      );
      return this.present(issued, request, response);
    } catch (error) {
      if (
        error instanceof BusinessException &&
        error.getStatus() === HttpStatus.UNAUTHORIZED
      ) {
        this.clearRefreshCookie(response);
      }
      throw error;
    }
  }

  @AuthenticatedOnly()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: RequestWithPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertOrigin(request, true);
    const principal = this.current(request);
    const session = await this.sessions.findOwned(
      principal.userId as string,
      principal.sessionId as string,
    );
    await this.sessions.revoke(
      session,
      SessionRevokeReason.LOGOUT,
      clientIp(request.ip),
    );
    this.clearRefreshCookie(response);
  }

  @AuthenticatedOnly()
  @Get('me')
  async me(@Req() request: RequestWithPrincipal) {
    const principal = this.current(request);
    const user = await this.users.findOneByOrFail({
      id: principal.userId as string,
    });
    const session = await this.sessions.findOwned(
      user.id,
      principal.sessionId as string,
    );
    return {
      user: await this.sessions.summary(user),
      session: this.sessions.toItem(session, session.id),
    };
  }

  @AuthenticatedOnly()
  @Post('reauth')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reauth(
    @Body() body: ReauthDto,
    @Req() request: RequestWithPrincipal,
  ): Promise<void> {
    const principal = this.current(request);
    const user = await this.users.findOneByOrFail({
      id: principal.userId as string,
    });
    await this.passwords.reauth(user, body.password);
    await this.sessions.markReauthenticated(principal.sessionId as string);
  }

  @AuthenticatedOnly()
  @RequireRecentAuth()
  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body() body: PasswordChangeDto,
    @Req() request: RequestWithPrincipal,
  ): Promise<void> {
    const principal = this.current(request);
    this.policy.assertRecentAuth(principal);
    const user = await this.users.findOneByOrFail({
      id: principal.userId as string,
    });
    await this.passwords.change(
      user,
      body.currentPassword,
      body.newPassword,
      principal.sessionId as string,
    );
  }

  @AuthenticatedOnly()
  @Get('sessions')
  async listSessions(@Req() request: RequestWithPrincipal) {
    const principal = this.current(request);
    return {
      items: await this.sessions.list(
        principal.userId as string,
        principal.sessionId,
      ),
    };
  }

  @AuthenticatedOnly()
  @Post('sessions/revoke-others')
  async revokeOthers(@Req() request: RequestWithPrincipal) {
    const principal = this.current(request);
    const revoked = await this.sessions.revokeAll(
      principal.userId as string,
      SessionRevokeReason.LOGOUT_OTHER,
      principal.sessionId as string,
    );
    return { revoked };
  }

  @AuthenticatedOnly()
  @Post('sessions/revoke-all')
  async revokeAll(
    @Req() request: RequestWithPrincipal,
    @Res({ passthrough: true }) response: Response,
  ) {
    const principal = this.current(request);
    const revoked = await this.sessions.revokeAll(
      principal.userId as string,
      SessionRevokeReason.LOGOUT_ALL,
    );
    this.clearRefreshCookie(response);
    return { revoked };
  }

  @AuthenticatedOnly()
  @Patch('sessions/:sessionId')
  async renameSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() body: RenameSessionDto,
    @Req() request: RequestWithPrincipal,
  ) {
    const principal = this.current(request);
    return this.sessions.rename(
      principal.userId as string,
      sessionId,
      body.deviceLabel,
    );
  }

  @AuthenticatedOnly()
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() request: RequestWithPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const principal = this.current(request);
    const session = await this.sessions.findOwned(
      principal.userId as string,
      sessionId,
    );
    const reason =
      session.id === principal.sessionId
        ? SessionRevokeReason.LOGOUT
        : SessionRevokeReason.LOGOUT_OTHER;
    await this.sessions.revoke(session, reason, clientIp(request.ip));
    if (session.id === principal.sessionId) this.clearRefreshCookie(response);
  }

  @AuthenticatedOnly()
  @RequireRecentAuth()
  @Delete('account')
  @HttpCode(HttpStatus.ACCEPTED)
  async deleteAccount(@Req() request: RequestWithPrincipal) {
    const principal = this.current(request);
    this.policy.assertRecentAuth(principal);
    const user = await this.users.findOneByOrFail({
      id: principal.userId as string,
    });
    const adminCount = await this.users.count({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    this.policy.assertAccountDeletion(user.role, adminCount);
    user.status = UserStatus.DELETED;
    user.deletedAt = new Date();
    await this.users.save(user);
    await this.sessions.revokeAll(user.id, SessionRevokeReason.ACCOUNT_DELETED);
    await this.sessions.record(
      'account_deleted',
      user.id,
      principal.sessionId,
      null,
      null,
    );
    return { accepted: true };
  }

  private async issue(
    user: UserEntity,
    method: AuthProvider,
    request: Request,
    response: Response,
    rememberMe: boolean,
  ) {
    const issued = await this.sessions.open({
      user,
      method,
      clientType: request.header('x-client') === 'native' ? 'native' : 'web',
      deviceLabel: deviceLabelFromAgent(request.header('user-agent')),
      userAgent: request.header('user-agent') ?? null,
      ipAddress: clientIp(request.ip),
      rememberMe,
    });
    return this.present(issued, request, response);
  }

  private async present(
    issued: Awaited<ReturnType<SessionService['open']>>,
    request: Request,
    response: Response,
  ) {
    const native = request.header('x-client') === 'native';
    if (native) {
      return {
        accessToken: issued.accessToken,
        tokenType: 'Bearer',
        expiresIn: issued.expiresIn,
        refreshToken: issued.refreshToken,
        user: await this.sessions.summary(issued.user),
      };
    }
    this.setRefreshCookie(
      response,
      issued.refreshToken,
      issued.session.rememberMe,
      issued.session.absoluteExpiresAt,
    );
    return {
      accessToken: issued.accessToken,
      tokenType: 'Bearer',
      expiresIn: issued.expiresIn,
      user: await this.sessions.summary(issued.user),
    };
  }

  private current(request: RequestWithPrincipal) {
    const principal = request.principal;
    if (!principal?.userId || !principal.sessionId) {
      throw new BusinessException(
        ErrorCode.UNAUTHENTICATED,
        'Cần đăng nhập.',
        null,
        HttpStatus.UNAUTHORIZED,
      );
    }
    return principal;
  }

  private assertOrigin(request: Request, allowNative: boolean): void {
    if (request.header('x-requested-with') !== REQUESTED_WITH) {
      throw new BusinessException(
        ErrorCode.INVALID_REQUEST,
        'Thiếu header xác thực trình duyệt.',
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
    const origin = request.header('origin');
    const native = request.header('x-client') === 'native';
    if (origin && !this.authConfig.allowedOrigins.includes(origin)) {
      throw new BusinessException(
        ErrorCode.INVALID_REQUEST,
        'Nguồn yêu cầu không được phép.',
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!origin && !(allowNative && native)) {
      throw new BusinessException(
        ErrorCode.INVALID_REQUEST,
        'Thiếu nguồn yêu cầu.',
        null,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private setRefreshCookie(
    response: Response,
    token: string,
    rememberMe: boolean,
    absoluteExpiresAt: Date,
  ): void {
    const remaining = absoluteExpiresAt.getTime() - Date.now();
    response.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: this.authConfig.cookiePath,
      ...(rememberMe ? { maxAge: Math.max(1000, remaining) } : {}),
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: this.authConfig.cookiePath,
    });
  }
}
