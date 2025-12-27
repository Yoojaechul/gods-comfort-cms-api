import { Injectable, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const TAG = 'JWT_AUTH';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const path = req?.path ?? req?.url ?? 'unknown';
    const method = req?.method ?? 'unknown';

    const authHeader: string | undefined = req?.headers?.authorization;
    if (!authHeader) {
      this.logger.warn(`[${TAG}] Authorization header missing - Path: ${path}, Method: ${method}`);
      throw new UnauthorizedException('Authorization header is required');
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      this.logger.warn(`[${TAG}] Token extraction failed - Path: ${path}, Method: ${method}`);
      throw new UnauthorizedException('Invalid token format');
    }

    this.logger.debug(
      `[${TAG}] Token present (length=${token.length}) - Path: ${path}, Method: ${method}`,
    );

    try {
      // AuthGuard('jwt')는 보통 Promise<boolean>을 반환합니다.
      const ok = await Promise.resolve(super.canActivate(context) as any);

      const userId = req?.user?.id ?? req?.user?.sub ?? 'unknown';
      const role = req?.user?.role ?? 'unknown';

      this.logger.debug(
        `[${TAG}] Authentication successful - Path: ${path}, Method: ${method}, UserId: ${userId}, Role: ${role}`,
      );

      return !!ok;
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      this.logger.error(
        `[${TAG}] Authentication failed - Path: ${path}, Method: ${method}, Error: ${msg}`,
        err?.stack,
      );
      throw new UnauthorizedException('Invalid token');
    }
  }
}
