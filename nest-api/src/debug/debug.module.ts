import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { DebugService } from './debug.service';
import { DebugEndpointsGuard } from './guards/debug-endpoints.guard';
import { DatabaseModule } from '../database/database.module';

/**
 * ⚠️ 중요: 이 모듈은 DEBUG_ENDPOINTS=true일 때만 활성화됩니다.
 * 배포 후 원인 확인이 끝나면 반드시 DEBUG_ENDPOINTS=false로 되돌려주세요.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [DebugController],
  providers: [DebugService, DebugEndpointsGuard],
  exports: [DebugService],
})
export class DebugModule {}

