import { Controller, Post, UseGuards, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiHeader } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceKeyGuard } from './guards/maintenance-key.guard';

@ApiTags('admin/maintenance')
@Controller('admin/maintenance')
@UseGuards(MaintenanceKeyGuard)
export class MaintenanceController {
  private readonly logger = new Logger(MaintenanceController.name);

  constructor(private readonly maintenanceService: MaintenanceService) {}

  /**
   * management_id 재생성
   * videos 테이블에서 management_id가 NULL 또는 ''인 행에 대해 management_id 생성
   */
  @Post('regenerate-management-ids')
  @ApiOperation({
    summary: 'management_id 재생성',
    description:
      'videos 테이블에서 management_id가 NULL 또는 빈 문자열인 행에 대해 management_id를 재생성합니다. 형식: YYMMDD-001, YYMMDD-002 ...',
  })
  @ApiHeader({
    name: 'x-maintenance-key',
    description: 'Maintenance key (process.env.MAINTENANCE_KEY와 일치해야 함)',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: '재생성 성공',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        updated: { type: 'number', example: 5 },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid maintenance key',
  })
  async regenerateManagementIds(): Promise<{ ok: boolean; updated: number }> {
    this.logger.log('[regenerate-management-ids] Request received');
    return this.maintenanceService.regenerateManagementIds();
  }
}

