import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { DebugController } from './debug.controller';
import { DebugService } from './debug.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [DebugController],
  providers: [DebugService],
})
export class DebugModule {}
