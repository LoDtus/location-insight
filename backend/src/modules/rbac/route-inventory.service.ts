import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import {
  AUTHENTICATED_KEY,
  PERMISSIONS_KEY,
  PUBLIC_KEY,
  RATE_LIMIT_KEY,
} from '../../common/decorators/access.decorator.js';
import {
  assertRoutesDeclared,
  isRouteHandler,
  methodName,
  routePath,
} from './route-inventory.js';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';

@Injectable()
export class RouteInventoryService implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    const routes = this.discovery.getControllers().flatMap((wrapper) => {
      const instance = wrapper.instance as object | null;
      if (!instance) return [];
      const prototype = Object.getPrototypeOf(instance) as object;
      return Object.getOwnPropertyNames(prototype)
        .filter((name) => name !== 'constructor')
        .flatMap((name) => {
          const handler = prototype[name as keyof typeof prototype] as object;
          if (typeof handler !== 'function' || !isRouteHandler(handler))
            return [];
          const method = this.reflector.get<RequestMethod>(
            METHOD_METADATA,
            handler,
          );
          return [
            {
              name: `${routePath(instance.constructor, handler)} ${methodName(method)}`,
              method: methodName(method),
              isPublic: Boolean(
                this.reflector.getAllAndOverride(PUBLIC_KEY, [
                  handler,
                  instance.constructor,
                ]),
              ),
              isAuthenticated: Boolean(
                this.reflector.getAllAndOverride(AUTHENTICATED_KEY, [
                  handler,
                  instance.constructor,
                ]),
              ),
              hasPermission: Boolean(
                this.reflector.getAllAndOverride(PERMISSIONS_KEY, [
                  handler,
                  instance.constructor,
                ]),
              ),
              hasRateLimit: Boolean(
                this.reflector.getAllAndOverride(RATE_LIMIT_KEY, [
                  handler,
                  instance.constructor,
                ]),
              ),
            },
          ];
        });
    });
    assertRoutesDeclared(routes);
  }
}
