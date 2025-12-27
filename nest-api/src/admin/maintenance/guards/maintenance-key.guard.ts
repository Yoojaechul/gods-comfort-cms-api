import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * x-maintenance-key 헤더 검증 Guard
 * 헤더 값이 process.env.MAINTENANCE_KEY와 일치해야 함
 */
@Injectable()
export class MaintenanceKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const maintenanceKey = request.headers['x-maintenance-key'];
    const expectedKey = this.configService.get<string>('MAINTENANCE_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException({
        message: 'MAINTENANCE_KEY is not configured',
        error: 'Unauthorized',
      });
    }

    if (!maintenanceKey || maintenanceKey !== expectedKey) {
      throw new UnauthorizedException({
        message: 'Invalid maintenance key',
        error: 'Unauthorized',
      });
    }

    return true;
  }
}

