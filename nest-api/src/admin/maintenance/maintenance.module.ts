import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceKeyGuard } from './guards/maintenance-key.guard';
import { DatabaseModule } from '../../database/database.module';


@Module({
  imports: [DatabaseModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceKeyGuard],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}

