import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * DEBUG_ENDPOINTS=true일 때만 디버그 엔드포인트 접근 허용
 * 아니면 404 반환
 */
@Injectable()
export class DebugEndpointsGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const debugEnabled = this.configService.get<string>('DEBUG_ENDPOINTS') === 'true';
    
    if (!debugEnabled) {
      throw new NotFoundException('Debug endpoints are disabled. Set DEBUG_ENDPOINTS=true to enable.');
    }

    return true;
  }
}
























