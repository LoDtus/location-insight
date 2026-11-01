import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { AuthController } from './auth.controller.js';
import { AuthConfig } from './auth.config.js';
import { AuthGuard } from './auth.guard.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { AuthEventEntity } from './entities/auth-event.entity.js';
import { AuthIdentityEntity } from './entities/auth-identity.entity.js';
import { AuthOneTimeTokenEntity } from './entities/auth-one-time-token.entity.js';
import { AuthSessionEntity } from './entities/auth-session.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { GoogleOAuthService } from './google-oauth.service.js';
import { PasswordService } from './password.service.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { RealtimeController } from './realtime.controller.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeRegistry } from './realtime.registry.js';
import { SessionMaintenanceService } from './session-maintenance.service.js';
import { SessionService } from './session.service.js';
import { SeedAccountService } from './seed-account.service.js';
import { SessionVerifierService } from './session-verifier.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AuthIdentityEntity,
      AuthSessionEntity,
      AuthOneTimeTokenEntity,
      AuthEventEntity,
    ]),
    forwardRef(() => RbacModule),
    EmailModule,
  ],
  controllers: [AuthController, ProfileController, RealtimeController],
  providers: [
    AuthConfig,
    TokenService,
    AuthRateLimitService,
    SessionService,
    PasswordService,
    ProfileService,
    SeedAccountService,
    GoogleOAuthService,
    SessionVerifierService,
    SessionMaintenanceService,
    RealtimeRegistry,
    RealtimeGateway,
    { provide: APP_GUARD, useClass: AuthRateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthConfig, SessionService, TokenService, RealtimeRegistry],
})
export class AuthModule {}
