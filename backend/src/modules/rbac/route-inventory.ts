import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

export interface DeclaredRoute {
  name: string;
  method: string;
  isPublic: boolean;
  isAuthenticated: boolean;
  hasPermission: boolean;
  hasRateLimit: boolean;
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function assertRoutesDeclared(routes: DeclaredRoute[]): void {
  const problems: string[] = [];
  for (const route of routes) {
    if (route.isPublic && route.isAuthenticated) {
      problems.push(`${route.name} vừa công khai vừa yêu cầu đăng nhập`);
    }
    const declared =
      route.isPublic || route.isAuthenticated || route.hasPermission;
    if (!declared) problems.push(`${route.name} thiếu metadata quyền`);
    if (
      route.isPublic &&
      WRITE_METHODS.has(route.method) &&
      !route.hasRateLimit
    ) {
      problems.push(
        `${route.name} là route ghi công khai nhưng chưa có rate limit`,
      );
    }
  }
  if (problems.length) {
    throw new Error(`Kiểm kê route thất bại:\n${problems.join('\n')}`);
  }
}

export function methodName(method: RequestMethod | undefined): string {
  return RequestMethod[method ?? RequestMethod.GET] ?? 'GET';
}

export function isRouteHandler(handler: object): boolean {
  return Reflect.getMetadata(METHOD_METADATA, handler) !== undefined;
}

export function routePath(controller: object, handler: object): string {
  const prefix = Reflect.getMetadata(PATH_METADATA, controller) ?? '';
  const path = Reflect.getMetadata(PATH_METADATA, handler) ?? '';
  return `/${prefix}/${path}`.replace(/\/+/g, '/');
}
