import { Module } from '@nestjs/common';
import { FacebookKeyController } from './facebook-key.controller';
import { FacebookKeyService } from './facebook-key.service';
import { DatabaseModule } from '../database/database.module';

/**
 * Facebook Key 모듈
 * Creator의 Facebook API 키 관리
 */
@Module({
  imports: [DatabaseModule],
  controllers: [FacebookKeyController],
  providers: [FacebookKeyService],
  exports: [FacebookKeyService],
})
export class FacebookKeyModule {}




































