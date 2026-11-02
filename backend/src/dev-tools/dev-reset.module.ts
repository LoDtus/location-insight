import { DynamicModule, Logger, Module } from '@nestjs/common';
import { DevResetController } from './dev-reset.controller.js';
import { DevResetGuard } from './dev-reset.guard.js';
import { evaluateDevResetPolicy } from './dev-reset.policy.js';
import { DevResetService } from './dev-reset.service.js';

@Module({})
export class DevResetModule {}

/**
 * Trả module nếu và chỉ nếu mọi điều kiện môi trường dev đều đúng; ngược lại trả `null`
 * (route không được đăng ký, nên không có gì để gọi).
 */
export function registerDevReset(env: NodeJS.ProcessEnv): DynamicModule | null {
  const policy = evaluateDevResetPolicy(env);
  if (!policy.allowed) {
    new Logger('DevReset').warn(
      `Công cụ reset dev KHÔNG bật: ${policy.problems.join('; ')}`,
    );
    return null;
  }
  new Logger('DevReset').warn('Công cụ reset dev ĐANG BẬT (POST /dev/reset). Chỉ dùng ở máy dev.');
  return {
    module: DevResetModule,
    controllers: [DevResetController],
    providers: [DevResetService, DevResetGuard],
  };
}
